import { supabase } from "@/integrations/supabase/client";

/**
 * Soft-delete helpers. Nothing in the app hard-deletes care records —
 * rows are marked with deleted_at/deleted_by so admins can restore them.
 */
export type SoftDeletableTable =
  | "emergency_contacts"
  | "care_plan_items"
  | "visit_logs"
  | "incident_reports";

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Adds updated_by = auth.uid() to any update payload. */
export async function withUpdatedBy<T extends Record<string, unknown>>(fields: T) {
  return { ...fields, updated_by: await currentUserId() };
}

export async function softDelete(table: SoftDeletableTable, id: string) {
  const uid = await currentUserId();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: uid, updated_by: uid } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function restoreDeleted(table: SoftDeletableTable, id: string) {
  const uid = await currentUserId();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null, deleted_by: null, updated_by: uid } as never)
    .eq("id", id);
  if (error) throw error;
}
