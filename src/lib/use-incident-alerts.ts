import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { severityLabel, typeLabel } from "@/components/incidents/incident-meta";
import type { AppRole } from "@/lib/use-auth";

type IncidentRow = {
  id: string;
  care_recipient_id: string;
  incident_type: string;
  severity: string;
  status: string;
  description: string;
};

/** Admin sidebar badge + home hero: incidents not yet resolved. */
export function useUnreviewedIncidents(role: AppRole | null) {
  return useQuery({
    queryKey: ["incidents", "unreviewed-count"],
    enabled: role === "admin",
    queryFn: async () => {
      const { count, error } = await supabase
        .from("incident_reports")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["open", "under_review"]);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

async function recipientName(id: string) {
  const { data } = await supabase
    .from("care_recipients")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  return data?.full_name ?? "a care recipient";
}

/** Admin sidebar badge: signed-up users who don't have a role assigned yet. */
export function usePendingUsers(role: AppRole | null) {
  return useQuery({
    queryKey: ["users", "pending-count"],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id"),
        supabase.from("user_roles").select("user_id"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const assigned = new Set((roles ?? []).map((r) => r.user_id));
      return (profiles ?? []).filter((p) => !assigned.has(p.id)).length;
    },
  });
}

/**
 * Realtime in-app alerts for new incident reports.
 * Admins are alerted on every new incident; family members only on
 * high/critical severity for their own linked care recipients (row-level
 * security already limits which rows they can receive).
 */
export function useIncidentAlerts(role: AppRole | null, userId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId || (role !== "admin" && role !== "family_member")) return;

    const channel = supabase
      .channel(`incident-alerts-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incident_reports" },
        (payload) => {
          const row = payload.new as IncidentRow;
          const severe = row.severity === "high" || row.severity === "critical";
          if (role === "family_member" && !severe) return;

          qc.invalidateQueries({ queryKey: ["incidents"] });
          qc.invalidateQueries({ queryKey: ["dash-open-incidents"] });

          void recipientName(row.care_recipient_id).then((name) => {
            const title =
              role === "admin"
                ? `New incident · ${severityLabel(row.severity)}`
                : `${typeLabel(row.incident_type)} reported`;
            const description =
              role === "admin"
                ? `${typeLabel(row.incident_type)} — ${name}`
                : `${name} — the care team has been notified.`;
            const show = severe ? toast.error : toast;
            show(title, { description, duration: severe ? 12000 : 6000 });
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [role, userId, qc]);
}

/** Family-facing feed of recent high/critical incidents for their loved ones. */
export function useFamilyIncidentAlerts(role: AppRole | null, userId?: string) {
  return useQuery({
    queryKey: ["incidents", "family-alerts", userId],
    enabled: !!userId && role === "family_member",
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data, error } = await supabase
        .from("incident_reports")
        .select(
          "id, care_recipient_id, incident_type, severity, status, occurred_at, description, care_recipients:care_recipient_id(full_name)",
        )
        .in("severity", ["high", "critical"])
        .is("deleted_at", null)
        .gte("occurred_at", since.toISOString())
        .order("occurred_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as unknown as (IncidentRow & {
        occurred_at: string;
        care_recipients: { full_name: string } | null;
      })[];
    },
  });
}
