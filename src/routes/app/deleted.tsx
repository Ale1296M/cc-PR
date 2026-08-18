import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/lib/role-gate";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { restoreDeleted, type SoftDeletableTable } from "@/lib/soft-delete";

export const Route = createFileRoute("/app/deleted")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <RecentlyDeleted />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Recently deleted · Con Cariño PR" },
      {
        name: "description",
        content: "Restore removed emergency contacts, checklist items, visits and incident reports.",
      },
      { property: "og:title", content: "Recently deleted · Con Cariño PR" },
      {
        property: "og:description",
        content: "Nothing is erased — admins can bring removed records back.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Kind = {
  table: SoftDeletableTable;
  label: string;
  select: string;
  title: (r: Record<string, unknown>) => string;
};

const KINDS: Kind[] = [
  {
    table: "emergency_contacts",
    label: "Emergency contacts",
    select: "id, deleted_at, full_name, relationship, phone_primary, care_recipients:care_recipient_id(full_name)",
    title: (r) => String(r.full_name ?? "Contact"),
  },
  {
    table: "care_plan_items",
    label: "Care plan items",
    select: "id, deleted_at, task_description, category, frequency, care_recipients:care_recipient_id(full_name)",
    title: (r) => String(r.task_description ?? "Checklist item"),
  },
  {
    table: "visit_logs",
    label: "Visit logs",
    select: "id, deleted_at, clock_in, clock_out, notes, care_recipients:care_recipient_id(full_name)",
    title: (r) =>
      r.clock_in
        ? `Visit on ${new Date(String(r.clock_in)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
        : "Visit",
  },
  {
    table: "incident_reports",
    label: "Incident reports",
    select: "id, deleted_at, incident_type, severity, occurred_at, description, care_recipients:care_recipient_id(full_name)",
    title: (r) => `${String(r.incident_type ?? "Incident").replace(/_/g, " ")} · ${String(r.severity ?? "")}`,
  },
];

function RecentlyDeleted() {
  const [kindIdx, setKindIdx] = useState(0);
  const kind = KINDS[kindIdx]!;
  const qc = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["recently-deleted", kind.table],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from(kind.table)
        .select(kind.select)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(100);
      if (err) throw err;
      return (rows ?? []) as unknown as Record<string, unknown>[];
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreDeleted(kind.table, id),
    onSuccess: () => {
      toast.success("Restored");
      qc.invalidateQueries();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't restore that record — try again."),
  });

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="type-display mt-1">Recently deleted</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Removed records are kept here rather than erased. Restore anything that was taken out by
          mistake.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {KINDS.map((k, i) => (
          <button
            key={k.table}
            type="button"
            onClick={() => setKindIdx(i)}
            className={`min-h-10 rounded-full border px-4 text-sm transition ${
              i === kindIdx
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary/50"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <AsyncState
        isPending={isPending}
        error={error}
        data={data}
        what="deleted records"
        onRetry={() => refetch()}
        skeleton="rows"
        empty={{
          title: "Nothing here",
          hint: "Records you remove elsewhere in the app will show up here, ready to restore.",
        }}
      >
        {(rows) => (
          <div className="divide-y divide-border border-t border-border">
            {rows.map((r) => {
              const id = String(r.id);
              const recipient = (r.care_recipients as { full_name?: string } | null)?.full_name;
              return (
                <div key={id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{kind.title(r)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recipient ? `${recipient} · ` : ""}
                      removed{" "}
                      {new Date(String(r.deleted_at)).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <ConfirmAction
                    title="Restore this record?"
                    description="It will reappear everywhere it was listed before."
                    confirmLabel="Restore"
                    disabled={restore.isPending}
                    onConfirm={() => restore.mutate(id)}
                  >
                    <button
                      type="button"
                      disabled={restore.isPending}
                      className="min-h-10 rounded-full border border-border px-6 text-sm hover:bg-secondary/50 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </ConfirmAction>
                </div>
              );
            })}
          </div>
        )}
      </AsyncState>
    </div>
  );
}
