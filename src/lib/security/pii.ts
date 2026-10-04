// PII masking applied on retrieval. Only fully authorized viewers get raw values.
export type AccessLevel = "admin" | "family" | "caregiver";

export function maskPhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length >= 4 ? `(***) ***-${d.slice(-4)}` : "***";
}

export function maskId(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.length > 4 ? `${"*".repeat(Math.min(v.length - 4, 8))}${v.slice(-4)}` : "****";
}

export function maskAddress(v: string | null | undefined): string | null {
  if (!v) return null;
  const firstWord = v.trim().split(/\s+/)[0] ?? "";
  return `${firstWord} ***`;
}

export function maskDob(v: string | null | undefined): string | null {
  return v ? `${v.slice(0, 4)}-**-**` : null;
}

type RecipientLike = {
  address_line?: string | null;
  zip_code?: string | null;
  date_of_birth?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
};

/**
 * admin + family: full record.
 * caregiver: full address only when `onShiftToday` (they need to get there);
 * date of birth is always reduced to the year; private admin notes hidden.
 */
export function maskRecipient<T extends RecipientLike>(
  r: T,
  level: AccessLevel,
  opts: { onShiftToday?: boolean } = {},
): T & { masked: boolean } {
  if (level === "admin" || level === "family") return { ...r, masked: false };
  const out: T = { ...r, date_of_birth: maskDob(r.date_of_birth), notes: null };
  if (!opts.onShiftToday) {
    out.address_line = maskAddress(r.address_line);
    out.zip_code = r.zip_code ? "***" : null;
    out.emergency_contact_phone = maskPhone(r.emergency_contact_phone);
    out.home_lat = null;
    out.home_lng = null;
  }
  return { ...out, masked: true };
}
