import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/app/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const { data: messages } = useQuery({
    queryKey: ["msgs", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order("created_at");
      return data ?? [];
    },
  });

  const peers = useMemo(() => {
    const set = new Set<string>();
    (messages ?? []).forEach((m) => {
      set.add(m.sender_id === uid ? m.recipient_id : m.sender_id);
    });
    return Array.from(set);
  }, [messages, uid]);

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const nameOf = (id: string) =>
    profiles?.find((p) => p.id === id)?.full_name ?? "Someone";

  useEffect(() => {
    if (!activePeer && peers.length) setActivePeer(peers[0]);
  }, [activePeer, peers]);

  const thread = (messages ?? []).filter(
    (m) =>
      (m.sender_id === uid && m.recipient_id === activePeer) ||
      (m.recipient_id === uid && m.sender_id === activePeer),
  );

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("messages").insert({
        sender_id: uid!,
        recipient_id: activePeer!,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["msgs", uid] });
    },
  });

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Messages</p>
        <h1 className="mt-1 font-display text-4xl">Conversations</h1>
      </header>

      <div className="card-soft grid min-h-[60vh] overflow-hidden md:grid-cols-[240px_1fr]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          <NewChat profiles={(profiles ?? []).filter((p) => p.id !== uid)} onPick={setActivePeer} />
          <ul>
            {peers.map((p) => (
              <li key={p}>
                <button
                  onClick={() => setActivePeer(p)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-secondary ${
                    activePeer === p ? "bg-secondary font-medium" : ""
                  }`}
                >
                  {nameOf(p)}
                </button>
              </li>
            ))}
            {peers.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">No conversations yet.</li>
            )}
          </ul>
        </aside>

        <section className="flex min-h-[50vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {thread.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender_id === uid
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary"
                }`}
              >
                {m.body}
                <p className="mt-1 text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            ))}
            {activePeer && thread.length === 0 && (
              <p className="text-sm text-muted-foreground">Say hello.</p>
            )}
          </div>
          {activePeer && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate(); }}
              className="flex gap-2 border-t border-border p-3"
            >
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm"
              />
              <button className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
                Send
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function NewChat({
  profiles, onPick,
}: { profiles: { id: string; full_name: string | null }[]; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-full bg-primary px-3 py-2 text-xs text-primary-foreground"
      >
        {open ? "Close" : "New conversation"}
      </button>
      {open && (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => { onPick(p.id); setOpen(false); }}
                className="w-full rounded px-2 py-1 text-left text-sm hover:bg-secondary"
              >
                {p.full_name ?? "Member"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}