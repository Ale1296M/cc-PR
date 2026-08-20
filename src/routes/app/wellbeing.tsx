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
import { fetchMyFamilyRecipients } from "@/lib/family-access";
import { AsyncEmpty, AsyncError, AsyncSkeleton } from "@/components/ui/async-state";
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
  attention: "bg-attention",
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
        // family_member: every recipient of every family they belong to
        const mine = await fetchMyFamilyRecipients(uid!);
        mine.forEach(add);
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
        .is("deleted_at", null)
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
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Last 14 days
        </p>
        <h1 className="type-section mt-1">Wellbeing trends</h1>
      </header>
      {children}
    </div>
  );

  if (recipientsPending) return shell(<AsyncSkeleton shape="rows" count={4} />);
  if (recipientsError)
    return shell(
      <AsyncError
        what="the wellbeing trends"
        error={recipientsError}
        onRetry={() => refetchRecipients()}
      />,
    );
  if (list.length === 0)
    return shell(
      <AsyncEmpty
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
      <AsyncError what="the wellbeing check-ins" error={visitsError} onRetry={() => refetchVisits()} />,
    );
  if (!visitsPending && (visits ?? []).length === 0)
    return shell(
      <>
        {list.length > 1 && (
          <select
            aria-label="Choose a person"
            value={activeId}
            onChange={(e) => {
              setRecipientId(e.target.value);
              setSelectedDay(null);
            }}
            className="mb-6 min-h-11 w-full max-w-sm rounded-md border border-border bg-background px-4 text-sm"
          >
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        )}
        <AsyncEmpty
          title={`No check-ins recorded yet${activeName ? ` for ${activeName}` : ""}.`}
          hint="Caregivers record mood, medicine, food, movement and hygiene during each visit — those check-ins will show up here."
        />
      </>,
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

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const scored = ribbon.filter((d) => d.score != null);

  const chartData = ribbon
    .filter((d) => d.score != null)
    .map((d) => ({
      date: new Date(`${d.key}T00:00:00`).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      score: d.score as number,
      label: BAND_LABEL[d.band],
    }));

  const thisWeek = avg(
    ribbon.slice(7).map((d) => d.score).filter((s): s is number => s != null),
  );
  const lastWeek = avg(
    ribbon.slice(0, 7).map((d) => d.score).filter((s): s is number => s != null),
  );
  const delta =
    thisWeek != null && lastWeek != null ? Math.round((thisWeek - lastWeek) * 10) / 10 : null;

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
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {new Date()
            .toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
            .toUpperCase()}
        </p>
        <h1 className="type-section mt-1">Wellbeing trends</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Real-time daily wellness monitoring history
        </p>
      </header>

      {visitsPending && (
        <div className="mb-6">
          <AsyncSkeleton shape="rows" count={4} />
        </div>
      )}

      {list.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label htmlFor="wb-recipient" className="text-sm text-muted-foreground">
            Care recipient profile:
          </label>
          <select
            id="wb-recipient"
            value={activeId}
            onChange={(e) => {
              setRecipientId(e.target.value);
              setSelectedDay(null);
            }}
            className="min-h-11 w-full max-w-sm rounded-md border border-border bg-secondary/40 px-4 text-sm"
          >
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </div>
      )}


      {flags.length > 0 && (
        <div className="mb-6 flex gap-4 rounded-lg border-l-2 border-attention bg-attention-soft/60 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-attention" />
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
          <h2 className="type-section">Daily wellness records map</h2>
          <span className="text-xs text-muted-foreground">Last 14 days summary history</span>
        </div>
        <div className="mt-1">
          <DeltaBadge delta={delta} />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 sm:grid-cols-14">
          {ribbon.map((d) => {
            const date = new Date(`${d.key}T00:00:00`);
            const short = date.toLocaleDateString([], { month: "short", day: "numeric" });
            const active = activeDay?.key === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDay(d.key)}
                title={`${short} · ${BAND_LABEL[d.band]}`}
                aria-label={`${short}: ${BAND_LABEL[d.band]}`}
                className={`flex min-h-[3.25rem] min-w-0 flex-col items-center gap-1 rounded-lg p-1 transition ${
                  active ? "ring-2 ring-primary" : "hover:opacity-80"
                }`}
              >
                <span className={`h-10 w-full rounded-md ${BAND_CLASS[d.band]}`} />
                <span className="text-[10px] text-muted-foreground">
                  {date.getDate()} {date.toLocaleDateString([], { month: "short" })}
                </span>
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
        <h2 className="type-section">Overall recorded score trend</h2>

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
        <p className="mt-3 text-xs italic text-muted-foreground">
          Disclaimer: Scoring index evaluates cognitive wellness, physical activity levels, and
          daily nutrition charts.
        </p>
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          This screen shows trends and patterns from caregiver-recorded check-ins only. It is not a
          medical assessment and should not be used to make health decisions. If you have questions
          about your family member&apos;s wellbeing, please speak with their care team or a
          qualified healthcare professional.
        </p>

      </section>

      <section className="card-soft mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-section">
            {activeDay
              ? `${new Date(`${activeDay.key}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })} detail`
              : "Day detail"}
          </h2>
          {activeDay?.band === "attention" && (
            <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive">
              Alert
            </span>
          )}
        </div>
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
                    Arrival{" "}
                    {new Date(v.clock_in).toLocaleTimeString([], { timeStyle: "short" })}
                    {v.clock_out
                      ? ` · Departure ${new Date(v.clock_out).toLocaleTimeString([], { timeStyle: "short" })} · ${formatDuration(v.clock_in, v.clock_out)}`
                      : " · visit in progress"}
                  </span>
                  <VerifiedBadge verified={v.location_verified} />
                </div>
              );
            })()}
            <dl className="mt-4 divide-y divide-border border-t border-border">
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

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="type-section">Task completion by category</h2>
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

function valueTone(value: string | null) {
  if (!value) return "bg-secondary text-secondary-foreground";
  const v = value.toLowerCase();
  if (["good", "taken", "independent", "complete", "completed"].some((k) => v.includes(k)))
    return "bg-primary/15 text-primary";
  if (["poor", "not taken", "not completed", "needs attention"].some((k) => v.includes(k)))
    return "bg-destructive/10 text-destructive";
  if (["partial", "with help", "fair", "usual"].some((k) => v.includes(k)))
    return "bg-attention/20 text-attention-foreground";
  return "bg-secondary text-secondary-foreground";
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>
        <span className={`rounded-full px-3 py-1 text-xs ${valueTone(value)}`}>
          {value ?? "Not recorded"}
        </span>
      </dd>
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
