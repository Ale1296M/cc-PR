import { RoleGate } from "@/lib/role-gate";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useMyFamilyRecipients } from "@/lib/family-access";
import { SHIFT_STATUSES, formatDay, formatTime, statusLabel } from "@/components/shifts/shift-utils";
import { AsyncSkeleton, AsyncState } from "@/components/ui/async-state";
import { toast } from "sonner";

const AdminShiftCalendar = lazy(() => import("@/components/shifts/AdminShiftCalendar"));

export const Route = createFileRoute("/app/schedule")({
  component: () => (
    <RoleGate allow={["admin", "caregiver", "family_member"]}>
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
        <p className="mt-2 text-sm text-muted-foreground">Interactive dispatch monthly dashboard</p>
      </header>

      {role === "admin" ? (
        <>
          <ClientOnly fallback={<AsyncSkeleton shape="rows" count={6} />}>
            <Suspense fallback={<AsyncSkeleton shape="rows" count={6} />}>
              <AdminShiftCalendar adminId={uid!} />
            </Suspense>
          </ClientOnly>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <LegendDot className="bg-primary" label="Scheduled" />
            <LegendDot className="bg-primary/40" label="Completed" />
            <LegendDot className="bg-destructive" label="Cancelled" />
            <LegendDot className="bg-foreground" label="No Show" />
          </div>
          <p className="mt-3 text-xs italic text-muted-foreground">
            Drag a shift to reschedule. Click an empty slot to add one.
          </p>
        </>
      ) : role === "family_member" ? (
        <FamilySchedule uid={uid} />
      ) : (
        <CaregiverSchedule uid={uid} />
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} aria-hidden />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}


/** Read-only upcoming schedule for family members, scoped to their linked recipients. */
function FamilySchedule({ uid }: { uid?: string }) {
  const { data: myRecipients } = useMyFamilyRecipients();
  const recipientIds = myRecipients?.map((r) => r.id);

  const {
    data: shifts,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["family-shifts", uid, recipientIds],
    enabled: !!uid && recipientIds !== undefined,
    queryFn: async () => {
      if (!recipientIds || recipientIds.length === 0) return [];
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, care_recipient_id, care_recipients(id, full_name)",
        )
        .in("care_recipient_id", recipientIds)
        .gte("scheduled_date", today)
        .order("scheduled_date")
        .order("scheduled_start_time");
      if (error) throw error;
      return (data ?? []).filter((s) => recipientIds.includes(s.care_recipient_id));
    },
  });

  type FamilyShift = NonNullable<typeof shifts>[number];
  const byDay = (shifts ?? []).reduce<Record<string, FamilyShift[]>>((acc, s) => {
    (acc[s.scheduled_date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <AsyncState
      isPending={isPending}
      error={error}
      data={byDay}
      what="the schedule"
      onRetry={() => refetch()}
      skeleton="rows"
      isEmpty={(g) => Object.keys(g).length === 0}
      empty={{
        title: "No upcoming visits yet",
        hint: "Once visits are scheduled for your loved one, they'll appear here day by day.",
      }}
    >
      {(groups) => (
        <div className="space-y-8">
          {Object.entries(groups).map(([day, list]) => (
            <section key={day}>
              <h2 className="type-section mb-4">{formatDay(day)}</h2>
              <div className="divide-y divide-border border-t border-border">
                {list.map((s) => (
                  <div key={s.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                    <div className="text-sm sm:w-32 sm:shrink-0">
                      {formatTime(s.scheduled_start_time)} – {formatTime(s.scheduled_end_time)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {(s.care_recipients as unknown as { full_name: string } | null)?.full_name}
                      </p>
                      {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
                    </div>
                    <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs capitalize text-secondary-foreground">
                      {statusLabel(s.status)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AsyncState>
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
            <div className="divide-y divide-border border-t border-border">
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
