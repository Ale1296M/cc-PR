import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/lib/role-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatDuration } from "@/lib/geo";

export const Route = createFileRoute("/app/exceptions")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <VisitExceptions />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Visit exceptions · Kindred" },
      {
        name: "description",
        content: "Review visits flagged as out of range or missing location so the care team can follow up.",
      },
      { property: "og:title", content: "Visit exceptions · Kindred" },
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
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">Visit exceptions</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Visits that couldn&apos;t be location-verified. Review them with the caregiver — a flag on
          its own doesn&apos;t mean anything went wrong.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`min-h-10 rounded-full border px-4 text-sm transition ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isPending && <LoadingState label="Loading flagged visits…" />}
      {error && <ErrorState what="flagged visits" error={error} onRetry={() => refetch()} />}
      {!isPending && !error && (data ?? []).length === 0 && (
        <EmptyState
          title="No flagged visits"
          hint="Visits appear here when a caregiver clocks in away from the home address or without sharing location."
        />
      )}

      <div className={`card-soft divide-y divide-border ${(data ?? []).length === 0 ? "hidden" : ""}`}>
        {(data ?? []).map((v) => {
          const recipient = (v.care_recipients as unknown as { full_name: string } | null)?.full_name;
          const caregiver = (v.profiles as unknown as { full_name: string } | null)?.full_name;
          return (
            <div key={v.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {recipient ?? "Care recipient"}
                  <span className="text-muted-foreground"> · {caregiver ?? "Caregiver"}</span>
                </p>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  {LABEL[v.evv_exception ?? ""] ?? v.evv_exception}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(v.clock_in).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                {v.clock_out ? ` · ${formatDuration(v.clock_in, v.clock_out)}` : " · in progress"}
                {v.clock_in_accuracy_m != null ? ` · ±${Math.round(v.clock_in_accuracy_m)}m` : ""}
                {v.clock_in_method ? ` · clock-in ${v.clock_in_method}` : ""}
              </p>
              {v.care_recipient_id && (
                <Link
                  to="/app/clients/$clientId"
                  params={{ clientId: v.care_recipient_id }}
                  className="mt-2 inline-block text-sm text-primary underline"
                >
                  Open care recipient
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
