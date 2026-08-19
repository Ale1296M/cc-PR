import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

/**
 * The single source of truth for "which care recipients does this family member see".
 *
 * Access is granted through public.family_members: a user belongs to a family,
 * and every recipient of that family is visible to them. RLS enforces this too —
 * this query just fetches.
 */
export type FamilyRecipient = {
  id: string;
  full_name: string;
  family_id: string;
};

export async function fetchMyFamilyRecipients(userId: string): Promise<FamilyRecipient[]> {
  const { data: memberships, error: mErr } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", userId);
  if (mErr) throw mErr;

  const familyIds = [...new Set((memberships ?? []).map((m) => m.family_id).filter(Boolean))];
  if (familyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("care_recipients")
    .select("id, full_name, family_id")
    .in("family_id", familyIds)
    .is("deleted_at", null)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as FamilyRecipient[];
}

/** React hook wrapper around {@link fetchMyFamilyRecipients}. */
export function useMyFamilyRecipients(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const uid = user?.id;
  return useQuery({
    queryKey: ["my-family-recipients", uid],
    enabled: !!uid && (options?.enabled ?? true),
    queryFn: () => fetchMyFamilyRecipients(uid!),
  });
}
