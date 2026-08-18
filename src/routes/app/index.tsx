import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AsyncState, AsyncSkeleton, AsyncError } from "@/components/ui/async-state";
import { useFamilyIncidentAlerts, useUnreviewedIncidents } from "@/lib/use-incident-alerts";
import { severityLabel, typeLabel, formatStamp } from "@/components/incidents/incident-meta";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

type ShiftRow = {
  id: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  status: string;
  notes: string | null;
  care_recipients: { id: string; full_name: string } | null;
};

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bandFromMood(avg: number | null) {
  if (avg == null) return { label: "No check-ins yet", tone: "text-muted-foreground" };
  if (avg >= 4) return { label: "Good this week", tone: "text-primary" };
  if (avg >= 2.6) return { label: "Steady this week", tone: "text-foreground" };
  return { label: "Worth a conversation", tone: "text-attention" };
}

function Dashboard() {
  const { user, role } = useAuth();
  const uid = user?.id;
  const isFamily = role === "family_member";
  const today = new Date();

  const { data: caregiverId } = useQuery({
    queryKey: ["dash-caregiver-id", uid],
    enabled: !!uid && role === "caregiver",
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
    isPending: shiftsPending,
    error: shiftsError,
    refetch: refetchShifts,
  } = useQuery({
    queryKey: ["dash-shifts", uid, role, caregiverId],
    enabled: !!uid && (role !== "caregiver" || caregiverId !== undefined),
    queryFn: async (): Promise<ShiftRow[]> => {
      if (role === "caregiver" && !caregiverId) return [];
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      let q = supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, care_recipients(id, full_name)",
        )
        .gte("scheduled_date", iso(from))
        .lte("scheduled_date", iso(to))
        .order("scheduled_date")
        .order("scheduled_start_time");
      if (role === "caregiver" && caregiverId) q = q.eq("caregiver_id", caregiverId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ShiftRow[];
    },
  });

  const { data: unread } = useQuery({
    queryKey: ["dash-unread", uid, role],
    enabled: !!uid && !!role,
    queryFn: async () => {
      if (role === "caregiver") {
        const { count } = await supabase
          .from("caregiver_messages")
          .select("*", { count: "exact", head: true })
          .eq("caregiver_profile_id", uid!)
          .neq("sender_profile_id", uid!)
          .is("read_at", null);
        return count ?? 0;
      }
      const { count } = await supabase
        .from("family_messages")
        .select("*", { count: "exact", head: true })
        .neq("sender_profile_id", uid!)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  // Family: their loved one + recent mood
  const {
    data: loved,
    isPending: lovedPending,
    error: lovedError,
    refetch: refetchLoved,
  } = useQuery({
    queryKey: ["dash-loved", uid],
    enabled: !!uid && isFamily,
    queryFn: async () => {
      const { data: fam, error } = await supabase
        .from("families")
        .select("care_recipients(id, full_name)")
        .eq("profile_id", uid!);
      if (error) throw error;
      const recipients = (fam ?? []).flatMap(
        (f) => (f.care_recipients ?? []) as unknown as { id: string; full_name: string }[],
      );
      const person = recipients[0] ?? null;
      if (!person) return null;
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data: visits } = await supabase
        .from("visit_logs")
        .select("clock_in, wellbeing_entries(mood_scale)")
        .eq("care_recipient_id", person.id)
        .gte("clock_in", since.toISOString())
        .order("clock_in");
      const moods = (visits ?? [])
        .flatMap((v) => {
          const e = v.wellbeing_entries as unknown as { mood_scale: number | null } | { mood_scale: number | null }[] | null;
          if (!e) return [];
          return Array.isArray(e) ? e : [e];
        })
        .map((e) => e.mood_scale)
        .filter((m): m is number => m != null);
      const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
      return { person, avg, checkIns: moods.length };
    },
  });

  // Admin: open incidents
  const { data: openIncidents } = useQuery({
    queryKey: ["dash-open-incidents"],
    enabled: role === "admin",
    queryFn: async () => {
      const { count } = await supabase
        .from("incident_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      return count ?? 0;
    },
  });

  const { data: unreviewed } = useUnreviewedIncidents(role);
  const { data: familyAlerts } = useFamilyIncidentAlerts(role, uid);

  const todayKey = todayKeyLocal();
  const rows = shifts ?? [];
  const todayShifts = rows.filter((s) => s.scheduled_date === todayKey);
  const nowMs = Date.now();
  const nextShift =
    rows.find((s) => new Date(`${s.scheduled_date}T${s.scheduled_end_time}`).getTime() >= nowMs) ??
    null;

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </header>

      {role === "caregiver" && (
        <CaregiverHero
          isPending={shiftsPending}
          error={shiftsError}
          onRetry={() => refetchShifts()}
          nextShift={nextShift}
          todayCount={todayShifts.length}
          unread={unread ?? 0}
        />
      )}

      {isFamily && (
        <FamilyHero
          isPending={lovedPending}
          error={lovedError}
          onRetry={() => refetchLoved()}
          loved={loved ?? null}
          todayCount={todayShifts.length}
          unread={unread ?? 0}
        />
      )}

      {isFamily && (familyAlerts ?? []).length > 0 && (
        <section className="mt-8 rounded-2xl bg-attention-soft p-6 text-attention-foreground">
          <h2 className="type-subhead">Recent alerts</h2>
          <ul className="mt-4 divide-y divide-attention-foreground/15">
            {(familyAlerts ?? []).map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <span className="font-medium">{typeLabel(a.incident_type)}</span> ·{" "}
                {severityLabel(a.severity)} · {a.care_recipients?.full_name ?? "your loved one"}
                <p className="text-xs opacity-80">
                  {formatStamp(a.occurred_at)} — {a.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {role === "admin" && (
        <AdminHero
          isPending={shiftsPending}
          error={shiftsError}
          onRetry={() => refetchShifts()}
          openIncidents={openIncidents ?? 0}
          unreviewed={unreviewed ?? 0}
          todayCount={todayShifts.length}
          unread={unread ?? 0}
        />
      )}

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="type-section">Upcoming this week</h2>
          <Link to="/app/schedule" className="text-sm text-primary hover:underline">
            Full schedule →
          </Link>
        </div>
        <AsyncState
          isPending={shiftsPending}
          error={shiftsError}
          data={shifts}
          what="your upcoming visits"
          onRetry={() => refetchShifts()}
          skeleton="rows"
          empty={{
            title: "No visits scheduled yet",
            hint: isFamily
              ? "Visits booked by the care team for the next 7 days will show up here."
              : role === "admin"
                ? "Create a shift from the Schedule screen and it will appear here."
                : "Visits you're assigned will appear here.",
          }}
        >
          {(list) => (
            <div className="divide-y divide-border border-t border-border">
              {list.slice(0, 8).map((s) => {
                const d = new Date(`${s.scheduled_date}T${s.scheduled_start_time}`);
                const e = new Date(`${s.scheduled_date}T${s.scheduled_end_time}`);
                return (
                  <div key={s.id} className="flex items-center gap-4 p-4">
                    <div className="w-16 shrink-0 text-sm sm:w-20">
                      <p className="font-medium">
                        {d.toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p className="text-muted-foreground">
                        {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {s.care_recipients?.full_name ??
                          (isFamily ? "Your loved one" : "Care recipient")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round((+e - +d) / 3600000)}h · {s.status}
                      </p>
                    </div>
                    <span className="hidden shrink-0 rounded-full bg-secondary px-4 py-1 text-xs sm:inline">
                      {s.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </AsyncState>
      </section>
    </div>
  );
}

function HeroShell({
  isPending,
  error,
  onRetry,
  what,
  children,
  secondary,
}: {
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  what: string;
  children: React.ReactNode;
  secondary: string;
}) {
  if (isPending) return <AsyncSkeleton shape="rows" count={2} />;
  if (error) return <AsyncError what={what} error={error} onRetry={onRetry} />;
  return (
    <section>
      {children}
      <p className="mt-4 text-sm text-muted-foreground">{secondary}</p>
    </section>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function CaregiverHero({
  isPending,
  error,
  onRetry,
  nextShift,
  todayCount,
  unread,
}: {
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  nextShift: ShiftRow | null;
  todayCount: number;
  unread: number;
}) {
  const secondary = `${plural(todayCount, "visit", "visits")} today · ${plural(unread, "unread message", "unread messages")}`;
  return (
    <HeroShell
      isPending={isPending}
      error={error}
      onRetry={onRetry}
      what="your next visit"
      secondary={secondary}
    >
      {nextShift ? (
        <>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Your next visit</p>
          <h1 className="type-display mt-2">
            {nextShift.care_recipients?.full_name ?? "Care recipient"}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {new Date(`${nextShift.scheduled_date}T${nextShift.scheduled_start_time}`).toLocaleDateString(
              undefined,
              { weekday: "long", month: "long", day: "numeric" },
            )}
            {" · "}
            {new Date(`${nextShift.scheduled_date}T${nextShift.scheduled_start_time}`).toLocaleTimeString(
              [],
              { hour: "numeric", minute: "2-digit" },
            )}
            {" – "}
            {new Date(`${nextShift.scheduled_date}T${nextShift.scheduled_end_time}`).toLocaleTimeString(
              [],
              { hour: "numeric", minute: "2-digit" },
            )}
          </p>
          <Link
            to="/app/visit"
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-8 text-base font-medium text-primary-foreground transition hover:opacity-90"
          >
            Clock in &amp; log visit
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Your next visit</p>
          <h1 className="type-display mt-2">Nothing scheduled</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Visits you're assigned will appear here as soon as the care team books them.
          </p>
          <Link
            to="/app/visit"
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-border px-8 text-base font-medium transition hover:bg-secondary/50"
          >
            Clock in &amp; log visit
          </Link>
        </>
      )}
    </HeroShell>
  );
}

function FamilyHero({
  isPending,
  error,
  onRetry,
  loved,
  todayCount,
  unread,
}: {
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  loved: { person: { id: string; full_name: string }; avg: number | null; checkIns: number } | null;
  todayCount: number;
  unread: number;
}) {
  const b = bandFromMood(loved?.avg ?? null);
  const secondary = `${plural(todayCount, "visit", "visits")} today · ${plural(unread, "unread message", "unread messages")}`;
  return (
    <HeroShell
      isPending={isPending}
      error={error}
      onRetry={onRetry}
      what="your loved one's wellbeing"
      secondary={secondary}
    >
      <p className="text-sm uppercase tracking-widest text-muted-foreground">How they're doing</p>
      {loved ? (
        <>
          <h1 className="type-display mt-2">
            {loved.person.full_name} — <span className={b.tone}>{b.label}</span>
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {loved.checkIns > 0
              ? `Based on ${plural(loved.checkIns, "check-in", "check-ins")} in the last 7 days.`
              : `No check-ins recorded yet for ${loved.person.full_name}.`}
          </p>
          <Link
            to="/app/wellbeing"
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-8 text-base font-medium text-primary-foreground transition hover:opacity-90"
          >
            See wellbeing history
          </Link>
        </>
      ) : (
        <>
          <h1 className="type-display mt-2">No loved one linked yet</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Once an admin links your family to a care recipient, their wellbeing appears here.
          </p>
        </>
      )}
    </HeroShell>
  );
}

function AdminHero({
  isPending,
  error,
  onRetry,
  openIncidents,
  unreviewed,
  todayCount,
  unread,
}: {
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  openIncidents: number;
  unreviewed: number;
  todayCount: number;
  unread: number;
}) {
  const calm = openIncidents === 0;
  const secondary = `${plural(unreviewed, "unreviewed incident", "unreviewed incidents")} · ${plural(todayCount, "visit", "visits")} today · ${plural(unread, "unread message", "unread messages")}`;
  return (
    <HeroShell
      isPending={isPending}
      error={error}
      onRetry={onRetry}
      what="what needs attention"
      secondary={secondary}
    >
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Needs attention</p>
      <h1 className="type-display mt-2">
        {calm ? "All clear today" : `${plural(openIncidents, "open incident", "open incidents")}`}
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        {calm
          ? `No open incidents · ${plural(todayCount, "visit", "visits")} scheduled today.`
          : `Plus ${plural(todayCount, "visit", "visits")} scheduled today.`}
      </p>
      <Link
        to={calm ? "/app/schedule" : "/app/incidents"}
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-8 text-base font-medium text-primary-foreground transition hover:opacity-90"
      >
        {calm ? "Review today's schedule" : "Review incidents"}
      </Link>
    </HeroShell>
  );
}
