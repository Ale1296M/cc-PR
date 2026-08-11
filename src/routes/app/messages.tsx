import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/app/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Family chat · Kindred" },
      { name: "description", content: "Live chat between a family, their caregivers, and the Kindred care team." },
      { property: "og:title", content: "Family chat · Kindred" },
      { property: "og:description", content: "Live chat between a family, their caregivers, and the Kindred care team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Msg = {
  id: string;
  family_id: string;
  sender_profile_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

function MessagesPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Families reachable to this user (admins: all, family: own, caregivers: assigned)
  const {
    data: recipients,
    isPending: recipientsPending,
    error: recipientsError,
    refetch: refetchRecipients,
  } = useQuery({
    queryKey: ["chat-recipients", uid],
    enabled: !!uid,
    queryFn: async () => {
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

  useEffect(() => {
    if (!familyId && families.length) setFamilyId(families[0].id);
  }, [familyId, families]);

  const {
    data: messages,
    isPending: messagesPending,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["family-messages", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_messages")
        .select("id, family_id, sender_profile_id, content, created_at, read_at")
        .eq("family_id", familyId!)
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
    if (!familyId) return;
    const channel = supabase
      .channel(`family-messages-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_messages", filter: `family_id=eq.${familyId}` },
        () => qc.invalidateQueries({ queryKey: ["family-messages", familyId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!uid || !messages?.length) return;
    const unread = messages.filter((m) => m.sender_profile_id !== uid && !m.read_at).map((m) => m.id);
    if (!unread.length) return;
    void supabase.from("family_messages").update({ read_at: new Date().toISOString() }).in("id", unread);
  }, [messages, uid]);

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("family_messages").insert({
        family_id: familyId!,
        sender_profile_id: uid!,
        content: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["family-messages", familyId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't send that message — try again."),
  });

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Messages</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">Family chat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One thread per family — shared by the family, their caregivers, and the care team.
        </p>
      </header>

      {recipientsPending && <LoadingState label="Loading your conversations…" />}
      {recipientsError && (
        <ErrorState what="your conversations" error={recipientsError} onRetry={() => refetchRecipients()} />
      )}
      {!recipientsPending && !recipientsError && families.length === 0 && (
        <EmptyState
          title="No conversations yet"
          hint="A thread appears here as soon as a family and their care recipient are set up."
        />
      )}

      {families.length > 0 && (
      <div className="card-soft grid min-h-[60vh] overflow-hidden md:grid-cols-[240px_1fr]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          <ul>
            {families.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => setFamilyId(f.id)}
                  className={`min-h-11 w-full px-4 py-3 text-left text-sm hover:bg-secondary ${
                    familyId === f.id ? "bg-secondary font-medium" : ""
                  }`}
                >
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-[50vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {familyId && messagesPending && (
              <p className="text-sm text-muted-foreground">Loading messages…</p>
            )}
            {messagesError && (
              <ErrorState what="these messages" error={messagesError} onRetry={() => refetchMessages()} />
            )}
            {(messages ?? []).map((m) => {
              const mine = m.sender_profile_id === uid;
              return (
                <div key={m.id} className={`max-w-[80%] ${mine ? "ml-auto text-right" : ""}`}>
                  {!mine && (
                    <p className="mb-1 text-[11px] text-muted-foreground">{nameOf(m.sender_profile_id)}</p>
                  )}
                  <div
                    className={`inline-block rounded-2xl px-3 py-2 text-left text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-secondary"
                    }`}
                  >
                    {m.content}
                    <p className="mt-1 text-[10px] opacity-70">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            {familyId && !messagesPending && !messagesError && (messages ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No messages yet — send the first one to start the conversation.
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          {familyId && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (body.trim()) send.mutate();
              }}
              className="flex gap-2 border-t border-border p-3"
            >
              <input
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
          )}
        </section>
      </div>
      )}
    </div>
  );
}
