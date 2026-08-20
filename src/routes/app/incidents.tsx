import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RoleGate } from "@/lib/role-gate";
import { AsyncState } from "@/components/ui/async-state";
import {
  SEVERITIES,
  STATUSES,
  formatStamp,
  severityClass,
  severityLabel,
  statusClass,
  statusLabel,
  typeLabel,
  type Severity,
  type Status,
} from "@/components/incidents/incident-meta";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { softDelete, withUpdatedBy } from "@/lib/soft-delete";

export const Route = createFileRoute("/app/incidents")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <IncidentsAdmin />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Incidents · Con Cariño PR" },
      {
        name: "description",
        content: "Review, triage and resolve incident reports filed by caregivers and families.",
      },
      { property: "og:title", content: "Incidents · Con Cariño PR" },
      {
        property: "og:description",
        content: "Every incident report with its full audit trail, in one admin view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = {
  id: string;
  care_recipient_id: string;
  incident_type: string;
  severity: string;
  status: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  description: string;
  action_taken: string | null;
  reporter_role: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  recipient: { full_name: string } | null;
  reporter: { full_name: string | null } | null;
  resolver: { full_name: string | null } | null;
};

function IncidentsAdmin() {
  const [status, setStatus] = useState<Status | "all">("all");
  const [severity, setSeverity] = useState<string>("all");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["incidents", "admin", status, severity],
    queryFn: async () => {
      let q = supabase
        .from("incident_reports")
        .select(
          "id, care_recipient_id, incident_type, severity, status, occurred_at, created_at, updated_at, description, action_taken, reporter_role, resolved_at, resolution_notes, recipient:care_recipient_id(full_name), reporter:reported_by(full_name), resolver:resolved_by(full_name)",
        )
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      if (severity !== "all") q = q.eq("severity", severity as Severity);
      const { data, error: e } = await q;
      if (e) throw e;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = data ?? [];

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Safety</p>
        <h1 className="type-display mt-1">Incidents</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Review and resolve safety and medical event logs submitted by caregivers
        </p>

      </header>

      <div className="mb-6 flex flex-wrap gap-4">
        <label className="text-sm">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "all")}
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-background px-4 text-sm sm:w-48"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-background px-4 text-sm sm:w-48"
          >
            <option value="all">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <AsyncState
        isPending={isPending}
        error={error}
        data={rows}
        what="incident reports"
        onRetry={() => refetch()}
        skeleton="cards"
        empty={{
          title: "No incidents to review",
          hint: "Reports filed by caregivers and family members show up here. Try widening the status or severity filter above.",
        }}
      >
        {(list) => (
          <div className="space-y-4">
            {list.map((row) => (
              <IncidentCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </AsyncState>
    </div>
  );
}

function IncidentCard({ row }: { row: Row }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState(row.resolution_notes ?? "");

  const update = useMutation({
    mutationFn: async (next: Status) => {
      if (!user) throw new Error("You need to be signed in.");
      if (next === "resolved" && !notes.trim())
        throw new Error("Add resolution notes before resolving.");
      const patch =
        next === "resolved"
          ? {
              status: next,
              resolution_notes: notes.trim(),
              resolved_by: user.id,
              resolved_at: new Date().toISOString(),
            }
          : {
              status: next,
              resolution_notes: notes.trim() || null,
              resolved_by: null,
              resolved_at: null,
            };
      const { error } = await supabase
        .from("incident_reports")
        .update(await withUpdatedBy(patch))
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(`Incident marked ${statusLabel(next).toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update this incident — try again."),
  });

  const remove = useMutation({
    mutationFn: () => softDelete("incident_reports", row.id),
    onSuccess: () => {
      toast.success("Incident moved to recently deleted");
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't remove this incident — try again."),
  });

  return (
    <article className="card-soft p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-xl">{typeLabel(row.incident_type)}</p>
          <span className={`rounded-full px-3 py-1 text-xs ${severityClass[row.severity] ?? ""}`}>
            {severityLabel(row.severity)} severity
          </span>
          <span className={`rounded-full px-3 py-1 text-xs ${statusClass[row.status] ?? ""}`}>
            {statusLabel(row.status)}
          </span>
        </div>
        <p className="text-right text-sm text-muted-foreground">
          <Link
            to="/app/clients/$clientId"
            params={{ clientId: row.care_recipient_id }}
            className="text-primary underline"
          >
            {row.recipient?.full_name ?? "Care recipient"}
          </Link>
          <br />
          <span className="text-xs">occurred {formatStamp(row.occurred_at)}</span>
        </p>
      </div>


      <p className="mt-4 text-sm">{row.description}</p>
      {row.action_taken && (
        <p className="mt-1 text-sm text-muted-foreground">Action taken: {row.action_taken}</p>
      )}

      <dl className="mt-4 grid gap-1 rounded-xl bg-secondary/40 p-4 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Reported by: </dt>
          <dd className="inline">
            {row.reporter?.full_name ?? "Unknown"}
            {row.reporter_role ? ` (${row.reporter_role.replace("_", " ")})` : ""}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Reported at: </dt>
          <dd className="inline">{formatStamp(row.created_at)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Resolved by: </dt>
          <dd className="inline">{row.resolver?.full_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Resolved at: </dt>
          <dd className="inline">{formatStamp(row.resolved_at)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline font-medium">Last updated: </dt>
          <dd className="inline">{formatStamp(row.updated_at)}</dd>
        </div>
      </dl>

      <label className="mt-4 block text-sm">
        Resolution notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What was done to close this out."
          className="mt-1 w-full rounded-xl border border-border bg-background p-4 text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {row.status !== "resolved" && (
          <ConfirmAction
            title="Resolve this incident?"
            description="Resolving records you as the resolver with today's date and closes the report. Your resolution notes are saved with it."
            confirmLabel="Resolve incident"
            disabled={update.isPending}
            onConfirm={() => update.mutate("resolved")}
          >
            <button
              type="button"
              disabled={update.isPending}
              className="min-h-10 rounded-full bg-primary px-6 text-sm text-primary-foreground disabled:opacity-50"
            >
              Resolve
            </button>
          </ConfirmAction>
        )}
        {row.status !== "under_review" && (
          <button
            type="button"
            onClick={() => update.mutate("under_review")}
            disabled={update.isPending}
            className="min-h-10 rounded-full border border-border px-6 text-sm hover:bg-secondary/50 disabled:opacity-50"
          >
            Mark under review
          </button>
        )}
        {row.status !== "open" && (
          <button
            type="button"
            onClick={() => update.mutate("open")}
            disabled={update.isPending}
            className="min-h-10 rounded-full border border-border px-6 text-sm hover:bg-secondary/50 disabled:opacity-50"
          >
            Reopen
          </button>
        )}
        <div className="ml-auto">
          <ConfirmAction
            title="Remove this incident report?"
            description="It moves to Recently deleted, where an admin can restore it. Nothing is erased."
            confirmLabel="Remove report"
            destructive
            disabled={remove.isPending}
            onConfirm={() => remove.mutate()}
          >
            <button
              type="button"
              disabled={remove.isPending}
              className="min-h-10 rounded-full border border-border px-6 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              Remove
            </button>
          </ConfirmAction>
        </div>
      </div>

    </article>
  );
}