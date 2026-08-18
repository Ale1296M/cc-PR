import { supabase } from "@/integrations/supabase/client";
import { capturePosition } from "@/lib/geo";
import { withUpdatedBy } from "@/lib/soft-delete";

export type Geofence = {
  homeLat: number | null;
  homeLng: number | null;
  radiusM: number | null;
};

/** Distance from a point to the recipient's home, via the meters_between DB function. */
export async function distanceToHome(lat: number, lng: number, fence: Geofence) {
  if (fence.homeLat == null || fence.homeLng == null) return null;
  const { data, error } = await supabase.rpc("meters_between", {
    a_lat: lat,
    a_lng: lng,
    b_lat: fence.homeLat,
    b_lng: fence.homeLng,
  });
  if (error) return null;
  return typeof data === "number" ? data : null;
}

/**
 * Clock in a caregiver via the clock_in_visit RPC. The server sets the timestamp,
 * verifies the location and returns the visit row. If a visit already exists today
 * it returns that one — treat it as resuming today's visit.
 */
export async function clockInVisit(opts: { careRecipientId: string }) {
  const pos = await capturePosition();
  const { data, error } = await supabase.rpc("clock_in_visit", {
    _care_recipient_id: opts.careRecipientId,
    _lat: pos?.lat ?? undefined,
    _lng: pos?.lng ?? undefined,
    _accuracy: pos?.accuracy ?? undefined,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string;
    clock_in: string;
    location_verified: boolean | null;
    evv_exception: string | null;
  } | null;
  if (!row) throw new Error("Couldn't clock in — try again.");
  return row;
}

/** Clock out an open visit, capturing GPS again. */
export async function clockOutVisit(opts: {
  visitLogId: string;
  existingException?: string | null;
  notes?: string | null;
  mood?: string | null;
}) {
  const pos = await capturePosition();
  const clockOut = new Date().toISOString();
  const update: Record<string, unknown> = {
    clock_out: clockOut,
    clock_out_method: pos ? "gps" : "manual",
  };
  if (opts.notes !== undefined) update.notes = opts.notes || null;
  if (opts.mood !== undefined) update.mood = opts.mood || null;
  if (pos) {
    update.clock_out_lat = pos.lat;
    update.clock_out_lng = pos.lng;
    update.clock_out_accuracy_m = pos.accuracy;
  } else if (!opts.existingException) {
    update.evv_exception = "missing_gps";
  }
  const { error } = await supabase
    .from("visit_logs")
    .update((await withUpdatedBy(update)) as never)
    .eq("id", opts.visitLogId);
  if (error) throw error;
  return clockOut;
}

/** Insert or update the wellbeing entry attached to a visit. */
export async function saveWellbeingEntry(payload: {
  visit_log_id: string;
  mood_scale: number;
  food_appetite: "good" | "fair" | "poor";
  medicine_taken: "yes" | "no" | "partial";
  movement_assisted: boolean;
  hygiene_bathing_completed: boolean;
  hygiene_grooming_completed: boolean;
  mood_notes: string | null;
}) {
  const { data: existing } = await supabase
    .from("wellbeing_entries")
    .select("id")
    .eq("visit_log_id", payload.visit_log_id)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase.from("wellbeing_entries").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("wellbeing_entries").insert(payload);
    if (error) throw error;
  }
}
