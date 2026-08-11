import { RoleGate } from "@/lib/role-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/wellbeing")({
  component: () => (
    <RoleGate allow={["admin", "caregiver"]}>
      <LogVisit />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Log a visit · Kindred" },
      {
        name: "description",
        content:
          "Caregiver check-in: record mood, appetite, medicine, movement and hygiene for today's visit.",
      },
      { property: "og:title", content: "Log a visit · Kindred" },
      {
        property: "og:description",
        content: "Record today's wellbeing check-in for a care recipient.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Recipient = { id: string; full_name: string };

const MOOD = [
  { label: "Good", value: 4 },
  { label: "Usual", value: 3 },
  { label: "Needs attention", value: 2 },
] as const;
const APPETITE = [
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
] as const;
const MEDICINE = [
  { label: "Taken", value: "yes" },
  { label: "Partial", value: "partial" },
  { label: "Not taken", value: "no" },
] as const;
const MOVEMENT = [
  { label: "Independent", value: "independent" },
  { label: "With help", value: "help" },
  { label: "Needs attention", value: "attention" },
] as const;
const HYGIENE = [
  { label: "Both done", value: "both" },
  { label: "Partial", value: "partial" },
  { label: "Not completed", value: "none" },
] as const;

function Choice<T extends string | number>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="card-soft p-5">
      <p className="font-display text-xl">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-xl border px-4 py-3 text-sm transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary/50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogVisit() {
  const { user } = useAuth();
  const uid = user?.id;

  const [recipientId, setRecipientId] = useState<string>("");
  const [mood, setMood] = useState<number | null>(null);
  const [appetite, setAppetite] = useState<string | null>(null);
  const [medicine, setMedicine] = useState<string | null>(null);
  const [movement, setMovement] = useState<string | null>(null);
  const [hygiene, setHygiene] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: recipients, isLoading } = useQuery({
    queryKey: ["logvisit-recipients", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Recipient[]> => {
      const { data: cg } = await supabase
        .from("caregivers")
        .select("id")
        .eq("profile_id", uid!)
        .maybeSingle();
      if (!cg?.id) return [];
      const { data, error: err } = await supabase
        .from("care_shifts")
        .select("care_recipients(id, full_name)")
        .eq("caregiver_id", cg.id);
      if (err) throw err;
      const map = new Map<string, Recipient>();
      for (const row of data ?? []) {
        const r = row.care_recipients as unknown as Recipient | null;
        if (r?.id) map.set(r.id, r);
      }
      return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const complete =
    recipientId && mood !== null && appetite && medicine && movement && hygiene;

  async function save() {
    if (!uid || !complete) return;
    setSaving(true);
    setError(null);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: existing } = await supabase
        .from("visit_logs")
        .select("id")
        .eq("caregiver_id", uid)
        .eq("care_recipient_id", recipientId)
        .gte("clock_in", startOfDay.toISOString())
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      let visitLogId = existing?.id ?? null;
      if (!visitLogId) {
        const now = new Date().toISOString();
        const { data: created, error: insErr } = await supabase
          .from("visit_logs")
          .insert({
            caregiver_id: uid,
            care_recipient_id: recipientId,
            clock_in: now,
            clock_out: now,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        visitLogId = created.id;
      }

      const payload = {
        visit_log_id: visitLogId,
        mood_scale: mood,
        food_appetite: appetite as "good" | "fair" | "poor",
        medicine_taken: medicine as "yes" | "no" | "partial",
        movement_assisted: movement !== "independent",
        hygiene_bathing_completed: hygiene === "both",
        hygiene_grooming_completed: hygiene !== "none",
        mood_notes: notes.trim() || null,
      };

      const { data: existingEntry } = await supabase
        .from("wellbeing_entries")
        .select("id")
        .eq("visit_log_id", visitLogId)
        .maybeSingle();

      if (existingEntry?.id) {
        const { error: upErr } = await supabase
          .from("wellbeing_entries")
          .update(payload)
          .eq("id", existingEntry.id);
        if (upErr) throw upErr;
      } else {
        const { error: entErr } = await supabase.from("wellbeing_entries").insert(payload);
        if (entErr) throw entErr;
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this check-in.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-4xl">Check-in saved</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Today&apos;s wellbeing check-in has been recorded for this care recipient.
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/app" className="rounded-xl bg-primary px-5 py-3 text-sm text-primary-foreground">
            Back to home
          </Link>
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setRecipientId("");
              setMood(null);
              setAppetite(null);
              setMedicine(null);
              setMovement(null);
              setHygiene(null);
              setNotes("");
            }}
            className="rounded-xl border border-border px-5 py-3 text-sm hover:bg-secondary/50"
          >
            Log another visit
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link
        to="/app"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <header className="mb-8 mt-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-1 font-display text-4xl md:text-5xl">Log a visit</h1>
      </header>

      <section>
        <h2 className="mb-3 font-display text-2xl">Who are you visiting?</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading care recipients…</p>}
        {!isLoading && (recipients ?? []).length === 0 && (
          <p className="card-soft p-5 text-sm text-muted-foreground">
            You have no care recipients assigned yet. Once a shift is assigned to you, they will
            appear here.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {(recipients ?? []).map((r) => {
            const active = recipientId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecipientId(r.id)}
                className={`card-soft p-5 text-left transition ${
                  active ? "ring-2 ring-primary" : "hover:bg-secondary/40"
                }`}
              >
                <p className="font-display text-xl">{r.full_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active ? "Selected" : "Tap to select"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {recipientId && (
        <section className="mt-8 space-y-4">
          <Choice title="Mood" options={MOOD} value={mood} onChange={setMood} />
          <Choice title="Appetite" options={APPETITE} value={appetite} onChange={setAppetite} />
          <Choice title="Medicine" options={MEDICINE} value={medicine} onChange={setMedicine} />
          <Choice title="Movement" options={MOVEMENT} value={movement} onChange={setMovement} />
          <Choice title="Hygiene" options={HYGIENE} value={hygiene} onChange={setHygiene} />

          <div className="card-soft p-5">
            <label htmlFor="notes" className="font-display text-xl">
              Notes <span className="text-sm text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anything the family should know about today's visit."
              className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="button"
            disabled={!complete || saving}
            onClick={save}
            className="w-full rounded-xl bg-primary px-5 py-4 text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save check-in"}
          </button>
        </section>
      )}
    </main>
  );
}
