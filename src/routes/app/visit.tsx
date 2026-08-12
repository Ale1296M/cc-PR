import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RoleGate } from "@/lib/role-gate";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { VerifiedBadge } from "@/components/visits/VerifiedBadge";
import { formatDuration } from "@/lib/geo";
import { clockInVisit, clockOutVisit, saveWellbeingEntry } from "@/lib/visit-clock";

export const Route = createFileRoute("/app/visit")({
  component: () => (
    <RoleGate allow={["admin", "caregiver"]}>
      <VisitFlow />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Log a visit · Kindred" },
      {
        name: "description",
        content:
          "Clock in with location, record the wellbeing check-in, and clock out — all in one caregiver flow.",
      },
      { property: "og:title", content: "Log a visit · Kindred" },
      {
        property: "og:description",
        content: "Clock in, record today's wellbeing check-in, and clock out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Recipient = {
  id: string;
  full_name: string;
  home_lat: number | null;
  home_lng: number | null;
  geofence_radius_m: number | null;
};

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
              className={`min-h-11 rounded-xl border px-4 py-3 text-sm transition ${
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

function VisitFlow() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();

  const [picked, setPicked] = useState<string>("");
  const [mood, setMood] = useState<number | null>(null);
  const [appetite, setAppetite] = useState<string | null>(null);
  const [medicine, setMedicine] = useState<string | null>(null);
  const [movement, setMovement] = useState<string | null>(null);
  const [hygiene, setHygiene] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<{ name: string; duration: string } | null>(null);

  const {
    data: recipients,
    isPending: recipientsPending,
    error: recipientsError,
    refetch: refetchRecipients,
  } = useQuery({
    queryKey: ["visit-flow-recipients", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Recipient[]> => {
      const { data: cg } = await supabase
        .from("caregivers")
        .select("id")
        .eq("profile_id", uid!)
        .maybeSingle();
      if (!cg?.id) return [];
      const { data, error } = await supabase
        .from("care_shifts")
        .select("care_recipients(id, full_name, home_lat, home_lng, geofence_radius_m)")
        .eq("caregiver_id", cg.id);
      if (error) throw error;
      const map = new Map<string, Recipient>();
      for (const row of data ?? []) {
        const r = row.care_recipients as unknown as Recipient | null;
        if (r?.id) map.set(r.id, r);
      }
      return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const list = recipients ?? [];
  const recipientId = list.length === 1 ? list[0].id : picked;
  const recipient = list.find((r) => r.id === recipientId) ?? null;

  const { data: active, isPending: activePending } = useQuery({
    queryKey: ["visit-flow-active", recipientId, uid],
    enabled: !!uid && !!recipientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_logs")
        .select("id, clock_in, location_verified, evv_exception")
        .eq("care_recipient_id", recipientId)
        .eq("caregiver_id", uid!)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const clockIn = useMutation({
    mutationFn: async () => {
      if (!uid || !recipient) throw new Error("Pick a care recipient first.");
      return clockInVisit({
        caregiverId: uid,
        careRecipientId: recipient.id,
        fence: {
          homeLat: recipient.home_lat,
          homeLng: recipient.home_lng,
          radiusM: recipient.geofence_radius_m,
        },
      });
    },
    onSuccess: (row) => {
      toast.success(row.location_verified ? "Clocked in · location verified" : "Clocked in");
      qc.invalidateQueries({ queryKey: ["visit-flow-active", recipientId, uid] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't clock in — try again."),
  });

  const complete = mood !== null && appetite && medicine && movement && hygiene;

  const finish = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("You need to clock in first.");
      if (!complete) throw new Error("Complete the five check-in questions first.");
      await saveWellbeingEntry({
        visit_log_id: active.id,
        mood_scale: mood!,
        food_appetite: appetite as "good" | "fair" | "poor",
        medicine_taken: medicine as "yes" | "no" | "partial",
        movement_assisted: movement !== "independent",
        hygiene_bathing_completed: hygiene === "both",
        hygiene_grooming_completed: hygiene !== "none",
        mood_notes: notes.trim() || null,
      });
      const clockOut = await clockOutVisit({
        visitLogId: active.id,
        existingException: active.evv_exception,
        notes: notes.trim() || null,
      });
      return formatDuration(active.clock_in, clockOut);
    },
    onSuccess: (duration) => {
      toast.success(`Visit saved · ${duration}`);
      setDone({ name: recipient?.full_name ?? "", duration });
      qc.invalidateQueries({ queryKey: ["visit-flow-active", recipientId, uid] });
      qc.invalidateQueries({ queryKey: ["visits", recipientId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save the visit — try again."),
  });

  if (done) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-4xl">Visit saved</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {done.name ? `${done.name}'s visit` : "This visit"} was recorded · {done.duration}.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/app" className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm text-primary-foreground">
            Back to home
          </Link>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setPicked("");
              setMood(null);
              setAppetite(null);
              setMedicine(null);
              setMovement(null);
              setHygiene(null);
              setNotes("");
            }}
            className="min-h-11 rounded-xl border border-border px-5 py-3 text-sm hover:bg-secondary/50"
          >
            Log another visit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
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
        {recipientsPending && <LoadingState label="Loading your care recipients…" />}
        {recipientsError && (
          <ErrorState
            what="your care recipients"
            error={recipientsError}
            onRetry={() => refetchRecipients()}
          />
        )}
        {!recipientsPending && !recipientsError && list.length === 0 && (
          <EmptyState
            title="No care recipients assigned yet"
            hint="Once the care team assigns you a shift, the people you visit appear here and you can log their visit."
          />
        )}
        {list.length === 1 && (
          <p className="card-soft p-5 font-display text-2xl">Visiting {list[0].full_name}</p>
        )}
        {list.length > 1 && (
          <>
            <h2 className="mb-3 font-display text-2xl">Who are you visiting?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((r) => {
                const activeSel = recipientId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPicked(r.id)}
                    className={`card-soft min-h-11 p-5 text-left transition ${
                      activeSel ? "ring-2 ring-primary" : "hover:bg-secondary/40"
                    }`}
                  >
                    <p className="font-display text-xl">{r.full_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeSel ? "Selected" : "Tap to select"}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {recipient && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-2xl">Clock in</h2>
          {activePending ? (
            <LoadingState label="Checking for an open visit…" />
          ) : !active ? (
            <div className="card-soft p-5">
              <button
                type="button"
                onClick={() => clockIn.mutate()}
                disabled={clockIn.isPending}
                className="min-h-11 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
              >
                {clockIn.isPending ? "Checking location…" : "Clock in now"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                We check your location to mark this as a verified visit. You can still clock in if
                you decline.
              </p>
            </div>
          ) : (
            <div className="card-soft flex flex-wrap items-center gap-3 p-5">
              <p className="text-sm">
                Clocked in at{" "}
                {new Date(active.clock_in).toLocaleTimeString([], { timeStyle: "short" })}
              </p>
              <VerifiedBadge verified={active.location_verified} />
              {active.location_verified === false && (
                <span className="text-xs text-muted-foreground">
                  {active.evv_exception === "missing_gps"
                    ? "Location wasn’t shared."
                    : "Recorded away from the home address."}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {recipient && active && (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-2xl">Wellbeing check-in</h2>
          <Choice title="Mood" options={MOOD} value={mood} onChange={setMood} />
          <Choice title="Appetite" options={APPETITE} value={appetite} onChange={setAppetite} />
          <Choice title="Medicine" options={MEDICINE} value={medicine} onChange={setMedicine} />
          <Choice title="Movement" options={MOVEMENT} value={movement} onChange={setMovement} />
          <Choice title="Hygiene" options={HYGIENE} value={hygiene} onChange={setHygiene} />

          <div className="card-soft p-5">
            <label htmlFor="visit-notes" className="font-display text-xl">
              Notes <span className="text-sm text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anything the family should know about today's visit."
              className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
          </div>

          <button
            type="button"
            disabled={!complete || finish.isPending}
            onClick={() => finish.mutate()}
            className="min-h-11 w-full rounded-xl bg-primary px-5 py-4 text-primary-foreground disabled:opacity-50"
          >
            {finish.isPending ? "Saving…" : "Clock out & save visit"}
          </button>
        </section>
      )}
    </div>
  );
}
