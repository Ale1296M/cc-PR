import { RoleGate } from "@/lib/role-gate";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { VerifiedBadge } from "@/components/visits/VerifiedBadge";
import { formatDuration } from "@/lib/geo";

export const Route = createFileRoute("/app/wellbeing")({
  component: () => (
    <RoleGate allow={["admin", "family_member", "caregiver"]}>
      <WellbeingTrends />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Wellbeing Trends · Con Cariño PR" },
      {
        name: "description",
        content:
          "Descriptive 14-day mood, appetite, medicine, movement and hygiene patterns recorded during care visits.",
      },
      { property: "og:title", content: "Wellbeing Trends · Con Cariño PR" },
      {
        property: "og:description",
        content: "A descriptive 14-day picture of recorded wellbeing check-ins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Recipient = { id: string; full_name: string };

type Entry = {
  mood_scale: number | null;
  mood_notes: string | null;
  food_appetite: "good" | "fair" | "poor" | null;
  medicine_taken: "yes" | "no" | "partial" | null;
  movement_assisted: boolean | null;
  movement_notes: string | null;
  hygiene_bathing_completed: boolean | null;
  hygiene_grooming_completed: boolean | null;
};

type Visit = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  location_verified: boolean | null;
  wellbeing_entries: Entry | Entry[] | null;
};

const DAYS = 14;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function lastDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const c = new Date(d);
    c.setDate(d.getDate() - i);
    out.push(dayKey(c));
  }
  return out;
}

function firstEntry(v: Visit): Entry | null {
  const e = v.wellbeing_entries;
  if (!e) return null;
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

/** Overall descriptive score, 1–5, averaged across the recorded categories. */
function overallScore(e: Entry): number | null {
  const parts: number[] = [];
  if (e.mood_scale != null) parts.push(e.mood_scale);
  if (e.food_appetite) parts.push(e.food_appetite === "good" ? 5 : e.food_appetite === "fair" ? 3 : 1);
  if (e.medicine_taken) parts.push(e.medicine_taken === "yes" ? 5 : e.medicine_taken === "partial" ? 3 : 1);
  if (e.movement_assisted != null) parts.push(e.movement_assisted ? 3 : 5);
  if (e.hygiene_bathing_completed != null || e.hygiene_grooming_completed != null) {
    const done = Number(!!e.hygiene_bathing_completed) + Number(!!e.hygiene_grooming_completed);
    parts.push(done === 2 ? 5 : done === 1 ? 3 : 1);
  }
  if (parts.length === 0) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
}

function band(score: number | null) {
  if (score == null) return "none" as const;
  if (score >= 4) return "good" as const;
  if (score >= 2.6) return "usual" as const;
  return "attention" as const;
}

const BAND_CLASS: Record<string, string> = {
  good: "bg-primary",
  usual: "bg-gold",
  attention: "bg-destructive",
  none: "bg-secondary",
};
const BAND_LABEL: Record<string, string> = {
  good: "Good",
  usual: "Usual",
  attention: "Needs attention",
  none: "No check-in recorded",
};

function WellbeingTrends() {
  const { user, role } = useAuth();
  const uid = user?.id;
  const [recipientId, setRecipientId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const days = useMemo(() => lastDays(DAYS), []);
  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (DAYS - 1));
    return d.toISOString();
  }, []);

  const {
    data: recipients,
    isPending: recipientsPending,
    error: recipientsError,
    refetch: refetchRecipients,
  } = useQuery({
    queryKey: ["trends-recipients", uid, role],
    enabled: !!uid && !!role,
    queryFn: async (): Promise<Recipient[]> => {
      const map = new Map<string, Recipient>();
      const add = (r?: Recipient | null) => {
        if (r?.id) map.set(r.id, { id: r.id, full_name: r.full_name });
      };

      if (role === "admin") {
        const { data, error } = await supabase.from("care_recipients").select("id, full_name");
        if (error) throw error;
        (data ?? []).forEach(add);
      } else if (role === "caregiver") {
        const { data: cg } = await supabase
          .from("caregivers")
          .select("id")
          .eq("profile_id", uid!)
          .maybeSingle();
        if (!cg?.id) return [];
        const { data, error } = await supabase
          .from("care_shifts")
          .select("care_recipients(id, full_name)")
          .eq("caregiver_id", cg.id);
        if (error) throw error;
        for (const row of data ?? []) add(row.care_recipients as unknown as Recipient | null);
      } else {
        // family_member: their own families' recipients …
        const { data: fam } = await supabase
          .from("families")
          .select("care_recipients(id, full_name)")
          .eq("profile_id", uid!);
        for (const f of fam ?? []) {
          const rs = (f.care_recipients ?? []) as unknown as Recipient[];
          rs.forEach(add);
        }
        // … plus any recipients reached through client_family_members → clients
        const { data: links } = await supabase
          .from("client_family_members")
          .select("clients(full_name)")
          .eq("user_id", uid!);
        const names = (links ?? [])
          .map((l) => (l.clients as unknown as { full_name: string } | null)?.full_name)
          .filter((n): n is string => !!n);
        if (names.length > 0) {
          const { data: byName } = await supabase
            .from("care_recipients")
            .select("id, full_name")
            .in("full_name", names);
          (byName ?? []).forEach(add);
        }
      }
      return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const list = recipients ?? [];
  const activeId = recipientId || list[0]?.id || "";
  const activeName = list.find((r) => r.id === activeId)?.full_name ?? "";

  const {
    data: visits,
    isPending: visitsPending,
    error: visitsError,
    refetch: refetchVisits,
  } = useQuery({
    queryKey: ["trends-visits", activeId, since],
    enabled: !!activeId,
    queryFn: async (): Promise<Visit[]> => {
      const { data, error } = await supabase
        .from("visit_logs")
        .select(
          "id, clock_in, clock_out, location_verified, wellbeing_entries(mood_scale, mood_notes, food_appetite, medicine_taken, movement_assisted, movement_notes, hygiene_bathing_completed, hygiene_grooming_completed)",
        )
        .eq("care_recipient_id", activeId)
        .gte("clock_in", since)
        .order("clock_in");
      if (error) throw error;
      return (data ?? []) as unknown as Visit[];
    },
  });

  const { data: completions } = useQuery({
    queryKey: ["trends-tasks", activeId, (visits ?? []).length],
    enabled: !!activeId && (visits ?? []).length > 0,
    queryFn: async () => {
      const ids = (visits ?? []).map((v) => v.id);
      const { data, error } = await supabase
        .from("care_plan_completions")
        .select("id, completed, visit_log_id, care_plan_items(category)")
        .in("visit_log_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isFamily = role === "family_member";
  const shell = (children: React.ReactNode) => (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Last 14 days</p>
        <h1 className="mt-1 font-display text-3xl md:text-5xl">Wellbeing trends</h1>
      </header>
      {children}
    </div>
  );

  if (recipientsPending) return shell(<LoadingState label="Loading wellbeing check-ins…" />);
  if (recipientsError)
    return shell(
      <ErrorState
        what="the wellbeing trends"
        error={recipientsError}
        onRetry={() => refetchRecipients()}
      />,
    );
  if (list.length === 0)
    return shell(
      <EmptyState
        title={isFamily ? "No one linked to your account yet" : "No care recipients yet"}
        hint={
          isFamily
            ? "Once the care team links your loved one to your account, their daily check-ins will show up here."
            : "Wellbeing trends appear once you're assigned to someone and caregivers start logging visits."
        }
      />,
    );
  if (visitsError)
    return shell(
      <ErrorState what="the wellbeing check-ins" error={visitsError} onRetry={() => refetchVisits()} />,
    );

  // One entry per day (most recent visit of that day wins)
  const byDay = new Map<string, Entry>();
  const visitByDay = new Map<string, Visit>();
  for (const v of visits ?? []) {
    const e = firstEntry(v);
    visitByDay.set(dayKey(new Date(v.clock_in)), v);
    if (!e) continue;
    byDay.set(dayKey(new Date(v.clock_in)), e);
  }

  const ribbon = days.map((key) => {
    const entry = byDay.get(key) ?? null;
    const score = entry ? overallScore(entry) : null;
    return { key, entry, score, band: band(score) };
  });

  const chartData = ribbon
    .filter((d) => d.score != null)
    .map((d) => ({
      date: new Date(`${d.key}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }),
      score: d.score as number,
      label: BAND_LABEL[d.band],
    }));

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const thisWeek = avg(ribbon.slice(7).map((d) => d.score).filter((s): s is number => s != null));
  const lastWeek = avg(ribbon.slice(0, 7).map((d) => d.score).filter((s): s is number => s != null));
  const delta = thisWeek != null && lastWeek != null ? Math.round((thisWeek - lastWeek) * 10) / 10 : null;

  const activeDay =
    ribbon.find((d) => d.key === selectedDay) ??
    [...ribbon].reverse().find((d) => d.entry) ??
    null;

  // Task completion by category
  const byCategory = new Map<string, { done: number; total: number }>();
  for (const c of completions ?? []) {
    const cat =
      (c.care_plan_items as unknown as { category: string | null } | null)?.category ??
      "Uncategorised";
    const row = byCategory.get(cat) ?? { done: 0, total: 0 };
    row.total += 1;
    if (c.completed) row.done += 1;
    byCategory.set(cat, row);
  }
  const categories = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Flags
  const flags: string[] = [];
  const recorded = ribbon.filter((d) => d.entry);
  const lastThree = recorded.slice(-3);
  if (lastThree.length === 3 && lastThree.every((d) => d.band === "attention")) {
    flags.push("The last 3 recorded days in a row show a pattern of ‘needs attention’.");
  }
  const visitOrder = (visits ?? []).map((v) => v.id);
  const perCatSeq = new Map<string, Array<{ idx: number; completed: boolean }>>();
  for (const c of completions ?? []) {
    const cat =
      (c.care_plan_items as unknown as { category: string | null } | null)?.category ??
      "Uncategorised";
    const idx = visitOrder.indexOf(c.visit_log_id);
    if (idx < 0) continue;
    const arr = perCatSeq.get(cat) ?? [];
    arr.push({ idx, completed: c.completed });
    perCatSeq.set(cat, arr);
  }
  for (const [cat, arr] of perCatSeq) {
    arr.sort((a, b) => a.idx - b.idx);
    let streak = 0;
    let hit = false;
    for (const item of arr) {
      streak = item.completed ? 0 : streak + 1;
      if (streak >= 3) hit = true;
    }
    if (hit) flags.push(`"${cat}" tasks were left uncompleted on 3 or more visits in a row.`);
  }

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Last 14 days</p>
        <h1 className="mt-1 font-display text-3xl md:text-5xl">Wellbeing trends</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {activeName
            ? `A descriptive summary of what caregivers recorded for ${activeName}.`
            : isFamily
              ? "A descriptive summary of what caregivers recorded for your loved one."
              : "A descriptive summary of what caregivers recorded during recent check-ins."}
        </p>
      </header>

      {visitsPending && (
        <div className="mb-6">
          <LoadingState label="Loading the last 14 days…" />
        </div>
      )}

      {list.length > 1 && (
        <select
          aria-label="Choose a person"
          value={activeId}
          onChange={(e) => {
            setRecipientId(e.target.value);
            setSelectedDay(null);
          }}
          className="mb-6 min-h-10 w-full max-w-sm rounded-md border border-border bg-background px-4 text-sm"
        >
          {list.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      )}

      {flags.length > 0 && (
        <div className="card-soft mb-6 flex gap-4 border-l-4 border-gold bg-gold/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="font-medium">Pattern worth a conversation</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <section className="card-soft p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl">Day by day</h2>
          <DeltaBadge delta={delta} />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 sm:[grid-template-columns:repeat(14,minmax(0,1fr))]">
          {ribbon.map((d) => {
            const date = new Date(`${d.key}T00:00:00`);
            const active = activeDay?.key === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDay(d.key)}
                title={`${date.toLocaleDateString([], { month: "short", day: "numeric" })} · ${BAND_LABEL[d.band]}`}
                aria-label={`${date.toLocaleDateString([], { month: "short", day: "numeric" })}: ${BAND_LABEL[d.band]}`}
                className={`flex min-h-[3.25rem] min-w-0 flex-col items-center gap-1 rounded-lg p-1 transition ${
                  active ? "ring-2 ring-primary" : "hover:opacity-80"
                }`}
              >
                <span className={`h-10 w-full rounded-md ${BAND_CLASS[d.band]}`} />
                <span className="text-[10px] text-muted-foreground">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {(["good", "usual", "attention", "none"] as const).map((b) => (
            <span key={b} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-sm ${BAND_CLASS[b]}`} /> {BAND_LABEL[b]}
            </span>
          ))}
        </div>
      </section>

      <section className="card-soft mt-6 p-6">
        <h2 className="font-display text-2xl">Overall recorded score</h2>
        {chartData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No wellbeing check-ins recorded in the last 14 days.
          </p>
        ) : (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, _n, p) => [
                    `${v} · ${(p?.payload as { label?: string })?.label ?? ""}`,
                    "Score",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="currentColor"
                  className="text-primary"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          This screen shows trends and patterns from caregiver-recorded check-ins only. It is not a
          medical assessment and should not be used to make health decisions. If you have questions
          about your family member&apos;s wellbeing, please speak with their care team or a
          qualified healthcare professional.
        </p>
      </section>

      <section className="card-soft mt-6 p-6">
        <h2 className="font-display text-2xl">
          {activeDay
            ? new Date(`${activeDay.key}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : "Day detail"}
        </h2>
        {!activeDay?.entry ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No check-in was recorded on this day. Select another day in the ribbon above.
          </p>
        ) : (
          <>
            {(() => {
              const v = activeDay ? visitByDay.get(activeDay.key) : null;
              if (!v) return null;
              return (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Arrived{" "}
                    {new Date(v.clock_in).toLocaleTimeString([], { timeStyle: "short" })}
                    {v.clock_out
                      ? ` · left ${new Date(v.clock_out).toLocaleTimeString([], { timeStyle: "short" })} · ${formatDuration(v.clock_in, v.clock_out)}`
                      : " · visit in progress"}
                  </span>
                  <VerifiedBadge verified={v.location_verified} />
                </div>
              );
            })()}
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Mood" value={moodLabel(activeDay.entry.mood_scale)} />
              <Detail label="Appetite" value={capitalise(activeDay.entry.food_appetite)} />
              <Detail label="Medicine" value={medicineLabel(activeDay.entry.medicine_taken)} />
              <Detail
                label="Movement"
                value={
                  activeDay.entry.movement_assisted == null
                    ? null
                    : activeDay.entry.movement_assisted
                      ? "With help"
                      : "Independent"
                }
              />
              <Detail label="Hygiene" value={hygieneLabel(activeDay.entry)} />
            </dl>
            {(activeDay.entry.mood_notes || activeDay.entry.movement_notes) && (
              <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Caregiver notes
                </p>
                {activeDay.entry.mood_notes && (
                  <p className="mt-1 text-sm">{activeDay.entry.mood_notes}</p>
                )}
                {activeDay.entry.movement_notes && (
                  <p className="mt-1 text-sm">{activeDay.entry.movement_notes}</p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="card-soft mt-6 p-6">
        <h2 className="font-display text-2xl">Task completion by category</h2>
        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No checklist items were recorded in the last 14 days.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {categories.map(([cat, { done, total }]) => {
              const pct = Math.round((done / total) * 100);
              return (
                <li key={cat}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{cat}</span>
                    <span className="text-muted-foreground">
                      {pct}% · {done}/{total}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="text-sm text-muted-foreground">Not enough recorded days to compare</span>
    );
  }
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const tone = delta > 0 ? "text-primary" : delta < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`flex items-center gap-1.5 text-sm ${tone}`}>
      <Icon className="h-4 w-4" />
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}{" "}
      <span className="text-muted-foreground">compared to the week before</span>
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-xl">{value ?? "Not recorded"}</dd>
    </div>
  );
}

function capitalise(v: string | null) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : null;
}
function moodLabel(scale: number | null) {
  if (scale == null) return null;
  if (scale >= 4) return "Good";
  if (scale === 3) return "Usual";
  return "Needs attention";
}
function medicineLabel(v: string | null) {
  return v === "yes" ? "Taken" : v === "partial" ? "Partial" : v === "no" ? "Not taken" : null;
}
function hygieneLabel(e: Entry) {
  if (e.hygiene_bathing_completed == null && e.hygiene_grooming_completed == null) return null;
  const done = Number(!!e.hygiene_bathing_completed) + Number(!!e.hygiene_grooming_completed);
  return done === 2 ? "Both done" : done === 1 ? "Partial" : "Not completed";
}
