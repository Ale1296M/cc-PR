import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/lib/role-gate";
import { AsyncState } from "@/components/ui/async-state";

export const Route = createFileRoute("/app/activity")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <ActivityLog />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Activity log · Con Cariño PR" },
      {
        name: "description",
        content: "Read-only record of who changed what across care plans, incidents, visits and contacts.",
      },
      { property: "og:title", content: "Activity log · Con Cariño PR" },
      {
        property: "og:description",
        content: "A reverse-chronological audit trail for administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const TABLES = [
  { key: "all", label: "All records" },
  { key: "care_plan_items", label: "Care plan" },
  { key: "incident_reports", label: "Incidents" },
  { key: "visit_logs", label: "Visits" },
  { key: "wellbeing_entries", label: "Wellbeing" },
  { key: "emergency_contacts", label: "Emergency contacts" },
  { key: "care_shifts", label: "Shifts" },
  { key: "family_members", label: "Family links" },
] as const;

const TABLE_LABEL: Record<string, string> = Object.fromEntries(
  TABLES.filter((t) => t.key !== "all").map((t) => [t.key, t.label]),
);

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Removed",
};

const DIFF_TABLES = new Set(["care_plan_items", "incident_reports"]);

const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at", "updated_by"]);

type Row = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

function fieldLabel(key: string) {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function changedFields(before: Row["before"], after: Row["after"]) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: { key: string; from: unknown; to: unknown }[] = [];
  keys.forEach((key) => {
    if (HIDDEN_FIELDS.has(key)) return;
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) return;
    out.push({ key, from, to });
  });
  return out;
}

function ActivityLog() {
  const [table, setTable] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["audit-log", table, from, to],
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("id, actor_id, action, table_name, row_id, before, after, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (table !== "all") q = q.eq("table_name", table);
      if (from) q = q.gte("created_at", new Date(`${from}T00:00:00`).toISOString());
      if (to) q = q.lte("created_at", new Date(`${to}T23:59:59`).toISOString());
      const { data: rows, error: err } = await q;
      if (err) throw err;
      const entries = (rows ?? []) as unknown as Row[];

      const actorIds = Array.from(
        new Set(entries.map((r) => r.actor_id).filter((v): v is string => !!v)),
      );
      let names: Record<string, string> = {};
      if (actorIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds);
        names = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown person"]),
        );
      }
      return entries.map((r) => ({
        ...r,
        actor_name: r.actor_id ? (names[r.actor_id] ?? "Unknown person") : "System",
      }));
    },
  });

  const hasFilters = useMemo(() => table !== "all" || !!from || !!to, [table, from, to]);

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="type-display mt-1">Activity log</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Read-only diagnostic audit log tracking updates across clinical care, visits, and user rosters
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABLES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTable(t.key)}
            className={`min-h-10 rounded-full px-4 text-sm transition ${
              table === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:opacity-90"
            }`}
          >
            {t.label}
          </button>
        ))}

      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setTable("all");
              setFrom("");
              setTo("");
            }}
            className="min-h-10 text-sm text-primary underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <AsyncState
        isPending={isPending}
        error={error}
        data={data}
        what="activity"
        onRetry={() => refetch()}
        skeleton="rows"
        empty={{
          title: "No activity yet",
          hint: "Changes to care plans, incidents, visits and contacts will show up here.",
        }}
      >
        {(rows) => (
          <div className="divide-y divide-border border-t border-border">
            {rows.map((r) => {
              const diffable = DIFF_TABLES.has(r.table_name);
              const diff = diffable ? changedFields(r.before, r.after) : [];
              const open = openId === r.id;
              return (
                <div key={r.id} className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {r.actor_name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {ACTION_LABEL[r.action] ?? r.action}{" "}
                        {TABLE_LABEL[r.table_name] ?? r.table_name.replace(/_/g, " ")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  {diffable && diff.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="mt-2 min-h-10 text-sm text-primary underline"
                      >
                        {open ? "Hide changes" : `Show changes (${diff.length})`}
                      </button>
                      {open && (
                        <dl className="mt-2 space-y-2 border-l-2 border-border pl-4">
                          {diff.map((d) => (
                            <div key={d.key} className="text-sm">
                              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                                {fieldLabel(d.key)}
                              </dt>
                              <dd className="flex flex-wrap items-center gap-2">
                                <span className="text-muted-foreground line-through">
                                  {display(d.from)}
                                </span>
                                <span aria-hidden>→</span>
                                <span>{display(d.to)}</span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AsyncState>
    </div>
  );
}
