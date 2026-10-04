import { supabase } from "@/integrations/supabase/client";
import { capturePosition, type CapturedPosition } from "@/lib/geo";
import { withUpdatedBy } from "@/lib/soft-delete";
import {
  enqueue,
  isNetworkError,
  listJobs,
  removeJob,
  type FinishVisitPayload,
} from "@/lib/offline-queue";

export type Geofence = {
  homeLat: number | null;
  homeLng: number | null;
  radiusM: number | null;
};

/** Haversine distance in metres — mirrors the meters_between DB function. */
export function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Distance from a point to the recipient's home, or null when no home is set. */
export function distanceToHome(lat: number, lng: number, fence: Geofence) {
  if (fence.homeLat == null || fence.homeLng == null) return null;
  return metersBetween(lat, lng, fence.homeLat, fence.homeLng);
}

/**
 * Clock in a caregiver via the clock_in_visit RPC. The server sets the timestamp,
 * verifies the location and returns the visit row. If a visit already exists today
 * it returns that one — treat it as resuming today's visit.
 */
export async function clockInVisit(opts: { careRecipientId: string; fence?: Geofence }) {
  const pos = await capturePosition();
  const { data, error } = await supabase.rpc("clock_in_visit", {
    _care_recipient_id: opts.careRecipientId,
    _lat: pos?.lat ?? undefined,
    _lng: pos?.lng ?? undefined,
    _accuracy: pos?.accuracy ?? undefined,
  });
  if (error) {
    if (isNetworkError(error)) {
      throw new Error("You're offline — clocking in needs a connection. Try again in a moment.");
    }
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string;
    clock_in: string;
    location_verified: boolean | null;
    evv_exception: string | null;
  } | null;
  if (!row) throw new Error("Couldn't clock in — try again.");
  const distanceM = pos && opts.fence ? distanceToHome(pos.lat, pos.lng, opts.fence) : null;
  return { ...row, distanceM, radiusM: opts.fence?.radiusM ?? 150 };
}

async function writeClockOut(opts: {
  visitLogId: string;
  existingException?: string | null;
  notes?: string | null;
  clockOut: string;
  pos: CapturedPosition | null;
}) {
  const update: Record<string, unknown> = {
    clock_out: opts.clockOut,
    clock_out_method: opts.pos ? "gps" : "manual",
  };
  if (opts.notes !== undefined) update.notes = opts.notes || null;
  if (opts.pos) {
    update.clock_out_lat = opts.pos.lat;
    update.clock_out_lng = opts.pos.lng;
    update.clock_out_accuracy_m = opts.pos.accuracy;
  } else if (!opts.existingException) {
    update.evv_exception = "missing_gps";
  }
  const { error } = await supabase
    .from("visit_logs")
    .update((await withUpdatedBy(update)) as never)
    .eq("id", opts.visitLogId);
  if (error) throw error;
}

/** Clock out an open visit, capturing GPS again. */
export async function clockOutVisit(opts: {
  visitLogId: string;
  existingException?: string | null;
  notes?: string | null;
}) {
  const pos = await capturePosition();
  const clockOut = new Date().toISOString();
  await writeClockOut({ ...opts, clockOut, pos });
  return clockOut;
}

/** Insert or update the wellbeing entry attached to a visit. */
export async function saveWellbeingEntry(payload: FinishVisitPayload["wellbeing"]) {
  const { data: existing, error: readErr } = await supabase
    .from("wellbeing_entries")
    .select("id")
    .eq("visit_log_id", payload.visit_log_id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing?.id) {
    const { error } = await supabase.from("wellbeing_entries").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("wellbeing_entries").insert(payload);
    if (error) throw error;
  }
}

async function runFinish(p: FinishVisitPayload) {
  await saveWellbeingEntry(p.wellbeing);
  await writeClockOut({
    visitLogId: p.visitLogId,
    existingException: p.existingException,
    notes: p.notes,
    clockOut: p.clockOut,
    pos: p.pos,
  });
}

/**
 * Save the wellbeing check-in and clock out. Time and GPS are captured on the device first,
 * so if the connection drops the visit is stored locally and synced later with its real time.
 */
export async function finishVisit(opts: {
  visitLogId: string;
  existingException: string | null;
  notes: string | null;
  wellbeing: FinishVisitPayload["wellbeing"];
}): Promise<{ clockOut: string; queued: boolean }> {
  const pos = await capturePosition();
  const payload: FinishVisitPayload = { ...opts, clockOut: new Date().toISOString(), pos };
  try {
    await runFinish(payload);
    return { clockOut: payload.clockOut, queued: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    enqueue({
      kind: "finish-visit",
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      payload,
    });
    return { clockOut: payload.clockOut, queued: true };
  }
}

let flushing = false;
/** Replay stored visits. Returns how many synced. */
export async function flushOfflineQueue() {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    for (const job of listJobs()) {
      try {
        await runFinish(job.payload);
        removeJob(job.id);
        synced++;
      } catch (e) {
        if (isNetworkError(e)) break;
        // Server refused (e.g. visit deleted) — drop it so it doesn't block the queue.
        console.error("Dropping queued visit", e);
        removeJob(job.id);
      }
    }
  } finally {
    flushing = false;
  }
  return synced;
}
