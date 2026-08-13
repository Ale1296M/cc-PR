import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import withDragAndDrop, { type withDragAndDropProps } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SHIFT_STATUSES, statusLabel } from "@/components/shifts/shift-utils";
import { ErrorState, LoadingState } from "@/components/ui/states";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./calendar-theme.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

type ShiftRow = {
  id: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  status: string;
  notes: string | null;
  caregiver_id: string | null;
  care_recipient_id: string;
  care_recipients: { full_name: string } | null;
  caregivers: { profiles: { full_name: string | null } | null } | null;
};

type ShiftEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ShiftRow;
};

const DnDCalendar = withDragAndDrop<ShiftEvent, object>(Calendar as never);

function toDate(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 8)}`);
}
function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function isoTime(d: Date) {
  return format(d, "HH:mm:ss");
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  scheduled: { bg: "color-mix(in oklab, var(--color-gold) 45%, var(--color-card))", fg: "var(--color-gold-foreground)" },
  completed: { bg: "color-mix(in oklab, var(--color-primary) 22%, var(--color-card))", fg: "var(--color-foreground)" },
  cancelled: { bg: "var(--color-muted)", fg: "var(--color-muted-foreground)" },
  no_show: { bg: "color-mix(in oklab, var(--color-destructive) 20%, var(--color-card))", fg: "var(--color-destructive)" },
};

export default function AdminShiftCalendar({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [creatingAt, setCreatingAt] = useState<{ start: Date; end: Date } | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, caregiver_id, care_recipient_id, care_recipients(full_name), caregivers(profiles(full_name))",
        )
        .order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as unknown as ShiftRow[];
    },
  });

  const events = useMemo<ShiftEvent[]>(
    () =>
      (data ?? []).map((s) => ({
        id: s.id,
        title: `${s.care_recipients?.full_name ?? "Care recipient"} · ${
          s.caregivers?.profiles?.full_name ?? "Unassigned"
        }`,
        start: toDate(s.scheduled_date, s.scheduled_start_time),
        end: toDate(s.scheduled_date, s.scheduled_end_time),
        resource: s,
      })),
    [data],
  );

  const reschedule = useMutation({
    mutationFn: async ({ id, start, end }: { id: string; start: Date; end: Date }) => {
      const { error } = await supabase
        .from("care_shifts")
        .update({
          scheduled_date: isoDate(start),
          scheduled_start_time: isoTime(start),
          scheduled_end_time: isoTime(end),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift rescheduled");
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't reschedule that shift — try again."),
  });

  const onMove: withDragAndDropProps<ShiftEvent, object>["onEventDrop"] = ({ event, start, end }) =>
    reschedule.mutate({ id: event.id, start: new Date(start), end: new Date(end) });

  if (isPending) return <LoadingState label="Loading the calendar…" />;
  if (error) return <ErrorState what="the schedule" error={error} onRetry={() => refetch()} />;

  return (
    <div className="kindred-calendar card-soft p-4">
      <DnDCalendar
        localizer={localizer}
        events={events}
        view={view}
        onView={(v) => setView(v)}
        date={date}
        onNavigate={(d) => setDate(d)}
        views={["week", "month"]}
        popup
        selectable
        resizable
        step={30}
        timeslots={2}
        style={{ height: 680 }}
        onEventDrop={onMove}
        onEventResize={onMove}
        onSelectEvent={(e) => setEditing(e.resource)}
        onSelectSlot={({ start, end }) =>
          setCreatingAt({ start: new Date(start), end: new Date(end) })
        }
        eventPropGetter={(e) => {
          const s = STATUS_STYLE[e.resource.status] ?? STATUS_STYLE.scheduled;
          return { style: { backgroundColor: s.bg, color: s.fg } };
        }}
      />

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {SHIFT_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: STATUS_STYLE[s].bg }}
            />
            {statusLabel(s)}
          </span>
        ))}
        <span>Drag a shift to reschedule · click an empty slot to add one</span>
      </div>

      {(editing || creatingAt) && (
        <ShiftDialog
          adminId={adminId}
          shift={editing}
          slot={creatingAt}
          onClose={() => {
            setEditing(null);
            setCreatingAt(null);
          }}
        />
      )}
    </div>
  );
}

function ShiftDialog({
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
