/** Comprehensive-enough IANA timezone list with live offset/time labels. */
export const FALLBACK_TIMEZONES = [
  "America/Puerto_Rico","America/New_York","America/Chicago","America/Denver","America/Phoenix",
  "America/Los_Angeles","America/Anchorage","Pacific/Honolulu","America/Toronto","America/Vancouver",
  "America/Mexico_City","America/Bogota","America/Lima","America/Santiago","America/Sao_Paulo",
  "America/Argentina/Buenos_Aires","America/Santo_Domingo","America/Panama","Atlantic/Reykjavik",
  "Europe/London","Europe/Dublin","Europe/Lisbon","Europe/Madrid","Europe/Paris","Europe/Berlin",
  "Europe/Rome","Europe/Amsterdam","Europe/Stockholm","Europe/Warsaw","Europe/Athens",
  "Europe/Istanbul","Europe/Moscow","Africa/Casablanca","Africa/Lagos","Africa/Cairo",
  "Africa/Johannesburg","Africa/Nairobi","Asia/Jerusalem","Asia/Dubai","Asia/Karachi",
  "Asia/Kolkata","Asia/Dhaka","Asia/Bangkok","Asia/Jakarta","Asia/Shanghai","Asia/Hong_Kong",
  "Asia/Singapore","Asia/Manila","Asia/Seoul","Asia/Tokyo","Australia/Perth","Australia/Adelaide",
  "Australia/Brisbane","Australia/Sydney","Pacific/Auckland","UTC",
];

export const IANA_TIMEZONES: string[] = (() => {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
    .supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported("timeZone");
    } catch {
      /* fall through */
    }
  }
  return FALLBACK_TIMEZONES;
})();

/** e.g. "America/Puerto_Rico (GMT-4, 3:42 PM)" */
export function timezoneLabel(tz: string, now: Date = new Date()) {
  try {
    const time = new Intl.DateTimeFormat([], {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    return `${tz.replace(/_/g, " ")} (${offset}, ${time})`;
  } catch {
    return tz.replace(/_/g, " ");
  }
}

/** Offset in minutes east of UTC, used for sorting. */
export function timezoneOffsetMinutes(tz: string, now: Date = new Date()) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const p = Object.fromEntries(dtf.formatToParts(now).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(
      Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour), Number(p.minute), Number(p.second),
    );
    return Math.round((asUTC - Math.floor(now.getTime() / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

export const sortedTimezones = (now: Date = new Date()) =>
  [...IANA_TIMEZONES].sort(
    (a, b) => timezoneOffsetMinutes(a, now) - timezoneOffsetMinutes(b, now) || a.localeCompare(b),
  );
