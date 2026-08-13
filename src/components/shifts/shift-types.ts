import { format } from "date-fns";

export type ShiftRow = {
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

export function toDate(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 8)}`);
}
export function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}
export function isoTime(d: Date) {
  return format(d, "HH:mm:ss");
}

export const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  scheduled: {
    bg: "color-mix(in oklab, var(--color-gold) 45%, var(--color-card))",
    fg: "var(--color-gold-foreground)",
  },
  completed: {
    bg: "color-mix(in oklab, var(--color-primary) 22%, var(--color-card))",
    fg: "var(--color-foreground)",
  },
  cancelled: { bg: "var(--color-muted)", fg: "var(--color-muted-foreground)" },
  no_show: {
    bg: "color-mix(in oklab, var(--color-destructive) 20%, var(--color-card))",
    fg: "var(--color-destructive)",
  },
};
