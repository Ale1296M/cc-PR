import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SHIFT_STATUSES, statusLabel } from "@/components/shifts/shift-utils";
import { ErrorState, LoadingState } from "@/components/ui/states";
import ShiftDialog from "@/components/shifts/ShiftDialog";
import {
  STATUS_STYLE,
  isoDate,
  isoTime,
  toDate,
  type ShiftRow,
} from "@/components/shifts/shift-types";
import "./calendar-theme.css";

const DAY_START = 6; // 6:00
const DAY_END = 22; // 22:00
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
const PX_PER_HOUR = 56;

type ShiftEvent = { id: string; title: string; start: Date; end: Date; resource: ShiftRow };

export default function AdminShiftCalendar({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [creatingAt, setCreatingAt] = useState<{ start: Date; end: Date } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

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

  function dropOn(day: Date, hour: number | null) {
    const ev = events.find((e) => e.id === dragId);
    setDragId(null);
    if (!ev) return;
    const minutes = Math.max(30, differenceInMinutes(ev.end, ev.start));
    const start = new Date(day);
    if (hour === null) {
      start.setHours(ev.start.getHours(), ev.start.getMinutes(), 0, 0);
    } else {
      start.setHours(hour, 0, 0, 0);
    }
    const end = new Date(start.getTime() + minutes * 60_000);
    if (isoDate(start) === ev.resource.scheduled_date && isoTime(start) === ev.resource.scheduled_start_time)
      return;
    reschedule.mutate({ id: ev.id, start, end });
  }

  if (isPending) return <LoadingState label="Loading the calendar…" />;
  if (error) return <ErrorState what="the schedule" error={error} onRetry={() => refetch()} />;

  const weekStart = startOfWeek(cursor, { weekStartsOn: 0 });
  const step = (dir: number) =>
    setCursor((c) => (view === "week" ? addWeeks(c, dir) : addMonths(c, dir)));

  return (
    <div className="kindred-calendar card-soft p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1.5">
          <NavBtn onClick={() => step(-1)}>Back</NavBtn>
          <NavBtn onClick={() => setCursor(new Date())}>Today</NavBtn>
          <NavBtn onClick={() => step(1)}>Next</NavBtn>
        </div>
        <p className="mx-auto font-display text-xl">
          {view === "week"
            ? `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
            : format(cursor, "MMMM yyyy")}
        </p>
        <div className="inline-flex gap-1.5">
          <NavBtn active={view === "week"} onClick={() => setView("week")}>Week</NavBtn>
          <NavBtn active={view === "month"} onClick={() => setView("month")}>Month</NavBtn>
        </div>
      </div>

      {view === "week" ? (
        <WeekGrid
          weekStart={weekStart}
          events={events}
          onDragStart={setDragId}
          onDrop={dropOn}
          onSelectEvent={(e) => setEditing(e.resource)}
          onSelectSlot={(start, end) => setCreatingAt({ start, end })}
        />
      ) : (
        <MonthGrid
          cursor={cursor}
          events={events}
          onDragStart={setDragId}
          onDrop={(day) => dropOn(day, null)}
          onSelectEvent={(e) => setEditing(e.resource)}
          onSelectSlot={(start, end) => setCreatingAt({ start, end })}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
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

function NavBtn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-full border px-4 text-sm ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-foreground hover:bg-secondary/55"
      }`}
    >
      {children}
    </button>
  );
}

function EventBlock({
  event,
  style,
  onDragStart,
  onClick,
}: {
  event: ShiftEvent;
  style?: React.CSSProperties;
  onDragStart: (id: string) => void;
  onClick: () => void;
}) {
  const s = STATUS_STYLE[event.resource.status] ?? STATUS_STYLE.scheduled;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", event.id);
        onDragStart(event.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={event.title}
      className="kindred-event"
      style={{ ...style, backgroundColor: s.bg, color: s.fg }}
    >
      <span className="block truncate font-medium">{format(event.start, "h:mm a")}</span>
      <span className="block truncate">{event.title}</span>
    </button>
  );
}

function WeekGrid({
  weekStart,
  events,
  onDragStart,
  onDrop,
  onSelectEvent,
  onSelectSlot,
}: {
  weekStart: Date;
  events: ShiftEvent[];
  onDragStart: (id: string) => void;
  onDrop: (day: Date, hour: number) => void;
  onSelectEvent: (e: ShiftEvent) => void;
  onSelectSlot: (start: Date, end: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="kindred-grid overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border">
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className="kindred-col-head">
              <span className="block">{format(d, "EEE")}</span>
              <span className={isSameDay(d, new Date()) ? "text-primary" : ""}>{format(d, "d")}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div>
            {HOURS.map((h) => (
              <div key={h} className="kindred-hour-label" style={{ height: PX_PER_HOUR }}>
                {format(new Date(2020, 0, 1, h), "h a")}
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d.toISOString()} className="kindred-day-col">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="kindred-slot"
                  style={{ height: PX_PER_HOUR }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDrop(d, h);
                  }}
                  onClick={() => {
                    const start = new Date(d);
                    start.setHours(h, 0, 0, 0);
                    onSelectSlot(start, new Date(start.getTime() + 60 * 60_000));
                  }}
                />
              ))}
              {events
                .filter((e) => isSameDay(e.start, d))
                .map((e) => {
                  const top =
                    (e.start.getHours() + e.start.getMinutes() / 60 - DAY_START) * PX_PER_HOUR;
                  const height = Math.max(
                    24,
                    (differenceInMinutes(e.end, e.start) / 60) * PX_PER_HOUR - 2,
                  );
                  return (
                    <EventBlock
                      key={e.id}
                      event={e}
                      onDragStart={onDragStart}
                      onClick={() => onSelectEvent(e)}
                      style={{ position: "absolute", top: Math.max(0, top), height, left: 2, right: 2 }}
                    />
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  cursor,
  events,
  onDragStart,
  onDrop,
  onSelectEvent,
  onSelectSlot,
}: {
  cursor: Date;
  events: ShiftEvent[];
  onDragStart: (id: string) => void;
  onDrop: (day: Date) => void;
  onSelectEvent: (e: ShiftEvent) => void;
  onSelectSlot: (start: Date, end: Date) => void;
}) {
  const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const total = Math.ceil((differenceInMinutes(endOfMonth(cursor), first) / 1440 + 1) / 7) * 7;
  const days = Array.from({ length: total }, (_, i) => addDays(first, i));
  return (
    <div className="kindred-grid">
      <div className="grid grid-cols-7 border-b border-border">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="kindred-col-head">
            {format(d, "EEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={`kindred-month-cell ${isSameMonth(d, cursor) ? "" : "kindred-off-range"}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(d);
            }}
            onClick={() => {
              const start = new Date(d);
              start.setHours(9, 0, 0, 0);
              onSelectSlot(start, new Date(start.getTime() + 60 * 60_000));
            }}
          >
            <span className={`kindred-date ${isSameDay(d, new Date()) ? "text-primary" : ""}`}>
              {format(d, "d")}
            </span>
            <div className="mt-1 space-y-1">
              {events
                .filter((e) => isSameDay(e.start, d))
                .map((e) => (
                  <EventBlock
                    key={e.id}
                    event={e}
                    onDragStart={onDragStart}
                    onClick={() => onSelectEvent(e)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
