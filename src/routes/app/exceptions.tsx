import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/lib/role-gate";
import { AsyncState } from "@/components/ui/async-state";
import { formatDuration } from "@/lib/geo";

export const Route = createFileRoute("/app/exceptions")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <VisitExceptions />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Visit exceptions · Con Cariño PR" },
      {
        name: "description",
        content: "Review visits flagged as out of range or missing location so the care team can follow up.",
      },
      { property: "og:title", content: "Visit exceptions · Con Cariño PR" },
      {
        property: "og:description",
        content: "Flagged visits that need a quick review by the care team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const FILTERS = [
  { key: "all", label: "All flagged" },
  { key: "out_of_range", label: "Out of range" },
  { key: "missing_gps", label: "Missing location" },
] as const;

const LABEL: Record<string, string> = {
  out_of_range: "Recorded away from home address",
  missing_gps: "Location not shared",
};

function VisitExceptions() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["visit-exceptions", filter],
    queryFn: async () => {
      let q = supabase
        .from("visit_logs")
        .select(
          "id, clock_in, clock_out, evv_exception, clock_in_method, clock_out_method, clock_in_accuracy_m, care_recipient_id, caregiver_id, care_recipients(full_name), profiles:caregiver_id(full_name)",
        )
        .not("evv_exception", "is", null)
        .is("deleted_at", null)
        .order("clock_in", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("evv_exception", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="type-section mt-1">Visit exceptions</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Monitor shifts flagged due to check-in location disparities or missing coordinates
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`min-h-10 rounded-full px-4 text-sm transition ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:opacity-90"
            }`}
          >
            {f.label}
          </button>
        ))}

      </div>

      <AsyncState
        isPending={isPending}
        error={error}
        data={data}
        what="flagged visits"
        onRetry={() => refetch()}
        skeleton="rows"
        empty={{
          title: "No flagged visits",
          hint: "Visits appear here when a caregiver clocks in away from the home address or without sharing location.",
        }}
      >
        {(rows) => (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Care recipient</th>
              <th className="py-2 pr-4 font-medium">Caregiver</th>
              <th className="py-2 pr-4 font-medium">Shift time</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Dispatch type</th>
              <th className="py-2 pr-4 font-medium">Flag details</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((v) => {
              const recipient = (v.care_recipients as unknown as { full_name: string } | null)?.full_name;
              const caregiver = (v.profiles as unknown as { full_name: string } | null)?.full_name;
              const missing = v.evv_exception === "missing_gps";
              return (
                <tr key={v.id} className="align-top">
                  <td className="py-3 pr-4 font-medium">{recipient ?? "Care recipient"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{caregiver ?? "Caregiver"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {new Date(v.clock_in).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    {v.clock_out ? ` · ${formatDuration(v.clock_in, v.clock_out)}` : ""}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {v.clock_out ? "Completed" : "In progress"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {v.clock_in_method ?? "—"}
                    {v.clock_in_accuracy_m != null ? ` · ±${Math.round(v.clock_in_accuracy_m)}m` : ""}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs ${
                        missing
                          ? "bg-attention/20 text-attention-foreground"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {LABEL[v.evv_exception ?? ""] ?? v.evv_exception}
                    </span>
                  </td>
                  <td className="py-3">
                    {v.care_recipient_id && (
                      <Link
                        to="/app/clients/$clientId"
                        params={{ clientId: v.care_recipient_id }}
                        className="text-sm text-primary underline"
                      >
                        Open care recipient
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

        )}
      </AsyncState>
    </div>
  );
}
