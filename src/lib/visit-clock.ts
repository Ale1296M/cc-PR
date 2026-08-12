import { supabase } from "@/integrations/supabase/client";
import { capturePosition } from "@/lib/geo";

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

/** Clock in a caregiver, capturing GPS and computing verification. Never blocks on GPS. */
export async function clockInVisit(opts: {
  caregiverId: string;
  careRecipientId: string;
  fence: Geofence;
}) {
  const pos = await capturePosition();
  let payload: Record<string, unknown> = {
    care_recipient_id: opts.careRecipientId,
    caregiver_id: opts.caregiverId,
    clock_in: new Date().toISOString(),
  };
  if (!pos) {
    payload = {
      ...payload,
      clock_in_method: "manual",
      location_verified: false,
      evv_exception: "missing_gps",
    };
  } else {
    const dist = await distanceToHome(pos.lat, pos.lng, opts.fence);
    const verified = dist != null && dist <= (opts.fence.radiusM ?? 150);
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
  const { data, error } = await supabase
    .from("visit_logs")
    .insert(payload as never)
    .select("id, clock_in, location_verified, evv_exception")
    .single();
  if (error) throw error;
  return data;
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
    .update(update as never)
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
