import { RoleGate } from "@/lib/role-gate";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SHIFT_STATUSES, formatDay, formatTime, statusLabel } from "@/components/shifts/shift-utils";
import { LoadingState } from "@/components/ui/states";
import { AsyncState } from "@/components/ui/async-state";
import { toast } from "sonner";

const AdminShiftCalendar = lazy(() => import("@/components/shifts/AdminShiftCalendar"));

export const Route = createFileRoute("/app/schedule")({
  component: () => (
    <RoleGate allow={["admin", "caregiver"]}>
      <SchedulePage />
    </RoleGate>
  ),
});

function SchedulePage() {
  const { user, role } = useAuth();
  const uid = user?.id;

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Schedule</p>
        <h1 className="type-display mt-1">Shifts &amp; visits</h1>
      </header>

      {role === "admin" ? (
        <ClientOnly fallback={<LoadingState label="Loading the calendar…" />}>
          <Suspense fallback={<LoadingState label="Loading the calendar…" />}>
            <AdminShiftCalendar adminId={uid!} />
          </Suspense>
        </ClientOnly>
      ) : (
        <CaregiverSchedule uid={uid} />
      )}
    </div>
  );
}

function CaregiverSchedule({ uid }: { uid?: string }) {
  const qc = useQueryClient();

  const { data: caregiverId } = useQuery({
    queryKey: ["my-caregiver-id", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("caregivers")
        .select("id")
        .eq("profile_id", uid!)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const {
    data: shifts,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shifts", uid, caregiverId],
    enabled: !!uid && caregiverId !== undefined,
    queryFn: async () => {
      let q = supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, caregiver_id, care_recipients(id, full_name)",
        )
        .order("scheduled_date")
        .order("scheduled_start_time");
      if (caregiverId) q = q.eq("caregiver_id", caregiverId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  type Shift = NonNullable<typeof shifts>[number];
  const groups = (shifts ?? []).reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.scheduled_date] ||= []).push(s);
    return acc;
  }, {});

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("care_shifts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift updated");
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update this shift — try again."),
  });

  return (
    <>
      <AsyncState
        isPending={isPending}
        error={error}
        data={groups}
        what="your schedule"
        onRetry={() => refetch()}
        skeleton="rows"
        isEmpty={(g) => Object.keys(g).length === 0}
        empty={{
          title: "No visits scheduled yet",
          hint: "Visits you're assigned will appear here, grouped by day.",
        }}
      >
        {(byDay) => (
      <div className="space-y-8">
        {Object.entries(byDay).map(([day, list]) => (
          <section key={day}>
            <h2 className="type-section mb-4">{formatDay(day)}</h2>
            <div className="card-soft divide-y divide-border">
              {list.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 sm:flex sm:gap-4"
                >
                  <div className="order-1 min-w-0 text-sm sm:w-32 sm:shrink-0">
                    {formatTime(s.scheduled_start_time)} – {formatTime(s.scheduled_end_time)}
                  </div>
                  <div className="order-3 col-span-2 min-w-0 sm:order-2 sm:col-span-1 sm:flex-1">
                    <p className="truncate font-medium">
                      {(s.care_recipients as unknown as { full_name: string } | null)?.full_name}
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
                  </div>
                  <select
                    aria-label="Shift status"
                    value={s.status}
                    onChange={(ev) => updateStatus.mutate({ id: s.id, status: ev.target.value })}
                    disabled={s.caregiver_id !== caregiverId}
                    className="order-2 min-h-10 shrink-0 rounded-md border border-border bg-background px-2 text-xs sm:order-3"
                  >
                    {SHIFT_STATUSES.map((o) => (
                      <option key={o} value={o}>
                        {statusLabel(o)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
        )}
      </AsyncState>
    </>
  );
}
