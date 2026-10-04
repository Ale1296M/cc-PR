/** Puerto Rico is UTC-4 all year (no daylight saving). Shift times are stored as PR wall-clock. */
export const PR_TZ = "America/Puerto_Rico";
const PR_OFFSET_HOURS = -4;

export function viewerTimeZone() {
  if (typeof Intl === "undefined") return PR_TZ;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || PR_TZ;
}

/** Convert a PR date ("YYYY-MM-DD") + time ("HH:MM[:SS]") to an absolute Date. */
export function prWallTimeToDate(date: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - PR_OFFSET_HOURS, m));
}

/**
 * When the viewer is outside Puerto Rico time, return their local equivalent
 * (e.g. "2:00 PM EDT"); otherwise null so the UI shows PR time only.
 */
export function viewerLocalLabel(date: string, time: string): string | null {
  const tz = viewerTimeZone();
  const at = prWallTimeToDate(date, time);
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(at);
  if (fmt(tz) === fmt(PR_TZ)) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(at);
}
