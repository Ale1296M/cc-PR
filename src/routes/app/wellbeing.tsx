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
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/app/wellbeing")({
  component: WellbeingTrends,
  head: () => ({
    meta: [
      { title: "Wellbeing Trends · Kindred" },
      {
        name: "description",
        content:
          "Descriptive 30-day mood trends and task completion patterns for your care recipient.",
      },
      { property: "og:title", content: "Wellbeing Trends · Kindred" },
      {
        property: "og:description",
        content: "Descriptive 30-day mood trends and task completion patterns.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const MOOD_LABEL: Record<number, string> = {
  5: "Very good",
  4: "Good",
  3: "Usual",
  2: "Needs attention",
  1: "Needs attention",
};

type Recipient = { id: string; full_name: string };

function daysAgoISO(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function WellbeingTrends() {
  const { user } = useAuth();
  const uid = user?.id;
  const [recipientId, setRecipientId] = useState<string>("");
  const since = useMemo(() => daysAgoISO(30), []);

  const { data: recipients } = useQuery({
    queryKey: ["trends-recipients", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Recipient[]> => {
      const { data: cg } = await supabase
        .from("caregivers")
        .select("id")
        .eq("profile_id", uid!)
        .maybeSingle();
      let query = supabase.from("care_shifts").select("care_recipients(id, full_name)");
      if (cg?.id) query = query.eq("caregiver_id", cg.id);
      const { data, error } = await query;
      if (error) throw error;
      const map = new Map<string, Recipient>();
      for (const row of data ?? []) {
        const r = row.care_recipients as unknown as Recipient | null;
        if (r?.id) map.set(r.id, r);
      }
      return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const activeId = recipientId || recipients?.[0]?.id || "";

  const { data: visits } = useQuery({
    queryKey: ["trends-visits", activeId, since],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_logs")
        .select("id, clock_in, wellbeing_entries(mood_scale, mood_notes)")
        .eq("care_recipient_id", activeId)
        .gte("clock_in", since)
        .order("clock_in");
      if (error) throw error;
      return data ?? [];
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

  // Mood over time, grouped by date (average when multiple visits share a day)
  const byDate = new Map<string, { sum: number; count: number }>();
  for (const v of visits ?? []) {
    const entry = Array.isArray(v.wellbeing_entries)
      ? v.wellbeing_entries[0]
      : (v.wellbeing_entries as { mood_scale: number | null } | null);
    const score = entry?.mood_scale;
    if (score === null || score === undefined) continue;
    const key = new Date(v.clock_in).toISOString().slice(0, 10);
    const row = byDate.get(key) ?? { sum: 0, count: 0 };
    row.sum += score;
    row.count += 1;
    byDate.set(key, row);
  }
  const chartData = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, { sum, count }]) => {
      const mood = Math.round((sum / count) * 10) / 10;
      return {
        date: new Date(`${key}T00:00:00`).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }),
        mood,
        label: MOOD_LABEL[Math.round(mood)] ?? String(mood),
      };
    });

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

  const flags: string[] = [];
  const scores = chartData.map((d) => d.mood);
  const lastThree = scores.slice(-3);
  if (lastThree.length === 3 && lastThree.every((s) => s <= 2)) {
    flags.push("The last 3 recorded days in a row show a mood of ‘needs attention’.");
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
    if (hit) {
      flags.push(`"${cat}" tasks were left uncompleted on 3 or more visits in a row.`);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Last 30 days</p>
        <h1 className="mt-1 font-display text-4xl md:text-5xl">Wellbeing trends</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A descriptive summary of what caregivers recorded during recent check-ins.
        </p>
      </header>

      {(recipients ?? []).length > 1 && (
        <select
          value={activeId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="mb-6 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {(recipients ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      )}

      {flags.length > 0 && (
        <div className="card-soft mb-6 flex gap-3 border-l-4 border-gold bg-gold/10 p-4">
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

      <section className="card-soft p-5">
        <h2 className="font-display text-2xl">Mood recorded per day</h2>
        {chartData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No wellbeing check-ins recorded in the last 30 days.
          </p>
        ) : (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(_v, _n, p) => [
                    (p?.payload as { label?: string })?.label ?? "",
                    "Mood",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="currentColor"
                  className="text-primary"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          This screen shows trends and patterns from caregiver-recorded check-ins only. It is not a
          medical assessment and should not be used to make health decisions. If you have questions
          about your family member&apos;s wellbeing, please speak with their care team or a
          qualified healthcare professional.
        </p>
      </section>

      <section className="card-soft mt-6 p-5">
        <h2 className="font-display text-2xl">Task completion by category</h2>
        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No checklist items were recorded in the last 30 days.
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
