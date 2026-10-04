import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Small localStorage queue for caregiver visit actions recorded without a connection.
 * Each job is replayed in order once the device is back online.
 */
export type QueuedJob =
  | { kind: "finish-visit"; id: string; createdAt: string; payload: FinishVisitPayload };

export type FinishVisitPayload = {
  visitLogId: string;
  existingException: string | null;
  notes: string | null;
  clockOut: string;
  pos: { lat: number; lng: number; accuracy: number | null } | null;
  wellbeing: {
    visit_log_id: string;
    mood_scale: number;
    food_appetite: "good" | "fair" | "poor";
    medicine_taken: "yes" | "no" | "partial";
    movement_assisted: boolean;
    hygiene_bathing_completed: boolean;
    hygiene_grooming_completed: boolean;
    mood_notes: string | null;
  };
};

const KEY = "ccpr-offline-queue-v1";
const listeners = new Set<() => void>();

function read(): QueuedJob[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedJob[];
  } catch {
    return [];
  }
}
function write(jobs: QueuedJob[]) {
  localStorage.setItem(KEY, JSON.stringify(jobs));
  cached = jobs;
  listeners.forEach((l) => l());
}
let cached: QueuedJob[] | null = null;
const snapshot = () => (cached ??= read());
const emptySnapshot: QueuedJob[] = [];

export function enqueue(job: QueuedJob) {
  write([...snapshot(), job]);
}
export function removeJob(id: string) {
  write(snapshot().filter((j) => j.id !== id));
}
export function listJobs() {
  return snapshot();
}

export function useQueuedJobs() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => emptySnapshot,
  );
}

/** True when the error looks like a lost connection rather than a server refusal. */
export function isNetworkError(e: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return /failed to fetch|network|load failed|fetch failed/i.test(msg);
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
