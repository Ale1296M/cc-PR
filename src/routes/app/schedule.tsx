import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SHIFT_STATUSES, formatDay, formatTime, statusLabel } from "@/components/shifts/shift-utils";

export const Route = createFileRoute("/app/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const { user, role } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: caregiverId } = useQuery({
    queryKey: ["my-caregiver-id", uid],
    enabled: !!uid && role === "caregiver",
    queryFn: async () => {
      const { data } = await supabase
        .from("caregivers")
        .select("id")
        .eq("profile_id", uid!)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const { data: shifts } = useQuery({
    queryKey: ["shifts", uid, role, caregiverId],
    enabled: !!uid && (role !== "caregiver" || caregiverId !== undefined),
    queryFn: async () => {
      let q = supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, caregiver_id, care_recipients(id, full_name)",
        )
        .order("scheduled_date")
        .order("scheduled_start_time");
      if (role === "caregiver" && caregiverId) q = q.eq("caregiver_id", caregiverId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  type Shift = NonNullable<typeof shifts>[number];
  const groups = (shifts ?? []).reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.scheduled_date] ||= []).push(s);
    return acc;
  }, {});

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("care_shifts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  return (
    <div>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Schedule</p>
          <h1 className="mt-1 font-display text-4xl">Shifts & visits</h1>
        </div>
        {role === "admin" && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New shift
          </button>
        )}
      </header>

      {Object.keys(groups).length === 0 && (
        <p className="card-soft p-6 text-sm text-muted-foreground">
          No shifts yet.{role === "admin" ? " Create the first one." : ""}
        </p>
      )}

      <div className="space-y-8">
        {Object.entries(groups).map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-3 font-display text-xl">{formatDay(day)}</h2>
            <div className="card-soft divide-y divide-border">
              {list.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="w-32 text-sm">
                    {formatTime(s.scheduled_start_time)} – {formatTime(s.scheduled_end_time)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {(s.care_recipients as unknown as { full_name: string } | null)?.full_name}
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
                  </div>
                  <select
                    value={s.status}
                    onChange={(ev) => updateStatus.mutate({ id: s.id, status: ev.target.value })}
                    disabled={role !== "admin" && s.caregiver_id !== caregiverId}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {SHIFT_STATUSES.map((o) => (
                      <option key={o} value={o}>
                        {statusLabel(o)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {showNew && <NewShiftDialog adminId={uid!} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewShiftDialog({ adminId, onClose }: { adminId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [recipientId, setRecipientId] = useState("");
  const [caregiverId, setCaregiverId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  const { data: recipients } = useQuery({
    queryKey: ["all-recipients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("care_recipients")
        .select("id, full_name")
        .order("full_name");
      return data ?? [];
    },
  });
  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("caregivers")
        .select("id, profiles(full_name)")
        .eq("active", true);
      return (data ?? []).map((r) => ({
        id: r.id,
        name: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? "Caregiver",
      }));
    },
  });

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
      qc.invalidateQueries({ queryKey: ["shifts"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="mb-4 font-display text-2xl">New shift</h3>
        <div className="space-y-3">
          <Select label="Care recipient" value={recipientId} onChange={setRecipientId}>
            <option value="">Select…</option>
            {(recipients ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </Select>
          <Select label="Caregiver" value={caregiverId} onChange={setCaregiverId}>
            <option value="">Unassigned</option>
            {(caregivers ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <TextField label="Date" type="date" value={date} onChange={setDate} />
          <TextField label="Start time" type="time" value={start} onChange={setStart} />
          <TextField label="End time" type="time" value={end} onChange={setEnd} />
          <TextField label="Notes" value={notes} onChange={setNotes} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={!recipientId || !date || !start || !end || create.isPending}
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

function TextField({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function Select({
  label, value, onChange, children,
}: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {children}
      </select>
    </label>
  );
}
