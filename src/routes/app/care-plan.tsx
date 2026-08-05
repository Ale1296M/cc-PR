import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/app/care-plan")({
  component: CarePlanPage,
  head: () => ({
    meta: [
      { title: "Care plan checklists · Kindred" },
      { name: "description", content: "Build and complete per-visit care checklists for each care recipient." },
      { property: "og:title", content: "Care plan checklists · Kindred" },
      { property: "og:description", content: "Build and complete per-visit care checklists for each care recipient." },
    ],
  }),
});

const FREQUENCIES = [
  { value: "every_visit", label: "Every visit" },
  { value: "weekly", label: "Weekly" },
  { value: "as_needed", label: "As needed" },
] as const;

const freqLabel = (f: string) => FREQUENCIES.find((x) => x.value === f)?.label ?? f;

function useRecipients() {
  return useQuery({
    queryKey: ["cp-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_recipients")
        .select("id, full_name, city")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useItems(recipientId: string, onlyActive: boolean) {
  return useQuery({
    queryKey: ["cp-items", recipientId, onlyActive],
    enabled: !!recipientId,
    queryFn: async () => {
      let q = supabase
        .from("care_plan_items")
        .select("id, task_description, category, frequency, active, care_recipient_id")
        .eq("care_recipient_id", recipientId);
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q.order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function CarePlanPage() {
  const { role, loading } = useAuth();
  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (role === "admin") return <AdminCarePlan />;
  if (role === "caregiver") return <CaregiverChecklist />;
  return <FamilyCarePlan />;
}

/* ---------------- Admin ---------------- */

function AdminCarePlan() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: recipients } = useRecipients();
  const [recipientId, setRecipientId] = useState("");
  const active = recipientId || recipients?.[0]?.id || "";
  const { data: items } = useItems(active, false);

  const [task, setTask] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState<string>("every_visit");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cp-items"] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("care_plan_items").insert({
        care_recipient_id: active,
        task_description: task,
        category: category || null,
        frequency,
        created_by_admin_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setTask(""); setCategory(""); invalidate(); },
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; fields: Record<string, unknown> }) => {
      const { error } = await supabase.from("care_plan_items").update(p.fields).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("care_plan_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Care plan</p>
        <h1 className="mt-1 font-display text-4xl">Checklist builder</h1>
      </header>

      <select
        value={active}
        onChange={(e) => setRecipientId(e.target.value)}
        className="mb-6 w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {(recipients ?? []).length === 0 && <option value="">No care recipients yet</option>}
        {(recipients ?? []).map((r) => (
          <option key={r.id} value={r.id}>{r.full_name}{r.city ? ` · ${r.city}` : ""}</option>
        ))}
      </select>

      <div className="card-soft mb-6 divide-y divide-border">
        {(items ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No checklist items yet.</p>
        )}
        {(items ?? []).map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <input
                defaultValue={item.task_description}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== item.task_description) update.mutate({ id: item.id, fields: { task_description: v } });
                }}
                className={`w-full bg-transparent text-sm font-medium outline-none ${item.active ? "" : "line-through opacity-60"}`}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  defaultValue={item.category ?? ""}
                  placeholder="Category"
                  onBlur={(e) => update.mutate({ id: item.id, fields: { category: e.target.value || null } })}
                  className="w-36 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
                <select
                  value={item.frequency}
                  onChange={(e) => update.mutate({ id: item.id, fields: { frequency: e.target.value } })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={item.active}
                onChange={(e) => update.mutate({ id: item.id, fields: { active: e.target.checked } })}
              />
              Active
            </label>
            <button
              onClick={() => remove.mutate(item.id)}
              className="rounded-full border border-border p-2 text-muted-foreground hover:text-destructive"
              aria-label="Delete item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (task && active) add.mutate(); }}
        className="card-soft flex flex-wrap items-center gap-2 p-4"
      >
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Task description…"
          className="min-w-[12rem] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button
          disabled={!task || !active || add.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </form>
    </div>
  );
}

/* ---------------- Caregiver ---------------- */

function CaregiverChecklist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [recipientId, setRecipientId] = useState("");

  const { data: shifts } = useQuery({
    queryKey: ["cp-today-shifts", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data: me } = await supabase
        .from("caregivers").select("id").eq("profile_id", user!.id).maybeSingle();
      if (!me) return [];
      const { data, error } = await supabase
        .from("care_shifts")
        .select("id, scheduled_start_time, scheduled_end_time, care_recipient_id, care_recipients(full_name)")
        .eq("caregiver_id", me.id)
        .eq("scheduled_date", today)
        .order("scheduled_start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = recipientId || shifts?.[0]?.care_recipient_id || "";
  const { data: items } = useItems(active, true);

  const { data: visit } = useQuery({
    queryKey: ["cp-visit", active, user?.id],
    enabled: !!active && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("visit_logs")
        .select("id, clock_in, clock_out")
        .eq("care_recipient_id", active)
        .eq("caregiver_id", user!.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .maybeSingle();
      return data;
    },
  });

  const { data: completions } = useQuery({
    queryKey: ["cp-completions", visit?.id],
    enabled: !!visit,
    queryFn: async () => {
      const { data } = await supabase
        .from("care_plan_completions")
        .select("id, care_plan_item_id, completed, notes")
        .eq("visit_log_id", visit!.id);
      return data ?? [];
    },
  });

  const startVisit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visit_logs").insert({
        care_recipient_id: active,
        caregiver_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cp-visit"] }),
  });

  const endVisit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visit_logs")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", visit!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cp-visit"] }),
  });

  const toggle = useMutation({
    mutationFn: async (p: { itemId: string; completed: boolean; notes?: string | null }) => {
      const { error } = await supabase
        .from("care_plan_completions")
        .upsert(
          {
            care_plan_item_id: p.itemId,
            visit_log_id: visit!.id,
            completed: p.completed,
            ...(p.notes !== undefined ? { notes: p.notes } : {}),
          },
          { onConflict: "care_plan_item_id,visit_log_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cp-completions"] }),
  });

  const completionFor = (itemId: string) =>
    (completions ?? []).find((c) => c.care_plan_item_id === itemId);

  const done = (items ?? []).filter((i) => completionFor(i.id)?.completed).length;

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Today’s visit</p>
        <h1 className="mt-1 font-display text-4xl">Care checklist</h1>
      </header>

      {(shifts ?? []).length === 0 ? (
        <p className="card-soft p-6 text-sm text-muted-foreground">No shifts scheduled for you today.</p>
      ) : (
        <select
          value={active}
          onChange={(e) => setRecipientId(e.target.value)}
          className="mb-6 w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {(shifts ?? []).map((s) => (
            <option key={s.id} value={s.care_recipient_id}>
              {(s.care_recipients as unknown as { full_name: string } | null)?.full_name ?? "Care recipient"}
              {` · ${s.scheduled_start_time.slice(0, 5)}–${s.scheduled_end_time.slice(0, 5)}`}
            </option>
          ))}
        </select>
      )}

      {active && !visit && (
        <button
          onClick={() => startVisit.mutate()}
          className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Start visit to use the checklist
        </button>
      )}

      {visit && (
        <>
          <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Started {new Date(visit.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span>{done}/{(items ?? []).length} checked</span>
          </div>

          <div className="card-soft divide-y divide-border">
            {(items ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No active checklist items for this care recipient.</p>
            )}
            {(items ?? []).map((item) => {
              const c = completionFor(item.id);
              const checked = !!c?.completed;
              return (
                <div key={item.id} className="p-4">
                  <button
                    onClick={() => toggle.mutate({ itemId: item.id, completed: !checked })}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span>
                      <span className={`block text-sm font-medium ${checked ? "line-through opacity-60" : ""}`}>
                        {item.task_description}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {freqLabel(item.frequency)}{item.category ? ` · ${item.category}` : ""}
                      </span>
                    </span>
                  </button>
                  <input
                    defaultValue={c?.notes ?? ""}
                    placeholder="Notes…"
                    onBlur={(e) =>
                      toggle.mutate({ itemId: item.id, completed: checked, notes: e.target.value || null })
                    }
                    className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>
              );
            })}
          </div>

          <button
            onClick={() => endVisit.mutate()}
            className="mt-6 rounded-full border border-border px-5 py-2 text-sm"
          >
            End visit
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------- Family / read-only ---------------- */

function FamilyCarePlan() {
  const { data: recipients } = useRecipients();
  const [recipientId, setRecipientId] = useState("");
  const active = recipientId || recipients?.[0]?.id || "";
  const { data: items } = useItems(active, true);

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Care plan</p>
        <h1 className="mt-1 font-display text-4xl">Checklist</h1>
      </header>
      <select
        value={active}
        onChange={(e) => setRecipientId(e.target.value)}
        className="mb-6 w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {(recipients ?? []).length === 0 && <option value="">No care recipients</option>}
        {(recipients ?? []).map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
      </select>
      <div className="card-soft divide-y divide-border">
        {(items ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No checklist items yet.</p>
        )}
        {(items ?? []).map((i) => (
          <div key={i.id} className="p-4">
            <p className="text-sm font-medium">{i.task_description}</p>
            <p className="text-xs text-muted-foreground">
              {freqLabel(i.frequency)}{i.category ? ` · ${i.category}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/care-plan')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/app/care-plan"!</div>
}
