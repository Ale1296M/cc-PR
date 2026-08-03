import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CaregiverAvatar } from "./CaregiverAvatar";
import {
  SHIFT_STATUSES,
  formatDay,
  formatTime,
  statusClass,
  statusLabel,
  todayISO,
} from "./shift-utils";

type CaregiverRow = {
  id: string;
  active: boolean;
  background_check_status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

export function AdminShifts({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [familyId, setFamilyId] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { data: families } = useQuery({
    queryKey: ["admin-families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("id, status, profiles(full_name), subscription_tiers(name)")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recipients } = useQuery({
    queryKey: ["admin-recipients", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_recipients")
        .select("id, full_name")
        .eq("family_id", familyId)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const recipientIds = useMemo(() => (recipients ?? []).map((r) => r.id), [recipients]);

  const { data: shifts } = useQuery({
    queryKey: ["admin-shifts", recipientIds],
    enabled: recipientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, care_recipient_id, care_recipients(full_name), caregivers(id, profiles(full_name, avatar_url))",
        )
        .in("care_recipient_id", recipientIds)
        .order("scheduled_date")
        .order("scheduled_start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: caregivers } = useQuery({
    queryKey: ["admin-caregivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caregivers")
        .select("id, active, background_check_status, profiles(full_name, avatar_url)")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as CaregiverRow[];
    },
  });

  const updateShift = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("care_shifts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shifts"] }),
  });

  const removeShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("care_shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shifts"] }),
  });

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Scheduling</p>
          <h1 className="mt-1 font-display text-4xl">Assign shifts</h1>
        </div>
        <button
          onClick={() => setShowNew(true)}
          disabled={!familyId}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> New shift
        </button>
      </header>

      <label className="mb-6 block max-w-md">
        <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
          Family
        </span>
        <select
          value={familyId}
          onChange={(e) => setFamilyId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a family…</option>
          {(families ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {(f.profiles as unknown as { full_name: string | null } | null)?.full_name ??
                "Unnamed family"}
              {" · "}
              {(f.subscription_tiers as unknown as { name: string } | null)?.name ?? "no plan"}
              {f.status !== "active" ? ` (${f.status})` : ""}
            </option>
          ))}
        </select>
      </label>

      {!familyId && (
        <p className="card-soft p-6 text-sm text-muted-foreground">
          Choose a family to see and schedule shifts for their care recipients.
        </p>
      )}

      {familyId && (recipients ?? []).length === 0 && (
        <p className="card-soft p-6 text-sm text-muted-foreground">
          This family has no care recipients yet.
        </p>
      )}

      {familyId && (shifts ?? []).length === 0 && (recipients ?? []).length > 0 && (
        <p className="card-soft p-6 text-sm text-muted-foreground">
          No shifts scheduled for this family yet.
        </p>
      )}

      <div className="card-soft divide-y divide-border">
        {(shifts ?? []).map((s) => {
          const cg = s.caregivers as unknown as {
            id: string;
            profiles: { full_name: string | null; avatar_url: string | null } | null;
          } | null;
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="w-44 text-sm">
                <p className="font-medium">{formatDay(s.scheduled_date)}</p>
                <p className="text-muted-foreground">
                  {formatTime(s.scheduled_start_time)} – {formatTime(s.scheduled_end_time)}
                </p>
              </div>
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  {(s.care_recipients as unknown as { full_name: string } | null)?.full_name}
                </p>
                {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
              </div>
              <select
                value={cg?.id ?? ""}
                onChange={(e) =>
                  updateShift.mutate({
                    id: s.id,
                    patch: { caregiver_id: e.target.value || null },
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="">Unassigned</option>
                {(caregivers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.profiles?.full_name ?? "Caregiver"}
                  </option>
                ))}
              </select>
              <select
                value={s.status}
                onChange={(e) => updateShift.mutate({ id: s.id, patch: { status: e.target.value } })}
                className={`rounded-full px-3 py-1 text-xs ${statusClass(s.status)}`}
              >
                {SHIFT_STATUSES.map((o) => (
                  <option key={o} value={o}>
                    {statusLabel(o)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeShift.mutate(s.id)}
                aria-label="Delete shift"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-2xl">Caregiver roster</h2>
        <div className="card-soft divide-y divide-border">
          {(caregivers ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4">
              <CaregiverAvatar
                fullName={c.profiles?.full_name}
                avatarUrl={c.profiles?.avatar_url}
                size={36}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{c.profiles?.full_name ?? "Caregiver"}</p>
                <p className="text-xs text-muted-foreground">
                  Background check: {c.background_check_status.replace("_", " ")}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {c.active ? "active" : "inactive"}
              </span>
            </div>
          ))}
          {(caregivers ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No caregivers yet.</p>
          )}
        </div>
      </section>

      {showNew && (
        <NewShiftDialog
          adminId={adminId}
          recipients={recipients ?? []}
          caregivers={caregivers ?? []}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function NewShiftDialog({
  adminId,
  recipients,
  caregivers,
  onClose,
}: {
  adminId: string;
  recipients: Array<{ id: string; full_name: string }>;
  caregivers: CaregiverRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [caregiverId, setCaregiverId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("care_shifts").insert({
        care_recipient_id: recipientId,
        caregiver_id: caregiverId || null,
        scheduled_date: date,
        scheduled_start_time: start,
        scheduled_end_time: end,
        notes: notes || null,
        created_by_admin_id: adminId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shifts"] });
      onClose();
    },
  });

  const invalid = !recipientId || !date || !start || !end || end <= start;

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="mb-4 font-display text-2xl">New shift</h3>
        <div className="space-y-3">
          <Field label="Care recipient">
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Caregiver">
            <select
              value={caregiverId}
              onChange={(e) => setCaregiverId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {caregivers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.profiles?.full_name ?? "Caregiver"}
                  {c.background_check_status === "cleared" ? "" : " · check pending"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Notes">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>
        {end <= start && (
          <p className="mt-3 text-xs text-destructive">End time must be after the start time.</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={invalid || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}