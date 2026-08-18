/**
 * Mock data for the role dashboards.
 * NOTE: these screens are demo/UI-first. The production data lives in the
 * Supabase-backed /app routes; wiring these dashboards to it is a TODO.
 */

export type TaskState = "completed" | "pending" | "skipped";

export type CarePlanTask = {
  id: string;
  label: string;
  category: "Medications" | "Meals" | "Mobility";
  state: TaskState;
  reason?: string;
};

export const carePlanTasks: CarePlanTask[] = [
  { id: "t1", label: "Morning blood pressure medication", category: "Medications", state: "completed" },
  { id: "t2", label: "Evening insulin", category: "Medications", state: "pending" },
  { id: "t3", label: "Vitamin D supplement", category: "Medications", state: "pending" },
  { id: "t4", label: "Prepare low-sodium breakfast", category: "Meals", state: "completed" },
  { id: "t5", label: "Hydration check (6 glasses)", category: "Meals", state: "pending" },
  { id: "t6", label: "Assisted walk — 15 minutes", category: "Mobility", state: "pending" },
  { id: "t7", label: "Range-of-motion exercises", category: "Mobility", state: "skipped", reason: "Client reported knee pain" },
];

export type TimelineBlock = {
  id: string;
  hour: string;
  client: string;
  summary: string;
  status: "done" | "active" | "upcoming";
  verified: boolean;
};

export const caregiverTimeline: TimelineBlock[] = [
  { id: "b1", hour: "08:00", client: "Eleanor Rodriguez", summary: "Morning care · meds & breakfast", status: "done", verified: true },
  { id: "b2", hour: "10:00", client: "Harold Pagan", summary: "Mobility session", status: "done", verified: true },
  { id: "b3", hour: "12:00", client: "Rosa Quinones", summary: "Lunch & medication review", status: "active", verified: false },
  { id: "b4", hour: "15:00", client: "Miguel Santana", summary: "Afternoon check-in", status: "upcoming", verified: false },
  { id: "b5", hour: "17:30", client: "Carmen Delgado", summary: "Evening care · hygiene", status: "upcoming", verified: false },
];

export type Caregiver = { id: string; name: string; phone: string; status: "active" | "onboarding" | "inactive"; clients: number; check: "cleared" | "pending" };

export const caregivers: Caregiver[] = [
  { id: "c1", name: "Maya Torres", phone: "+1 787 555 0142", status: "active", clients: 4, check: "cleared" },
  { id: "c2", name: "Sam Delgado", phone: "+1 787 555 0188", status: "active", clients: 3, check: "cleared" },
  { id: "c3", name: "Luis Ortega", phone: "+1 787 555 0110", status: "onboarding", clients: 0, check: "pending" },
  { id: "c4", name: "Ivelisse Cruz", phone: "+1 787 555 0155", status: "active", clients: 5, check: "cleared" },
  { id: "c5", name: "Pedro Nieves", phone: "+1 787 555 0177", status: "inactive", clients: 0, check: "cleared" },
  { id: "c6", name: "Ana Melendez", phone: "+1 787 555 0121", status: "active", clients: 2, check: "cleared" },
  { id: "c7", name: "Jorge Rivas", phone: "+1 787 555 0133", status: "active", clients: 3, check: "pending" },
  { id: "c8", name: "Nilda Vega", phone: "+1 787 555 0166", status: "active", clients: 1, check: "cleared" },
  { id: "c9", name: "Rafael Soto", phone: "+1 787 555 0199", status: "onboarding", clients: 0, check: "pending" },
  { id: "c10", name: "Diana Lugo", phone: "+1 787 555 0102", status: "active", clients: 4, check: "cleared" },
  { id: "c11", name: "Hector Marrero", phone: "+1 787 555 0104", status: "active", clients: 2, check: "cleared" },
  { id: "c12", name: "Sofia Ramos", phone: "+1 787 555 0106", status: "active", clients: 3, check: "cleared" },
];

export const clients = [
  "Eleanor Rodriguez",
  "Harold Pagan",
  "Rosa Quinones",
  "Miguel Santana",
  "Carmen Delgado",
];

export const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type MatrixShift = { caregiverId: string; day: string; label: string; conflict?: boolean };

export const matrixShifts: MatrixShift[] = [
  { caregiverId: "c1", day: "Mon", label: "8a–12p" },
  { caregiverId: "c1", day: "Tue", label: "8a–12p" },
  { caregiverId: "c1", day: "Wed", label: "8a–12p", conflict: true },
  { caregiverId: "c2", day: "Mon", label: "12p–5p" },
  { caregiverId: "c2", day: "Thu", label: "12p–5p" },
  { caregiverId: "c4", day: "Tue", label: "5p–9p" },
  { caregiverId: "c4", day: "Wed", label: "5p–9p" },
  { caregiverId: "c6", day: "Fri", label: "9a–1p" },
  { caregiverId: "c8", day: "Sat", label: "10a–2p" },
];

export type LiveVisit = { id: string; caregiver: string; client: string; since: string; verified: boolean };

export const liveVisits: LiveVisit[] = [
  { id: "l1", caregiver: "Maya Torres", client: "Rosa Quinones", since: "11:58 AM", verified: true },
  { id: "l2", caregiver: "Ivelisse Cruz", client: "Harold Pagan", since: "12:04 PM", verified: false },
  { id: "l3", caregiver: "Diana Lugo", client: "Carmen Delgado", since: "12:15 PM", verified: true },
];

