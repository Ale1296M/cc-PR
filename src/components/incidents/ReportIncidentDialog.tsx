import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  INCIDENT_TYPES,
  SEVERITIES,
  toLocalInput,
  type IncidentType,
  type Severity,
} from "./incident-meta";

export function ReportIncidentDialog({
  careRecipientId,
  recipientName,
  visitLogId,
  onClose,
}: {
  careRecipientId: string;
  recipientName?: string;
  visitLogId?: string | null;
  onClose: () => void;
}) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [incidentType, setIncidentType] = useState<IncidentType>("fall");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(new Date()));
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in to file a report.");
      if (!description.trim()) throw new Error("Describe what happened before filing.");
      const when = new Date(occurredAt);
      if (Number.isNaN(when.getTime())) throw new Error("Enter a valid date and time.");
      const { error } = await supabase.from("incident_reports").insert({
        care_recipient_id: careRecipientId,
        visit_log_id: visitLogId ?? null,
        reported_by: user.id,
        reporter_role: role ?? null,
        incident_type: incidentType,
        severity,
        occurred_at: when.toISOString(),
        description: description.trim(),
        action_taken: actionTaken.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incident reported — the care team has been notified.");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't file the report — try again."),
  });

  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-foreground/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="type-subhead">Report an incident</h3>
        {recipientName && (
          <p className="mt-1 text-sm text-muted-foreground">For {recipientName}</p>
        )}
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              What happened
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className="mt-1 min-h-10 w-full rounded-md border border-border bg-background px-4 text-sm"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Severity
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="mt-1 min-h-10 w-full rounded-md border border-border bg-background px-4 text-sm"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            When did it happen
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-md border border-border bg-background px-4 text-sm"
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what happened, where, and who was present."
              className="mt-1 w-full rounded-xl border border-border bg-background p-4 text-sm"
            />
          </label>
          <label className="block text-sm">
            Action taken <span className="text-muted-foreground">(optional)</span>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={3}
              placeholder="First aid given, family called, 911 contacted…"
              className="mt-1 w-full rounded-xl border border-border bg-background p-4 text-sm"
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-border px-6 text-sm hover:bg-secondary/50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
            className="min-h-10 rounded-full bg-primary px-6 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Filing…" : "File report"}
          </button>
        </div>
      </div>
    </div>
  );
}