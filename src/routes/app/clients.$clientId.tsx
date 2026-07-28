import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/app/clients/$clientId")({
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [newTask, setNewTask] = useState("");

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: careItems } = useQuery({
    queryKey: ["care-items", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("care_plan_items")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: visits } = useQuery({
    queryKey: ["visits", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("visit_logs")
        .select("id, clock_in, clock_out, notes, mood, caregiver_id, profiles:caregiver_id(full_name)")
        .eq("client_id", clientId)
        .order("clock_in", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("care_plan_items").insert({
        client_id: clientId,
        title: newTask,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTask("");
      qc.invalidateQueries({ queryKey: ["care-items", clientId] });
    },
  });

  if (!client) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div>
      <Link to="/app/clients" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <header className="card-soft mb-8 p-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Client</p>
        <h1 className="mt-1 font-display text-4xl">{client.full_name}</h1>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {client.address && <p>📍 {client.address}</p>}
          {client.date_of_birth && <p>🎂 {new Date(client.date_of_birth).toLocaleDateString()}</p>}
          {client.primary_contact_name && (
            <p>👥 {client.primary_contact_name} {client.primary_contact_phone ? `· ${client.primary_contact_phone}` : ""}</p>
          )}
        </div>
        {client.notes && <p className="mt-4 text-sm">{client.notes}</p>}
      </header>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-2xl">Care plan</h2>
        <div className="card-soft divide-y divide-border">
          {(careItems ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No care items yet.</p>
          )}
          {(careItems ?? []).map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-4">
              <span className="mt-1 grid h-5 w-5 place-items-center rounded-full border border-primary/50 text-primary">
                <Check className="h-3 w-3" />
              </span>
              <div>
                <p className="font-medium">{item.title}</p>
                {item.frequency && (
                  <p className="text-xs text-muted-foreground">{item.frequency}</p>
                )}
              </div>
            </div>
          ))}
          {(role === "admin" || role === "caregiver") && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (newTask) addTask.mutate(); }}
              className="flex items-center gap-2 p-3"
            >
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Add a care item…"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button className="rounded-full bg-primary p-2 text-primary-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">Recent visits</h2>
        <div className="card-soft divide-y divide-border">
          {(visits ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No visits logged yet.</p>
          )}
          {(visits ?? []).map((v) => (
            <div key={v.id} className="p-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium">
                  {new Date(v.clock_in).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {v.mood && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs">{v.mood}</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                by {(v.profiles as unknown as { full_name: string } | null)?.full_name ?? "Caregiver"}
                {v.clock_out ? ` · ${Math.round((+new Date(v.clock_out) - +new Date(v.clock_in)) / 60000)} min` : " · in progress"}
              </p>
              {v.notes && <p className="mt-2 text-sm">{v.notes}</p>}
            </div>
          ))}
        </div>

        {role === "caregiver" && <ClockInBar clientId={clientId} />}
      </section>
    </div>
  );
}

function ClockInBar({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState("");

  const { data: active } = useQuery({
    queryKey: ["active-visit", clientId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("visit_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("caregiver_id", user!.id)
        .is("clock_out", null)
        .maybeSingle();
      return data;
    },
  });

  const clockIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visit_logs").insert({
        client_id: clientId,
        caregiver_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-visit", clientId, user?.id] }),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visit_logs")
        .update({ clock_out: new Date().toISOString(), notes: notes || null, mood: mood || null })
        .eq("id", active!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setNotes(""); setMood("");
      qc.invalidateQueries({ queryKey: ["active-visit", clientId, user?.id] });
      qc.invalidateQueries({ queryKey: ["visits", clientId] });
    },
  });

  return (
    <div className="card-soft mt-6 p-5">
      <h3 className="font-display text-xl">Log a visit</h3>
      {!active ? (
        <button
          onClick={() => clockIn.mutate()}
          className="mt-3 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Clock in now
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Clocked in at {new Date(active.clock_in).toLocaleTimeString()}
          </p>
          <select
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Mood…</option>
            {["Great", "Okay", "Tired", "Unwell", "Cheerful"].map((m) => <option key={m}>{m}</option>)}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes from the visit…"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => clockOut.mutate()}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
          >
            Clock out & save
          </button>
        </div>
      )}
    </div>
  );
}