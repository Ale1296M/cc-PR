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
    ],
  }),
});

const MOOD_SCORE: Record<string, number> = {
  Cheerful: 5,
  Great: 5,
  Okay: 4,
  Tired: 3,
  Unwell: 2,
  Concern: 1,
};
const CONCERN_MOODS = new Set(["Concern", "Unwell"]);

function daysAgoISO(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function WellbeingTrends() {
  const [clientId, setClientId] = useState<string>("");
  const since = useMemo(() => daysAgoISO(30), []);

  const { data: clients } = useQuery({
    queryKey: ["wb-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeId = clientId || clients?.[0]?.id || "";

  const { data: visits } = useQuery({
    queryKey: ["wb-visits", activeId, since],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_logs")
        .select("id, clock_in, mood")
        .eq("client_id", activeId)
        .gte("clock_in", since)
        .order("clock_in");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: completions } = useQuery({
    queryKey: ["wb-tasks", activeId, since],
    enabled: !!activeId,
    queryFn: async () => {
      const ids = (visits ?? []).map((v) => v.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("care_plan_completions")
        .select("id, completed, visit_log_id, care_plan_items(category, task_description)")
        .in("visit_log_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const chartData = (visits ?? [])
    .filter((v) => v.mood && MOOD_SCORE[v.mood] !== undefined)
    .map((v) => ({
      date: new Date(v.clock_in).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      mood: MOOD_SCORE[v.mood as string],
      label: v.mood as string,
    }));

  // Task completion rate per checklist category
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

  // Flags — descriptive patterns only
  const flags: string[] = [];
  const moods = (visits ?? []).filter((v) => v.mood).map((v) => v.mood as string);
  const lastThree = moods.slice(-3);
  if (lastThree.length === 3 && lastThree.every((m) => CONCERN_MOODS.has(m))) {
    flags.push("The last 3 visits in a row were recorded with a mood of concern.");
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
          A descriptive summary of what caregivers recorded during recent visits.
        </p>
      </header>

      {(clients ?? []).length > 1 && (
        <select
          value={activeId}
          onChange={(e) => setClientId(e.target.value)}
          className="mb-6 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
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
        <h2 className="font-display text-2xl">Mood recorded per visit</h2>
        {chartData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No mood entries recorded in the last 30 days.
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
          This screen shows trends and patterns from caregiver-recorded visit notes only. It is not
          a medical assessment and should not be used to make health decisions. If you have
          questions about your family member&apos;s wellbeing, please speak with their care team or
          a qualified healthcare professional.
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