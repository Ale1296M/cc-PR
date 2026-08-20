import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { fetchMyFamilyRecipients } from "@/lib/family-access";
import { toast } from "sonner";
import { AsyncEmpty, AsyncError, AsyncSkeleton } from "@/components/ui/async-state";

export const Route = createFileRoute("/app/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Family chat · Con Cariño PR" },
      { name: "description", content: "Live chat between a family, their caregivers, and the Con Cariño PR care team." },
      { property: "og:title", content: "Family chat · Con Cariño PR" },
      { property: "og:description", content: "Live chat between a family, their caregivers, and the Con Cariño PR care team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Msg = {
  id: string;
  sender_profile_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

type Thread = { kind: "family" | "caregiver"; id: string };

function MessagesPage() {
  const { user, role, loading } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [thread, setThread] = useState<Thread | null>(null);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === "admin";
  const isCaregiver = role === "caregiver";
  const isFamily = role === "family_member";
  const canSeeFamilies = isAdmin || isFamily;

  // Family threads (admins: all reachable, family: their own). Caregivers never load this.
  const {
    data: recipients,
    isPending: recipientsPending,
    error: recipientsError,
    refetch: refetchRecipients,
  } = useQuery({
    queryKey: ["chat-recipients", uid],
    enabled: !!uid && canSeeFamilies,
    queryFn: async () => {
      if (isFamily) {
        // Family members: threads come from their family_members memberships.
        return await fetchMyFamilyRecipients(uid!);
      }
      const { data, error } = await supabase
        .from("care_recipients")
        .select("id, full_name, family_id")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const families = useMemo(() => {
    const map = new Map<string, string[]>();
    (recipients ?? []).forEach((r) => {
      map.set(r.family_id, [...(map.get(r.family_id) ?? []), r.full_name]);
    });
    return Array.from(map, ([id, names]) => ({ id, label: names.join(", ") }));
  }, [recipients]);

  // Caregiver threads (admins only — caregivers always use their own thread)
  const {
    data: caregiverList,
    isPending: caregiversPending,
    error: caregiversError,
    refetch: refetchCaregivers,
  } = useQuery({
    queryKey: ["chat-caregivers"],
    enabled: !!uid && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caregivers")
        .select("profile_id, profiles:profile_id(full_name)")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.profile_id,
        label: (c.profiles as { full_name: string | null } | null)?.full_name ?? "Caregiver",
      }));
    },
  });

  // Default thread selection per role
  useEffect(() => {
    if (thread) return;
    if (isCaregiver && uid) setThread({ kind: "caregiver", id: uid });
    else if (canSeeFamilies && families.length) setThread({ kind: "family", id: families[0].id });
  }, [thread, isCaregiver, uid, canSeeFamilies, families]);

  const {
    data: messages,
    isPending: messagesPending,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["thread-messages", thread?.kind, thread?.id],
    enabled: !!thread,
    queryFn: async () => {
      if (thread!.kind === "family") {
        const { data, error } = await supabase
          .from("family_messages")
          .select("id, sender_profile_id, content, created_at, read_at")
          .eq("family_id", thread!.id)
          .order("created_at");
        if (error) throw error;
        return (data ?? []) as Msg[];
      }
      const { data, error } = await supabase
        .from("caregiver_messages")
        .select("id, sender_profile_id, content, created_at, read_at")
        .eq("caregiver_profile_id", thread!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["chat-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url");
      return data ?? [];
    },
  });

  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "Care team";

  // Realtime: new messages arrive without refreshing
  useEffect(() => {
    if (!thread) return;
    const table = thread.kind === "family" ? "family_messages" : "caregiver_messages";
    const column = thread.kind === "family" ? "family_id" : "caregiver_profile_id";
    const channel = supabase
      .channel(`${table}-${thread.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${column}=eq.${thread.id}` },
        () => qc.invalidateQueries({ queryKey: ["thread-messages", thread.kind, thread.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [thread, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!uid || !thread || !messages?.length) return;
    const unread = messages.filter((m) => m.sender_profile_id !== uid && !m.read_at).map((m) => m.id);
    if (!unread.length) return;
    const table = thread.kind === "family" ? "family_messages" : "caregiver_messages";
    void supabase.from(table).update({ read_at: new Date().toISOString() }).in("id", unread);
  }, [messages, uid, thread]);

  const send = useMutation({
    mutationFn: async () => {
      const content = body.trim();
      if (thread!.kind === "family") {
        const { error } = await supabase
          .from("family_messages")
          .insert({ family_id: thread!.id, sender_profile_id: uid!, content });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("caregiver_messages")
          .insert({ caregiver_profile_id: thread!.id, sender_profile_id: uid!, content });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["thread-messages", thread?.kind, thread?.id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't send that message — try again."),
  });

  const listsPending = (canSeeFamilies && recipientsPending) || (isAdmin && caregiversPending);
  const q = search.trim().toLowerCase();
  const shownFamilies = q ? families.filter((f) => f.label.toLowerCase().includes(q)) : families;
  const shownCaregivers = q
    ? (caregiverList ?? []).filter((c) => c.label.toLowerCase().includes(q))
    : (caregiverList ?? []);

  function openThread(next: Thread) {
    setThread(next);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  const listsError = (canSeeFamilies && recipientsError) || (isAdmin && caregiversError) || null;
  const showSidebar = isAdmin;
  const noThreads =
    !isCaregiver && !listsPending && !listsError && families.length === 0 && (caregiverList ?? []).length === 0;

  const heading = isCaregiver ? "Care team chat" : isFamily ? "Your care team" : "Messages";
  const subheading = isCaregiver
    ? "A private thread between you and the Con Cariño PR care team."
    : isFamily
      ? "A private thread between your family and the Con Cariño PR care team."
      : "Private secure thread console with families and caregiver workforce";

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Messages</p>
        <h1 className="type-display mt-1">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subheading}</p>
      </header>

      {(loading || listsPending) && <AsyncSkeleton shape="chat" count={5} />}
      {!loading && !listsPending && listsError && (
        <AsyncError
          what="your conversations"
          error={listsError}
          onRetry={() => {
            void refetchRecipients();
            void refetchCaregivers();
          }}
        />
      )}
      {!loading && !listsPending && !listsError && noThreads && (
        <AsyncEmpty
          title="No conversations yet"
          hint="A thread appears here as soon as a family or a caregiver is set up."
        />
      )}

      {thread && (
        <div
          className={`card-soft grid min-h-[60vh] overflow-hidden ${
            showSidebar ? "md:grid-cols-[240px_1fr]" : ""
          }`}
        >
          {showSidebar && (
            <aside className="border-b border-border md:border-b-0 md:border-r">
              <div className="space-y-2 p-4 pb-0">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations…"
                  aria-label="Search conversations"
                  className="min-h-11 w-full rounded-full border border-border bg-background px-4 text-sm"
                />
                <div className="flex gap-2">
                  <select
                    value={starting}
                    onChange={(e) => setStarting(e.target.value)}
                    aria-label="Choose someone to start a chat with"
                    className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Choose a family or caregiver…</option>
                    {families.map((f) => (
                      <option key={`family:${f.id}`} value={`family:${f.id}`}>
                        {f.label}
                      </option>
                    ))}
                    {(caregiverList ?? []).map((c) => (
                      <option key={`caregiver:${c.id}`} value={`caregiver:${c.id}`}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!starting}
                    onClick={() => {
                      const [kind, id] = starting.split(":");
                      openThread({ kind: kind as Thread["kind"], id });
                    }}
                    className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    Start chat
                  </button>
                </div>
              </div>
              <p className="px-4 pt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
                Families
              </p>
              <ul>
                {shownFamilies.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => openThread({ kind: "family", id: f.id })}
                      className={`min-h-11 w-full px-4 py-4 text-left text-sm hover:bg-secondary ${
                        thread.kind === "family" && thread.id === f.id ? "bg-secondary font-medium" : ""
                      }`}
                    >
                      {f.label}
                    </button>
                  </li>
                ))}
                {shownFamilies.length === 0 && (
                  <li className="px-4 py-4 text-sm text-muted-foreground">
                    {q ? "No matching families" : "No families yet"}
                  </li>
                )}
              </ul>
              <p className="border-t border-border px-4 pt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
                Caregivers
              </p>
              <ul>
                {shownCaregivers.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => openThread({ kind: "caregiver", id: c.id })}
                      className={`min-h-11 w-full px-4 py-4 text-left text-sm hover:bg-secondary ${
                        thread.kind === "caregiver" && thread.id === c.id ? "bg-secondary font-medium" : ""
                      }`}
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
                {shownCaregivers.length === 0 && (
                  <li className="px-4 py-4 text-sm text-muted-foreground">
                    {q ? "No matching caregivers" : "No caregivers yet"}
                  </li>
                )}
              </ul>
            </aside>
          )}

          <section className="flex min-h-[50vh] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messagesPending && <AsyncSkeleton shape="chat" count={4} />}
              {!messagesPending && messagesError && (
                <AsyncError what="these messages" error={messagesError} onRetry={() => refetchMessages()} />
              )}
              {!messagesPending && !messagesError && (messages ?? []).length === 0 && (
                <AsyncEmpty
                  title="No messages yet"
                  hint="Say hello — messages you send appear here right away."
                />
              )}
              {!messagesPending && !messagesError && (messages ?? []).map((m) => {
                const mine = m.sender_profile_id === uid;
                return (
                  <div key={m.id} className={`max-w-[80%] ${mine ? "ml-auto text-right" : ""}`}>
                    {!mine && (
                      <p className="mb-1 text-[11px] text-muted-foreground">{nameOf(m.sender_profile_id)}</p>
                    )}
                    <div
                      className={`inline-block rounded-2xl px-4 py-2 text-left text-sm ${
                        mine ? "bg-primary text-primary-foreground" : "bg-secondary"
                      }`}
                    >
                      {m.content}
                      <p className="mt-1 text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        {mine && m.read_at ? " · Read" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!messagesPending && !messagesError && (messages ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No messages yet — send the first one to start the conversation.
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (body.trim()) send.mutate();
              }}
              className="flex gap-2 border-t border-border p-4"
            >
              <input
                ref={composerRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message…"
                aria-label="Message"
                className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm"
              />
              <button
                disabled={send.isPending || !body.trim()}
                className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
              >
                {send.isPending ? "Sending…" : "Send"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
