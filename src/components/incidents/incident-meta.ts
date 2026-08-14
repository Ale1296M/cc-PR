export const INCIDENT_TYPES = [
  { value: "fall", label: "Fall" },
  { value: "medication_error", label: "Medication error" },
  { value: "injury", label: "Injury" },
  { value: "hospitalization", label: "Hospitalization" },
  { value: "behavioral", label: "Behavioral" },
  { value: "property", label: "Property" },
  { value: "other", label: "Other" },
] as const;

export const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const STATUSES = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number]["value"];
export type Severity = (typeof SEVERITIES)[number]["value"];
export type Status = (typeof STATUSES)[number]["value"];

export const typeLabel = (v: string) =>
  INCIDENT_TYPES.find((t) => t.value === v)?.label ?? v;
export const severityLabel = (v: string) => SEVERITIES.find((s) => s.value === v)?.label ?? v;
export const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;

export const severityClass: Record<string, string> = {
  low: "bg-secondary text-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-destructive/15 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

export const statusClass: Record<string, string> = {
  open: "bg-destructive/15 text-destructive",
  under_review: "bg-secondary text-secondary-foreground",
  resolved: "bg-primary/15 text-primary",
};

export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatStamp(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}