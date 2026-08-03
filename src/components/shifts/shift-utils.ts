export const SHIFT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export function statusLabel(status: string) {
  return status === "no_show" ? "no show" : status;
}

export function statusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-primary/10 text-primary";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    case "no_show":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-gold/25 text-gold-foreground";
  }
}

/** "14:30:00" -> "2:30 PM" */
export function formatTime(value: string) {
  const [h, m] = value.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
}

export function formatDay(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function firstName(fullName: string | null | undefined) {
  return (fullName ?? "").trim().split(/\s+/)[0] || "Caregiver";
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function initials(fullName: string | null | undefined) {
  return firstName(fullName).slice(0, 1).toUpperCase();
}