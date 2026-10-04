import { z } from "zod";

// Strips control chars and HTML tags. React already escapes output and
// Supabase parametrizes queries; this keeps stored text clean for exports,
// emails and MCP agents that may not escape.
export function sanitizeText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

export const uuidSchema = z.string().uuid("Invalid id");

export const safeText = (max = 2000) =>
  z.string().max(max * 2).transform(sanitizeText).pipe(z.string().max(max));

export const requiredText = (max = 200) =>
  z.string().transform(sanitizeText).pipe(z.string().min(1, "Required").max(max));

// Accepts US/PR numbers: 10 digits, optional +1. Normalizes to +1XXXXXXXXXX.
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => /^(\+?1)?\d{10}$/.test(v), "Enter a 10-digit phone number")
  .transform((v) => `+1${v.replace(/^\+?1?/, "").slice(-10)}`);

// ISO date (YYYY-MM-DD) that is a real calendar date.
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Invalid date");

export const isoDateTimeSchema = z.string().datetime({ offset: true });

// Medical / insurance identifiers: letters, digits, dashes only.
export const medicalIdSchema = z
  .string()
  .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9-]{4,20}$/, "Use 4–20 letters, numbers or dashes"));

export const limitSchema = (max = 200, dflt = 50) =>
  z.number().int().min(1).max(max).default(dflt);

// Date of birth: valid ISO date, not in the future, not older than 130 years.
export const birthdateSchema = isoDateSchema
  .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now(), "Date of birth can't be in the future")
  .refine((v) => new Date(`${v}T00:00:00Z`).getUTCFullYear() >= new Date().getUTCFullYear() - 130, "Please check the year");

// Upload guard for document pickers.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export function checkUploadSize(file: { size: number }, max = MAX_UPLOAD_BYTES): string | null {
  return file.size > max ? `That file is ${(file.size / 1048576).toFixed(0)} MB — the limit is ${Math.round(max / 1048576)} MB.` : null;
}
