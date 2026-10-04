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
