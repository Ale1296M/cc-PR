import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "caregiver" | "family_member";

export const roleQueryKey = (uid: string | undefined) => ["current-user-role", uid] as const;

async function fetchRole(uid: string): Promise<AppRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  if (error) throw error;
  const roles = (data ?? []).map((r) => r.role as AppRole);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("caregiver")) return "caregiver";
  if (roles.includes("family_member")) return "family_member";
  return null;
}

/**
 * Session + role. The role lives in the TanStack Query cache, so every component shares one
 * request, and a realtime listener refreshes it the moment an admin changes this user's role.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const qc = useQueryClient();
  const user: User | null = session?.user ?? null;
  const uid = user?.id;

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const roleQuery = useQuery({
    queryKey: roleQueryKey(uid),
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: () => fetchRole(uid!),
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`user-roles-${uid}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: roleQueryKey(uid) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, qc]);

  const role = uid ? (roleQuery.data ?? null) : null;
  const loading = sessionLoading || (!!uid && roleQuery.isPending);

  return { session, user, role, loading };
}
