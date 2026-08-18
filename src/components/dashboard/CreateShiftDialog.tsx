import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { caregivers, clients, matrixShifts, weekDays } from "@/lib/mock/dashboard-data";

/** Existing assignments used for overlap validation (mock source). */
const BUSY: Record<string, { day: string; start: string; end: string }[]> = matrixShifts.reduce(
  (acc, s) => {
    const [start, end] = s.label.split("–");
    const to24 = (t: string) => {
      const m = /^(\d+)(?::(\d+))?(a|p)$/.exec(t.trim());
      if (!m) return "00:00";
      let h = Number(m[1]) % 12;
      if (m[3] === "p") h += 12;
      return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
    };
    (acc[s.caregiverId] ||= []).push({ day: s.day, start: to24(start!), end: to24(end!) });
    return acc;
  },
  {} as Record<string, { day: string; start: string; end: string }[]>,
);

export function CreateShiftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [caregiverId, setCaregiverId] = useState(caregivers[0]!.id);
  const [client, setClient] = useState(clients[0]!);
  const [day, setDay] = useState(weekDays[0]!);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [conflict, setConflict] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  const save = () => {
    setConflict(null);
    setTimeError(null);
    if (end <= start) {
      setTimeError("The end time has to be after the start time.");
      return;
    }
    const clash = (BUSY[caregiverId] ?? []).find(
      (s) => s.day === day && start < s.end && end > s.start,
    );
    if (clash) {
      const who = caregivers.find((c) => c.id === caregiverId)!.name;
      setConflict(`${who} is already assigned ${day} ${clash.start}–${clash.end}. Pick another time or caregiver.`);
      return;
    }
    toast.success("Shift created", { description: `${day} ${start}–${end} · ${client}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a shift</DialogTitle>
          <DialogDescription>Overlapping assignments are blocked automatically.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="shift-caregiver" label="Caregiver" value={caregiverId} onChange={setCaregiverId}>
            {caregivers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
          <SelectField id="shift-client" label="Client" value={client} onChange={setClient}>
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectField>
          <SelectField id="shift-day" label="Day" value={day} onChange={setDay}>
            {weekDays.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="shift-start" className="mb-1.5 block text-sm font-medium">Start</label>
              <input id="shift-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="shift-end" className="mb-1.5 block text-sm font-medium">End</label>
              <input id="shift-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        {timeError && <p className="text-sm text-destructive">{timeError}</p>}
        {conflict && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {conflict}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="min-h-12 sm:min-h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="min-h-12 sm:min-h-11" onClick={save}>Create shift</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputClass =
  "min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {children}
      </select>
    </div>
  );
}