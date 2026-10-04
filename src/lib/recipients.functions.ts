import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRecipientAccess } from "@/lib/security/access";
import { maskRecipient } from "@/lib/security/pii";
import { limitSchema, uuidSchema } from "@/lib/security/validation";

// Recipient profile with role-aware PII masking. 403 + security event on denial.
export const getRecipientProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ recipientId: uuidSchema }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const level = await assertRecipientAccess(context.supabase, data.recipientId);
    const { data: r, error } = await context.supabase
      .from("care_recipients")
      .select("*")
      .eq("id", data.recipientId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("Unable to load care recipient");
    if (!r) return null;

    let onShiftToday = false;
    if (level === "caregiver") {
      const today = new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10); // PR wall date
      const { count } = await context.supabase
        .from("care_shifts")
        .select("id", { count: "exact", head: true })
        .eq("care_recipient_id", data.recipientId)
        .eq("scheduled_date", today);
      onShiftToday = (count ?? 0) > 0;
    }
    return { level, recipient: maskRecipient(r as any, level, { onShiftToday }) };
  });

// Care logs for one relative. Families and assigned caregivers only see their own recipient.
export const getRecipientLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ recipientId: uuidSchema, limit: limitSchema(100, 20) }).strict().parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRecipientAccess(context.supabase, data.recipientId);
    const { data: rows, error } = await context.supabase
      .from("visit_logs")
      .select("id, clock_in, clock_out, mood, notes, location_verified, evv_exception")
      .eq("care_recipient_id", data.recipientId)
      .is("deleted_at", null)
      .order("clock_in", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error("Unable to load visit logs");
    return rows ?? [];
  });
