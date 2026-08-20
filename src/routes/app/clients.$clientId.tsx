import { RoleGate } from "@/lib/role-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { AsyncEmpty, AsyncError, AsyncSkeleton } from "@/components/ui/async-state";
import { capturePosition, formatDuration } from "@/lib/geo";
import { VerifiedBadge } from "@/components/visits/VerifiedBadge";
import { clockInVisit, clockOutVisit } from "@/lib/visit-clock";
import { EmergencyContacts } from "@/components/recipients/EmergencyContacts";
import { RecipientIncidents } from "@/components/incidents/RecipientIncidents";

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
        .is("deleted_at", null)
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

  if (isPending) return <div>{back}<AsyncSkeleton shape="rows" count={4} /></div>;
  if (error)
    return <div>{back}<AsyncError what="this care recipient" error={error} onRetry={() => refetch()} /></div>;
  if (!recipient)
    return (
      <div>
        {back}
        <AsyncEmpty
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
        <h1 className="type-section mt-1">{recipient.full_name}</h1>
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

      <section className="mb-12">
        <h2 className="type-section mb-4">Care plan</h2>
        <p className="card-soft p-4 text-sm text-muted-foreground">
          Checklists now live per care recipient on the{" "}
          <Link to="/app/care-plan" className="text-primary underline">Care plan</Link> screen.
        </p>
      </section>

      {role === "admin" && <HomeLocationCard recipient={recipient} />}

      <EmergencyContacts careRecipientId={recipientId} canEdit={role === "admin"} />

      <RecipientIncidents careRecipientId={recipientId} recipientName={recipient.full_name} />

      <section>
        <h2 className="type-section mb-4">Recent visits</h2>
        {visitsPending && <AsyncSkeleton shape="rows" count={4} />}
        {visitsError && (
          <AsyncError what="recent visits" error={visitsError} onRetry={() => refetchVisits()} />
        )}
        {!visitsPending && !visitsError && (visits ?? []).length === 0 && (
          <AsyncEmpty
            title="No visits logged yet"
            hint="Visits appear here once a caregiver clocks in and out for this person."
          />
        )}
        <div className={`divide-y divide-border border-t border-border ${(visits ?? []).length === 0 ? "hidden" : ""}`}>
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
                {v.mood && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{v.mood}</span>}
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

function HomeLocationCard({
  recipient,
}: {
  recipient: { id: string; home_lat: number | null; home_lng: number | null; geofence_radius_m: number | null };
}) {
  const qc = useQueryClient();
  const [lat, setLat] = useState(recipient.home_lat?.toString() ?? "");
  const [lng, setLng] = useState(recipient.home_lng?.toString() ?? "");
  const [radius, setRadius] = useState((recipient.geofence_radius_m ?? 150).toString());
  const [locating, setLocating] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const latN = Number(lat);
      const lngN = Number(lng);
      const radN = Number(radius);
      if (!Number.isFinite(latN) || latN < -90 || latN > 90) throw new Error("Latitude must be between -90 and 90.");
      if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) throw new Error("Longitude must be between -180 and 180.");
      if (!Number.isFinite(radN) || radN < 25 || radN > 2000) throw new Error("Radius must be between 25 and 2000 metres.");
      const { error } = await supabase
        .from("care_recipients")
        .update({ home_lat: latN, home_lng: lngN, geofence_radius_m: Math.round(radN) })
        .eq("id", recipient.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Home location saved");
      qc.invalidateQueries({ queryKey: ["care-recipient", recipient.id] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save the home location — try again."),
  });

  async function useMyLocation() {
    setLocating(true);
    const pos = await capturePosition().finally(() => setLocating(false));
    if (!pos) {
      toast.error("Couldn't read your location — enter the coordinates manually.");
      return;
    }
    setLat(pos.lat.toFixed(6));
    setLng(pos.lng.toFixed(6));
  }

  const mapsUrl =
    recipient.home_lat != null && recipient.home_lng != null
      ? `https://www.google.com/maps?q=${recipient.home_lat},${recipient.home_lng}`
      : null;

  return (
    <section className="mb-12">
      <h2 className="type-section mb-4">Home location</h2>
      <div className="card-soft space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          Used to mark caregiver clock-ins as verified visits. Stand at the home and tap
          &ldquo;Use my current location&rdquo;, or paste coordinates from a map.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            Latitude
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              inputMode="decimal"
              placeholder="18.4655"
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-4 text-sm"
            />
          </label>
          <label className="text-sm">
            Longitude
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              inputMode="decimal"
              placeholder="-66.1057"
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-4 text-sm"
            />
          </label>
          <label className="text-sm">
            Radius (m)
            <input
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              inputMode="numeric"
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-4 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="min-h-10 rounded-full bg-primary px-6 text-sm text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save home location"}
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="min-h-10 rounded-full border border-border px-6 text-sm hover:bg-secondary/50 disabled:opacity-50"
          >
            {locating ? "Reading location…" : "Use my current location"}
          </button>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
              View on map
            </a>
          )}
        </div>
        {recipient.home_lat == null && (
          <p className="text-xs text-muted-foreground">
            No home location set yet — visits for this person can&apos;t be location-verified.
          </p>
        )}
      </div>
    </section>
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
        .is("deleted_at", null)
        .maybeSingle();
      return data;
    },
  });

  const clockIn = useMutation({
    mutationFn: async () => {
      setLocating(true);
      return clockInVisit({ careRecipientId }).finally(() => setLocating(false));
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
      const clockedOut = await clockOutVisit({
        visitLogId: active!.id,
        existingException: active!.evv_exception,
        notes,
        mood,
      }).finally(() => setLocating(false));
      return formatDuration(active!.clock_in, clockedOut);
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
    <div className="card-soft mt-6 p-6">
      <h3 className="type-subhead">Log a visit</h3>
      {!active ? (
        <>
          <button
            onClick={() => clockIn.mutate()}
            disabled={clockIn.isPending}
            className="mt-4 min-h-10 rounded-full bg-primary px-6 text-sm text-primary-foreground disabled:opacity-50"
          >
            {clockIn.isPending ? (locating ? "Checking location…" : "Clocking in…") : "Clock in now"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            We check your location to mark this as a verified visit. You can still clock in if you
            decline.
          </p>
        </>
      ) : (
        <div className="mt-4 space-y-4">
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
            className="min-h-11 w-full rounded-md border border-border bg-background px-4 text-sm"
          >
            <option value="">Mood…</option>
            {["Great", "Okay", "Tired", "Unwell", "Concern", "Cheerful"].map((m) => <option key={m}>{m}</option>)}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes from the visit…"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm"
          />
          <button
            onClick={() => clockOut.mutate()}
            disabled={clockOut.isPending}
            className="min-h-10 rounded-full bg-primary px-6 text-sm text-primary-foreground disabled:opacity-50"
          >
            {clockOut.isPending ? (locating ? "Checking location…" : "Saving…") : "Clock out & save"}
          </button>
        </div>
      )}
    </div>
  );
}
