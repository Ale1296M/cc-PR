import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SHIFT_STATUSES, statusLabel } from "@/components/shifts/shift-utils";
import type { ShiftRow } from "@/components/shifts/shift-types";
import { isoDate } from "@/components/shifts/shift-types";

export default function ShiftDialog({
  adminId,
  shift,
  slot,
  onClose,
}: {
  adminId: string;
  shift: ShiftRow | null;
  slot: { start: Date; end: Date } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [recipientId, setRecipientId] = useState(shift?.care_recipient_id ?? "");
  const [caregiverId, setCaregiverId] = useState(shift?.caregiver_id ?? "");
  const [date, setDate] = useState(shift?.scheduled_date ?? (slot ? isoDate(slot.start) : ""));
  const [start, setStart] = useState(
    shift ? shift.scheduled_start_time.slice(0, 5) : slot ? format(slot.start, "HH:mm") : "",
  );
  const [end, setEnd] = useState(
    shift ? shift.scheduled_end_time.slice(0, 5) : slot ? format(slot.end, "HH:mm") : "",
  );
  const [status, setStatus] = useState(shift?.status ?? "scheduled");
  const [notes, setNotes] = useState(shift?.notes ?? "");

  const { data: recipients } = useQuery({
    queryKey: ["all-recipients"],
    queryFn: async () => {
      const { data } = await supabase.from("care_recipients").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });
  const { data: caregivers } = useQuery({
    queryKey: ["caregivers"],
    queryFn: async () => {
      const { data } = await supabase.from("caregivers").select("id, profiles(full_name)").eq("active", true);
      return (data ?? []).map((r) => ({
        id: r.id,
        name: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? "Caregiver",
      }));
    },
  });

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["shifts"] });
    onClose();
  };
  const fail = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Something went wrong — try again.");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        care_recipient_id: recipientId,
        caregiver_id: caregiverId || null,
        scheduled_date: date,
        scheduled_start_time: `${start}:00`,
        scheduled_end_time: `${end}:00`,
        status,
        notes: notes || null,
      };
      const { error } = shift
        ? await supabase.from("care_shifts").update(payload).eq("id", shift.id)
        : await supabase.from("care_shifts").insert({ ...payload, created_by_admin_id: adminId });
      if (error) throw error;
    },
    onSuccess: () => done(shift ? "Shift updated" : "Shift created"),
    onError: fail,
  });

  const cancelShift = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("care_shifts")
        .update({ status: "cancelled" })
        .eq("id", shift!.id);
      if (error) throw error;
    },
    onSuccess: () => done("Shift cancelled"),
    onError: fail,
  });

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/30 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="mb-4 font-display text-2xl">{shift ? "Edit shift" : "New shift"}</h3>
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
          <Select label="Status" value={status} onChange={setStatus}>
            {SHIFT_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </Select>
          <TextField label="Notes" value={notes} onChange={setNotes} />
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {shift && shift.status !== "cancelled" && (
            <button
              onClick={() => cancelShift.mutate()}
              disabled={cancelShift.isPending}
              className="mr-auto min-h-10 rounded-full border border-destructive px-4 text-sm text-destructive disabled:opacity-50"
            >
              Cancel shift
            </button>
          )}
          <button onClick={onClose} className="min-h-10 rounded-full border border-border px-4 text-sm">
            Close
          </button>
          <button
            disabled={!recipientId || !date || !start || !end || save.isPending}
            onClick={() => save.mutate()}
            className="min-h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
          >
            {shift ? "Save" : "Create"}
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
