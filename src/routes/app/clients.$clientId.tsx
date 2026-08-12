import { RoleGate } from "@/lib/role-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { capturePosition, formatDuration } from "@/lib/geo";
import { VerifiedBadge } from "@/components/visits/VerifiedBadge";

export const Route = createFileRoute("/app/clients/$clientId")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <CareRecipientDetail />
    </RoleGate>
  ),
});

function CareRecipientDetail() {
  const { clientId: recipientId } = Route.useParams();
  const { role } = useAuth();
  const {
    data: recipient,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["care-recipient", recipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_recipients")
        .select("*")
        .eq("id", recipientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: visits,
    isPending: visitsPending,
    error: visitsError,
    refetch: refetchVisits,
  } = useQuery({
    queryKey: ["visits", recipientId],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("visit_logs")
        .select(
          "id, clock_in, clock_out, notes, mood, caregiver_id, location_verified, evv_exception, profiles:caregiver_id(full_name)",
        )
        .eq("care_recipient_id", recipientId)
        .order("clock_in", { ascending: false })
        .limit(10);
      if (e) throw e;
      return data ?? [];
    },
  });

  const back = (
    <Link to="/app/clients" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> All care recipients
    </Link>
  );

  if (isPending) return <div>{back}<LoadingState label="Loading this care recipient…" /></div>;
  if (error)
    return <div>{back}<ErrorState what="this care recipient" error={error} onRetry={() => refetch()} /></div>;
  if (!recipient)
    return (
      <div>
        {back}
        <EmptyState
          title="Care recipient not found"
          hint="They may have been removed. Head back to the roster to pick someone else."
        />
      </div>
    );

  const address = [recipient.address_line, recipient.municipality ?? recipient.city, recipient.zip_code]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      {back}

      <header className="card-soft mb-8 p-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Care recipient</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">{recipient.full_name}</h1>
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {address && <p>📍 {address}</p>}
          {recipient.date_of_birth && <p>🎂 {new Date(recipient.date_of_birth).toLocaleDateString()}</p>}
          {recipient.emergency_contact_name && (
            <p>
              👥 {recipient.emergency_contact_name}
              {recipient.emergency_contact_phone ? ` · ${recipient.emergency_contact_phone}` : ""}
            </p>
          )}
        </div>
        {recipient.notes && <p className="mt-4 text-sm">{recipient.notes}</p>}
      </header>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-2xl">Care plan</h2>
        <p className="card-soft p-4 text-sm text-muted-foreground">
          Checklists now live per care recipient on the{" "}
          <Link to="/app/care-plan" className="text-primary underline">Care plan</Link> screen.
        </p>
      </section>

      {role === "admin" && <HomeLocationCard recipient={recipient} />}

      <section>
        <h2 className="mb-3 font-display text-2xl">Recent visits</h2>
        {visitsPending && <LoadingState label="Loading recent visits…" />}
        {visitsError && (
          <ErrorState what="recent visits" error={visitsError} onRetry={() => refetchVisits()} />
        )}
        {!visitsPending && !visitsError && (visits ?? []).length === 0 && (
          <EmptyState
            title="No visits logged yet"
            hint="Visits appear here once a caregiver clocks in and out for this person."
          />
        )}
        <div className={`card-soft divide-y divide-border ${(visits ?? []).length === 0 ? "hidden" : ""}`}>
          {(visits ?? []).map((v) => (
            <div key={v.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {new Date(v.clock_in).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    {v.clock_out
                      ? ` – ${new Date(v.clock_out).toLocaleTimeString([], { timeStyle: "short" })}`
                      : ""}
                  </p>
                  <VerifiedBadge verified={v.location_verified} />
                </div>
                {v.mood && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs">{v.mood}</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                by {(v.profiles as unknown as { full_name: string } | null)?.full_name ?? "Caregiver"}
                {v.clock_out ? ` · ${formatDuration(v.clock_in, v.clock_out)}` : " · in progress"}
              </p>
              {v.location_verified === false && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.evv_exception === "missing_gps"
                    ? "Location wasn’t shared for this visit."
                    : "Recorded away from the home address."}
                </p>
              )}
              {v.notes && <p className="mt-2 text-sm">{v.notes}</p>}
            </div>
          ))}
        </div>

        {role === "caregiver" && (
          <ClockInBar
            careRecipientId={recipientId}
            homeLat={recipient.home_lat}
            homeLng={recipient.home_lng}
            radiusM={recipient.geofence_radius_m}
          />
        )}
      </section>
    </div>
  );
}

function ClockInBar({
  careRecipientId,
  homeLat,
  homeLng,
  radiusM,
}: {
  careRecipientId: string;
  homeLat: number | null;
  homeLng: number | null;
  radiusM: number | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState("");
  const [locating, setLocating] = useState(false);

  async function distanceMeters(lat: number, lng: number) {
    if (homeLat == null || homeLng == null) return null;
    const { data, error } = await supabase.rpc("meters_between", {
      a_lat: lat,
      a_lng: lng,
      b_lat: homeLat,
      b_lng: homeLng,
    });
    if (error) return null;
    return typeof data === "number" ? data : null;
  }

  const { data: active } = useQuery({
    queryKey: ["active-visit", careRecipientId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("visit_logs")
        .select("*")
        .eq("care_recipient_id", careRecipientId)
        .eq("caregiver_id", user!.id)
        .is("clock_out", null)
        .maybeSingle();
      return data;
    },
  });

  const clockIn = useMutation({
    mutationFn: async () => {
      setLocating(true);
      const pos = await capturePosition().finally(() => setLocating(false));
      let payload: Record<string, unknown> = {
        care_recipient_id: careRecipientId,
        caregiver_id: user!.id,
        clock_in: new Date().toISOString(),
      };
      if (!pos) {
        payload = { ...payload, clock_in_method: "manual", location_verified: false, evv_exception: "missing_gps" };
      } else {
        const dist = await distanceMeters(pos.lat, pos.lng);
        const radius = radiusM ?? 150;
        const verified = dist != null && dist <= radius;
        payload = {
          ...payload,
          clock_in_lat: pos.lat,
          clock_in_lng: pos.lng,
          clock_in_accuracy_m: pos.accuracy,
          clock_in_method: "gps",
          location_verified: verified,
          evv_exception: verified ? null : "out_of_range",
        };
      }
      const { error } = await supabase.from("visit_logs").insert(payload as never);
      if (error) throw error;
      return payload as { location_verified?: boolean };
    },
    onSuccess: (res) => {
      toast.success(res?.location_verified ? "Clocked in · location verified" : "Clocked in");
      qc.invalidateQueries({ queryKey: ["active-visit", careRecipientId, user?.id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't clock in — try again."),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      setLocating(true);
      const pos = await capturePosition().finally(() => setLocating(false));
      const update: Record<string, unknown> = {
        clock_out: new Date().toISOString(),
        notes: notes || null,
        mood: mood || null,
        clock_out_method: pos ? "gps" : "manual",
      };
      if (pos) {
        update.clock_out_lat = pos.lat;
        update.clock_out_lng = pos.lng;
        update.clock_out_accuracy_m = pos.accuracy;
      } else if (!active!.evv_exception) {
        update.evv_exception = "missing_gps";
      }
      const { error } = await supabase
        .from("visit_logs")
        .update(update as never)
        .eq("id", active!.id);
      if (error) throw error;
      return formatDuration(active!.clock_in, update.clock_out as string);
    },
    onSuccess: (duration) => {
      toast.success(`Visit saved · ${duration}`);
      setNotes(""); setMood("");
      qc.invalidateQueries({ queryKey: ["active-visit", careRecipientId, user?.id] });
      qc.invalidateQueries({ queryKey: ["visits", careRecipientId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save the visit — try again."),
  });

  return (
    <div className="card-soft mt-6 p-5">
      <h3 className="font-display text-xl">Log a visit</h3>
      {!active ? (
        <>
          <button
            onClick={() => clockIn.mutate()}
            disabled={clockIn.isPending}
            className="mt-3 min-h-10 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {clockIn.isPending ? (locating ? "Checking location…" : "Clocking in…") : "Clock in now"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            We check your location to mark this as a verified visit. You can still clock in if you
            decline.
          </p>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Clocked in at {new Date(active.clock_in).toLocaleTimeString([], { timeStyle: "short" })}
            </p>
            <VerifiedBadge verified={active.location_verified} />
          </div>
          <select
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            aria-label="Mood"
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Mood…</option>
            {["Great", "Okay", "Tired", "Unwell", "Concern", "Cheerful"].map((m) => <option key={m}>{m}</option>)}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes from the visit…"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => clockOut.mutate()}
            disabled={clockOut.isPending}
            className="min-h-10 rounded-full bg-primary px-5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {clockOut.isPending ? (locating ? "Checking location…" : "Saving…") : "Clock out & save"}
          </button>
        </div>
      )}
    </div>
  );
}
