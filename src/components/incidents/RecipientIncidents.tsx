import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ReportIncidentDialog } from "./ReportIncidentDialog";
import {
  formatStamp,
  severityClass,
  severityLabel,
  statusClass,
  statusLabel,
  typeLabel,
} from "./incident-meta";

type Row = {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  occurred_at: string;
  created_at: string;
  description: string;
  action_taken: string | null;
  reporter_role: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  reporter: { full_name: string | null } | null;
  resolver: { full_name: string | null } | null;
};

export function RecipientIncidents({
  careRecipientId,
  recipientName,
}: {
  careRecipientId: string;
  recipientName?: string;
}) {
  const [reporting, setReporting] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["incidents", careRecipientId],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("incident_reports")
        .select(
          "id, incident_type, severity, status, occurred_at, created_at, description, action_taken, reporter_role, resolved_at, resolution_notes, reporter:reported_by(full_name), resolver:resolved_by(full_name)",
        )
        .eq("care_recipient_id", careRecipientId)
        .order("occurred_at", { ascending: false });
      if (e) throw e;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <section className="mb-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl">Incidents</h2>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-secondary/50"
        >
          <AlertTriangle className="h-4 w-4" /> Report an incident
        </button>
      </div>

      {isPending && <LoadingState label="Loading incident reports…" />}
      {error && <ErrorState what="incident reports" error={error} onRetry={() => refetch()} />}
      {!isPending && !error && (data ?? []).length === 0 && (
        <EmptyState
          title="No incidents reported"
          hint="Falls, medication errors and other events filed by the care team will appear here."
        />
      )}

      {(data ?? []).length > 0 && (
        <div className="card-soft divide-y divide-border">
          {(data ?? []).map((i) => (
            <article key={i.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{typeLabel(i.incident_type)}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${severityClass[i.severity] ?? ""}`}>
                  {severityLabel(i.severity)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[i.status] ?? ""}`}>
                  {statusLabel(i.status)}
                </span>
                <span className="text-xs text-muted-foreground">{formatStamp(i.occurred_at)}</span>
              </div>
              <p className="mt-2 text-sm">{i.description}</p>
              {i.action_taken && (
                <p className="mt-1 text-sm text-muted-foreground">Action taken: {i.action_taken}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Reported by {i.reporter?.full_name ?? "a team member"}
                {i.reporter_role ? ` (${i.reporter_role.replace("_", " ")})` : ""} ·{" "}
                {formatStamp(i.created_at)}
                {i.resolved_at
                  ? ` · Resolved by ${i.resolver?.full_name ?? "an admin"} · ${formatStamp(i.resolved_at)}`
                  : ""}
              </p>
              {i.resolution_notes && (
                <p className="mt-1 text-xs text-muted-foreground">Resolution: {i.resolution_notes}</p>
              )}
            </article>
          ))}
        </div>
      )}

      {reporting && (
        <ReportIncidentDialog
          careRecipientId={careRecipientId}
          recipientName={recipientName}
          onClose={() => setReporting(false)}
        />
      )}
    </section>
  );
}