export type AuditRow = { id: string; at: string; actor: string; action: string; entity: string };

export const auditRows: AuditRow[] = [
  { id: "a1", at: "2026-08-18 11:32", actor: "Ana Melendez", action: "shift.reassigned", entity: "care_shifts #4821" },
  { id: "a2", at: "2026-08-18 10:57", actor: "Maya Torres", action: "visit.clock_in", entity: "visit_logs #9912" },
  { id: "a3", at: "2026-08-18 09:40", actor: "System", action: "evv.exception", entity: "visit_logs #9908" },
  { id: "a4", at: "2026-08-17 18:12", actor: "Ana Melendez", action: "care_plan.updated", entity: "care_plan_items #221" },
  { id: "a5", at: "2026-08-17 16:03", actor: "Sam Delgado", action: "incident.reported", entity: "incident_reports #77" },
  { id: "a6", at: "2026-08-17 08:22", actor: "Ana Melendez", action: "user.role_assigned", entity: "profiles #1042" },
  { id: "a7", at: "2026-08-16 19:45", actor: "Ivelisse Cruz", action: "visit.clock_out", entity: "visit_logs #9880" },
  { id: "a8", at: "2026-08-16 14:10", actor: "System", action: "schedule.gap_detected", entity: "care_shifts #4790" },
  { id: "a9", at: "2026-08-16 09:01", actor: "Diana Lugo", action: "wellbeing.logged", entity: "wellbeing_entries #611" },
  { id: "a10", at: "2026-08-15 20:30", actor: "Ana Melendez", action: "contact.updated", entity: "emergency_contacts #58" },
  { id: "a11", at: "2026-08-15 12:15", actor: "Jorge Rivas", action: "visit.clock_in", entity: "visit_logs #9841" },
  { id: "a12", at: "2026-08-15 08:05", actor: "System", action: "auth.login", entity: "profiles #1042" },
];

export const scheduleAlerts = [
  { id: "g1", kind: "gap" as const, text: "No caregiver assigned — Wed 2:00 PM, Miguel Santana" },
  { id: "g2", kind: "conflict" as const, text: "Maya Torres is double-booked Wed 8:00 AM–12:00 PM" },
  { id: "g3", kind: "gap" as const, text: "No caregiver assigned — Sun 9:00 AM, Carmen Delgado" },
];

export type FeedItem = {
  id: string;
  caregiver: string;
  initials: string;
  time: string;
  body: string;
  tag?: "New" | "Urgent";
  read: boolean;
};

export const familyFeed: FeedItem[] = [
  { id: "f1", caregiver: "Maya Torres", initials: "MT", time: "12:40 PM", body: "Mom finished her whole lunch today and we sat on the balcony for a while. She was in great spirits.", tag: "New", read: false },
  { id: "f2", caregiver: "Sam Delgado", initials: "SD", time: "9:15 AM", body: "Morning medications taken on time. Blood pressure reading was 128/78 — steady with last week.", read: true },
  { id: "f3", caregiver: "Ivelisse Cruz", initials: "IC", time: "Yesterday, 6:02 PM", body: "She mentioned mild knee discomfort during the evening walk, so we shortened it. Worth mentioning at the next appointment.", tag: "Urgent", read: true },
  { id: "f4", caregiver: "Maya Torres", initials: "MT", time: "Yesterday, 8:30 AM", body: "Slept well through the night. Breakfast was oatmeal with fruit, her favorite.", read: true },
];

export type Thread = { id: string; name: string; initials: string; preview: string; unread: number };

export const threads: Thread[] = [
  { id: "th1", name: "Maya Torres", initials: "MT", preview: "She's doing wonderfully today", unread: 2 },
  { id: "th2", name: "Sam Delgado", initials: "SD", preview: "I'll bring the new pill organizer", unread: 0 },
  { id: "th3", name: "Care office", initials: "CO", preview: "Your visit schedule for next week", unread: 0 },
];

export const threadMessages: Record<string, { id: string; from: "them" | "me"; text: string; time: string }[]> = {
  th1: [
    { id: "m1", from: "them", text: "Good morning! Just arrived — she's already up and cheerful.", time: "8:02 AM" },
    { id: "m2", from: "me", text: "That's so good to hear. Did she sleep okay?", time: "8:20 AM" },
    { id: "m3", from: "them", text: "She slept through the night. She's doing wonderfully today.", time: "8:24 AM" },
  ],
  th2: [{ id: "m4", from: "them", text: "I'll bring the new pill organizer tomorrow.", time: "Yesterday" }],
  th3: [{ id: "m5", from: "them", text: "Your visit schedule for next week is confirmed.", time: "Monday" }],
};

export const upcomingVisits = [
  { id: "u1", day: "Today", time: "5:30 PM", caregiver: "Maya Torres", note: "Evening care" },
  { id: "u2", day: "Tomorrow", time: "8:30 AM", caregiver: "Sam Delgado", note: "Morning care & meds" },
  { id: "u3", day: "Thursday", time: "12:00 PM", caregiver: "Ivelisse Cruz", note: "Lunch & mobility" },
  { id: "u4", day: "Friday", time: "8:30 AM", caregiver: "Maya Torres", note: "Morning care" },
  { id: "u5", day: "Saturday", time: "10:00 AM", caregiver: "Diana Lugo", note: "Weekend check-in" },
];

/** "Eleanor Rodriguez" -> "E. Rodriguez" (PHI masking default) */
export function maskName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}
