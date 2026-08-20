import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Heart,
  Calendar,
  ClipboardList,
  MessageSquare,
  Shield,
  Activity,
  MapPin,
  ChevronRight,
  Check,
  Clock,
  Plus,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { clsx } from "clsx";

function ScoreChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={inView ? scoreData : []}
          margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
        >
          <XAxis
            dataKey="day"
            type="number"
            domain={[6, 11]}
            ticks={[6, 7, 8, 9, 10, 11]}
            tick={{ fontSize: 10, fill: "rgba(249,246,240,0.35)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[1, 5]}
            tick={{ fontSize: 10, fill: "rgba(249,246,240,0.35)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(20,56,36,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#F9F6F0",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#DDA735"
            strokeWidth={2.5}
            dot={{ fill: "#DDA735", r: 4, strokeWidth: 0 }}
            activeDot={{ fill: "#DDA735", r: 6, stroke: "#F9F6F0", strokeWidth: 2 }}
            isAnimationActive={inView}
            animationBegin={0}
            animationDuration={1500}
            animationEasing="linear"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Con Cariño PR — caregiving coordination for teams and families" },
      {
        name: "description",
        content:
          "One calm workspace for caregivers, care recipients and families in Puerto Rico. Schedules, care plans, visit logs and messages — thoughtfully connected.",
      },
      { property: "og:title", content: "Con Cariño PR — caregiving coordination" },
      {
        property: "og:description",
        content: "A warm place for home care teams and families to plan visits, share updates, and remember what matters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Lang = "en" | "es";

type VisitState = "scheduled" | "verified" | "now" | "done";

type Role = "admin" | "caregiver" | "family";

type WellStatus = "good" | "usual" | "attention" | "none";

// ─── Copy ────────────────────────────────────────────────────────────────────

const T = {
  en: {
    logo: "Con Cariño PR",
    navLinks: ["Features", "Wellbeing", "History"],
    signin: "Sign in",
    started: "Get started",
    eyebrow: "Caregiving Coordination",
    h1a: "Care that stays",
    h1b: "connected.",
    tagline:
      "Con Cariño PR gives home care teams and the families they serve one warm place to plan visits, share updates, and remember every small thing that matters.",
    cta: "Get started",
    demo: "See a demo",
    todayLabel: "Today · Tuesday",
    visitCount: (n: number) => `${n} visits`,
    visitHint: "Tap a visit to focus it, tap the badge to change its state.",
    stateLabel: {
      scheduled: "Scheduled",
      verified: "Location verified",
      now: "Now",
      done: "Done",
    } as Record<VisitState, string>,
    stats: [
      { v: "2,400+", l: "families served" },
      { v: "38", l: "care teams" },
      { v: "4.9★", l: "family rating" },
    ],
    featuresHeading: "Everything your care team needs",
    featuresOpen: "Open",
    features: [
      { title: "Schedules", body: "Assign shifts, spot gaps, and share who’s coming when." },
      { title: "Care plans", body: "Living checklists for meds, meals, mobility, and moments." },
      { title: "Family updates", body: "Warm messages between caregivers and loved ones." },
      { title: "Visit logs", body: "Clock in, note what happened, and keep a gentle history." },
      { title: "Wellbeing tracker", body: "A quick look at mood, comfort, and daily wellness patterns." },
    ],
    rolesHeading: "One platform, three perspectives",
    rolesTabs: ["Admin", "Caregiver", "Family"],
    adminRoster: "Caregiver roster",
    adminFlagged: "Flagged today",
    adminSummary: "Today’s summary",
    adminAssign: "Assign",
    adminCall: "Call family",
    adminClients: (n: number) => `${n} client${n !== 1 ? "s" : ""} today`,
    adminAvailable: "Available",
    caregiverSchedule: "Maya’s schedule",
    checkin: "Check in",
    checkout: "Check out",
    done: "Done",
    hoursMonth: "Hours this month",
    hoursAllotted: "Allotted",
    hoursUsed: "Used",
    hoursRemaining: "Remaining",
    requestVisit: "Request a visit",
    upcomingVisits: "Upcoming visits",
    wellbeingHeading: "Wellbeing tracker",
    wellbeingSub: "OUR FLAGSHIP FEATURE",
    wellbeingDesc:
      "A daily snapshot of mood, comfort, and wellness — captured at every visit check-in.",
    wellbeingStats: [
      { v: "57", l: "avg score" },
      { v: "4", l: "good days" },
      { v: "2", l: "needs attention" },
      { v: "6", l: "recorded" },
    ],
    dayByDay: "Day by day",
    wellbeingRecorded: "6 days recorded",
    legend: ["Good", "Usual", "Needs attention", "No check-in"],
    dayLabel: (d: number) => `Day ${d}`,
    noNote: "No note recorded for this day.",
    howWas: "How was it?",
    ratingBtns: ["Good day", "Usual", "Needs attention"],
    overallScore: "Overall recorded score",
    selectDay: "Select a day to see details",
    ctaHeading: "Ready to connect your care team?",
    ctaBody:
      "Join hundreds of families across Puerto Rico who trust Con Cariño PR to keep care coordinated — with warmth.",
    ctaBtn: "Start for free",
    ctaSecondary: "Schedule a demo",
    footerTagline: "Built with care in Puerto Rico · Bilingual · Secure · Role-based",
  },
  es: {
    logo: "Con Cariño PR",
    navLinks: ["Funciones", "Bienestar", "Historia"],
    signin: "Iniciar sesión",
    started: "Comenzar",
    eyebrow: "Coordinación de cuidado",
    h1a: "Cuidado que",
    h1b: "permanece unido.",
    tagline:
      "Con Cariño da a los equipos de cuidado y familias un lugar cálido para planear visitas, compartir novedades y recordar cada pequeña cosa importante.",
    cta: "Comenzar",
    demo: "Ver demo",
    todayLabel: "Hoy · Martes",
    visitCount: (n: number) => `${n} visitas`,
    visitHint: "Toca una visita para enfocarla, toca el distintivo para cambiar su estado.",
    stateLabel: {
      scheduled: "Programada",
      verified: "Ubicación verificada",
      now: "Ahora",
      done: "Hecho",
    } as Record<VisitState, string>,
    stats: [
      { v: "2,400+", l: "familias atendidas" },
      { v: "38", l: "equipos de cuidado" },
      { v: "4.9★", l: "valoración familiar" },
    ],
    featuresHeading: "Todo lo que tu equipo de cuidado necesita",
    featuresOpen: "Abrir",
    features: [
      { title: "Horarios", body: "Asigna turnos, detecta vacíos y comparte quién llega cuándo." },
      { title: "Planes de cuidado", body: "Listas de verificación para medicamentos, comidas, movilidad y momentos." },
      { title: "Actualizaciones familiares", body: "Mensajes cálidos entre cuidadores y seres queridos." },
      { title: "Registros de visita", body: "Registra la entrada, anota lo que pasó y mantén un historial amable." },
      { title: "Rastreador de bienestar", body: "Un vistazo rápido al ánimo, confort y rutinas de bienestar diario." },
    ],
    rolesHeading: "Una plataforma, tres perspectivas",
    rolesTabs: ["Administrador", "Cuidador", "Familia"],
    adminRoster: "Equipo de cuidadores",
    adminFlagged: "Señalado hoy",
    adminSummary: "Resumen de hoy",
    adminAssign: "Asignar",
    adminCall: "Llamar familia",
    adminClients: (n: number) => `${n} cliente${n !== 1 ? "s" : ""} hoy`,
    adminAvailable: "Disponible",
    caregiverSchedule: "Horario de Maya",
    checkin: "Entrada",
    checkout: "Salida",
    done: "Hecho",
    hoursMonth: "Horas este mes",
    hoursAllotted: "Asignadas",
    hoursUsed: "Usadas",
    hoursRemaining: "Restantes",
    requestVisit: "Solicitar una visita",
    upcomingVisits: "Próximas visitas",
    wellbeingHeading: "Rastreador de bienestar",
    wellbeingSub: "NUESTRA FUNCIÓN PRINCIPAL",
    wellbeingDesc:
      "Un resumen diario del ánimo, confort y bienestar — capturado en cada registro de visita.",
    wellbeingStats: [
      { v: "57", l: "promedio" },
      { v: "4", l: "buenos días" },
      { v: "2", l: "atención" },
      { v: "6", l: "registrados" },
    ],
    dayByDay: "Día a día",
    wellbeingRecorded: "6 días registrados",
    legend: ["Bien", "Normal", "Atención", "Sin registro"],
    dayLabel: (d: number) => `Día ${d}`,
    noNote: "Sin nota para este día todavía.",
    howWas: "¿Cómo estuvo?",
    ratingBtns: ["Buen día", "Normal", "Atención"],
    overallScore: "Puntuación general registrada",
    selectDay: "Selecciona un día para ver detalles",
    ctaHeading: "¿Listo para conectar tu equipo de cuidado?",
    ctaBody:
      "Únete a cientos de familias en Puerto Rico que confían en Con Cariño PR para coordinar el cuidado con calidez.",
    ctaBtn: "Comenzar gratis",
    ctaSecondary: "Agendar una demo",
    footerTagline: "Construido con cariño en Puerto Rico · Bilingüe · Seguro · Por roles",
  },
};

// ─── Static data ─────────────────────────────────────────────────────────────

const scheduleVisits = [
  { time: "8:30 AM", name: "Eleanor Ramírez", en: "Morning care · Maya", es: "Cuidado matutino · Maya" },
  { time: "12:00 PM", name: "Harold Pagán", en: "Lunch & meds · Sam", es: "Almuerzo y medicamentos · Sam" },
  { time: "5:30 PM", name: "Rosa Quiñones", en: "Evening check-in · Maya", es: "Revisión nocturna · Maya" },
];

const wellbeingDays: { day: number; status: WellStatus }[] = [
  { day: 6, status: "attention" },
  { day: 7, status: "usual" },
  { day: 8, status: "good" },
  { day: 9, status: "good" },
  { day: 10, status: "good" },
  { day: 11, status: "usual" },
  { day: 12, status: "none" },
  { day: 13, status: "none" },
  { day: 14, status: "none" },
  { day: 15, status: "none" },
  { day: 16, status: "none" },
  { day: 17, status: "none" },
  { day: 18, status: "none" },
  { day: 19, status: "none" },
];

const dayNotes: Record<number, { en: string; es: string }> = {
  6: { en: "Difficult day. Rosa reported mild discomfort.", es: "Día difícil. Rosa reportó malestar leve." },
  7: { en: "Normal day. Medications taken on time.", es: "Día normal. Medicamentos tomados a tiempo." },
  8: { en: "Good day. Went for a walk with Sam.", es: "Buen día. Salió a caminar con Sam." },
  9: { en: "Excellent mood. Ate well all day.", es: "Excelente ánimo. Comió bien todo el día." },
  10: { en: "Stable. No notable observations.", es: "Estable. Sin observaciones notables." },
  11: { en: "A bit tired. Family visited in the afternoon.", es: "Un poco cansado. Familia visitó por la tarde." },
};

const scoreData = [
  { day: 6, score: 2.5 },
  { day: 7, score: 3.2 },
  { day: 8, score: 4.1 },
  { day: 9, score: 4.8 },
  { day: 10, score: 4.5 },
  { day: 11, score: 3.7 },
];

const stateOrder: VisitState[] = ["scheduled", "verified", "now", "done"];

const dotBg: Record<WellStatus, string> = {
  good: "bg-wb-good",
  usual: "bg-wb-usual",
  attention: "bg-wb-attention",
  none: "bg-wb-none",
};

const LORA = "'Lora', Georgia, serif";
const DM = "'DM Sans', system-ui, sans-serif";

// ─── Role panels ─────────────────────────────────────────────────────────────

function AdminView({ t }: { t: typeof T.en }) {
  const caregivers = [
    { name: "Maya Santos", clients: 2, active: true },
    { name: "Sam Rodríguez", clients: 1, active: true },
    { name: "Luis Torres", clients: 0, active: false },
  ];

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{t.adminRoster}</p>
        <div className="space-y-2.5">
          {caregivers.map((c) => (
            <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
              <div
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                  c.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {initials(c.name)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.clients > 0 ? t.adminClients(c.clients) : t.adminAvailable}
                </p>
              </div>
              <div className={clsx("w-2 h-2 rounded-full", c.active ? "bg-wb-good" : "bg-wb-none")} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.adminFlagged}</p>
        <div className="p-4 rounded-xl border border-attention/25 bg-attention/5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-attention/15 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-attention" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Rosa Quiñones</p>
              <p className="text-xs text-muted-foreground mb-3">Evening visit · 5:30 PM · Not confirmed</p>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium">
                  {t.adminAssign}
                </button>
                <button className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium">
                  {t.adminCall}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-secondary/40">
          <p className="text-xs text-muted-foreground mb-3">{t.adminSummary}</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { v: "3", l: "visits" },
              { v: "2", l: "confirmed" },
              { v: "1", l: "pending" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-2xl font-semibold text-foreground" style={{ fontFamily: LORA }}>
                  {s.v}
                </p>
                <p className="text-xs text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CaregiverView({ t }: { t: typeof T.en }) {
  const [checkedIn, setCheckedIn] = useState<number | null>(null);
  const visits = [
    { time: "8:30 AM", name: "Eleanor Ramírez", detail: t.features[0].title, done: true },
    { time: "12:00 PM", name: "Harold Pagán", detail: t.features[1].title, done: false },
    { time: "5:30 PM", name: "Rosa Quiñones", detail: t.features[2].title, done: false },
  ];

  return (
    <div className="max-w-md">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{t.caregiverSchedule}</p>
      <div className="space-y-2.5">
        {visits.map((v, i) => (
          <div
            key={i}
            className={clsx(
              "p-4 rounded-xl border transition-all",
              v.done
                ? "border-primary/20 bg-primary/5"
                : "border-border bg-white"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{v.time}</p>
                <p className="text-sm font-semibold text-foreground">{v.name}</p>
              </div>
              {v.done ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium shrink-0">
                  <Check className="w-3 h-3" />
                  {t.done}
                </div>
              ) : checkedIn === i ? (
                <button
                  onClick={() => setCheckedIn(null)}
                  className="px-2.5 py-1 bg-attention text-white rounded-full text-xs font-medium shrink-0"
                >
                  {t.checkout}
                </button>
              ) : (
                <button
                  onClick={() => setCheckedIn(i)}
                  className="px-2.5 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium shrink-0"
                >
                  {t.checkin}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FamilyView({ t }: { t: typeof T.en }) {
  const hours = [
    { label: t.hoursAllotted, value: 80, max: 80, bar: "bg-secondary border border-border" },
    { label: t.hoursUsed, value: 62, max: 80, bar: "bg-primary" },
    { label: t.hoursRemaining, value: 18, max: 80, bar: "bg-wb-usual" },
  ];

  const upcoming = [
    { time: "Today, 5:30 PM / Hoy, 5:30 PM", name: "Rosa Quiñones", caregiver: "Maya" },
    { time: "Thu 8:30 AM / Jue 8:30 AM", name: "Rosa Quiñones", caregiver: "Maya" },
    { time: "Thu 12:00 PM / Jue 12:00 PM", name: "Harold Pagán", caregiver: "Sam" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{t.hoursMonth}</p>
        <div className="space-y-4">
          {hours.map((h) => (
            <div key={h.label}>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm text-foreground">{h.label}</span>
                <span className="text-sm font-semibold text-foreground" style={{ fontFamily: LORA }}>
                  {h.value}h
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={clsx("h-full rounded-full transition-all", h.bar)}
                  style={{ width: `${(h.value / h.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <button className="mt-5 w-full py-2.5 border border-primary text-primary rounded-xl text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          {t.requestVisit}
        </button>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{t.upcomingVisits}</p>
        <div className="space-y-2.5">
          {upcoming.map((v, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{v.time.split(" / ")[0]}</p>
                <p className="text-sm font-medium text-foreground">
                  {v.name} · {v.caregiver}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function Landing() {
  const [lang, setLang] = useState<Lang>("en");
  const [activeVisit, setActiveVisit] = useState<number | null>(null);
  const [visitStates, setVisitStates] = useState<Record<number, VisitState>>({
    0: "verified",
    1: "scheduled",
    2: "scheduled",
  });
  const [activeRole, setActiveRole] = useState<Role>("admin");
  const [selectedDay, setSelectedDay] = useState<number | null>(10);

  const t = T[lang];

  const cycleState = (idx: number) => {
    setVisitStates((prev) => {
      const cur = prev[idx] ?? "scheduled";
      const next = stateOrder[(stateOrder.indexOf(cur) + 1) % stateOrder.length];
      return { ...prev, [idx]: next };
    });
  };

  const stateBadge: Record<VisitState, string> = {
    scheduled: "bg-secondary text-secondary-foreground",
    verified: "bg-primary text-primary-foreground",
    now: "bg-wb-attention text-white",
    done: "bg-wb-usual text-foreground",
  };

  const featureIcons = [Calendar, ClipboardList, MessageSquare, Shield, Activity];

  const selectedDayData = wellbeingDays.find((d) => d.day === selectedDay);
  const selectedNote = selectedDay ? dayNotes[selectedDay]?.[lang] : undefined;

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: DM }}>
      {/* ── Navbar ── */}

      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center gap-6">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-none" style={{ fontFamily: LORA }}>
                Con Cariño PR
              </div>
              <div className="text-[10px] text-muted-foreground leading-none mt-0.5 tracking-wide">connect</div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6 flex-1 justify-center">
            {t.navLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center bg-secondary rounded-full p-0.5">
              {(["en", "es"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={clsx(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-all",
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <Link
              to="/login"
              className="hidden lg:block text-sm text-foreground hover:text-primary transition-colors"
            >
              {t.signin}
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-all"
            >
              {t.started}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 items-start">
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xs tracking-[0.18em] uppercase text-muted-foreground font-medium">
                {t.eyebrow}
              </span>
            </div>

            <h1
              className="text-5xl lg:text-[3.75rem] font-semibold text-foreground leading-[1.08] mb-6"
              style={{ fontFamily: LORA }}
            >
              {t.h1a}
              <br />
              <em className="italic text-primary">{t.h1b}</em>
            </h1>

            <p className="text-muted-foreground text-[1.0625rem] leading-relaxed max-w-[420px] mb-8">
              {t.tagline}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                to="/signup"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:-translate-y-px flex items-center gap-2"
              >
                {t.cta}
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button className="px-6 py-3 border border-border text-foreground rounded-full font-medium hover:bg-secondary transition-colors">
                {t.demo}
              </button>
            </div>
          </div>

          {/* Live schedule card */}

          <div className="bg-white rounded-2xl shadow-lg border border-border p-6 select-none">
            <div className="flex items-center justify-between mb-5">
              <span className="font-semibold text-foreground text-base" style={{ fontFamily: LORA }}>
                {t.todayLabel}
              </span>
              <span className="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs rounded-full font-medium">
                {t.visitCount(3)}
              </span>
            </div>

            <div className="space-y-0.5">
              {scheduleVisits.map((v, i) => {
                const state = visitStates[i] ?? "scheduled";
                const isActive = activeVisit === i;
                return (
                  <div key={i}>
                    <div
                      onClick={() => setActiveVisit(isActive ? null : i)}
                      className={clsx(
                        "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all",
                        isActive ? "bg-secondary" : "hover:bg-background"
                      )}
                    >
                      <span className="text-xs text-muted-foreground w-[58px] shrink-0 pt-0.5 tabular-nums">
                        {v.time}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{v.name}</p>
                        <p className="text-xs text-muted-foreground">{lang === "en" ? v.en : v.es}</p>
                      </div>
                    </div>

                    {isActive && (
                      <div className="ml-[73px] mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleState(i);
                          }}
                          className={clsx(
                            "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all",
                            stateBadge[state]
                          )}
                        >
                          {state === "verified" && <MapPin className="w-3 h-3" />}
                          {state === "done" && <Check className="w-3 h-3" />}
                          {state === "now" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                          )}
                          {state === "scheduled" && <Clock className="w-3 h-3" />}
                          {t.stateLabel[state]}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border leading-relaxed">
              {t.visitHint}
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}

      <div className="border-y border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-center gap-12 lg:gap-24 flex-wrap">
          {t.stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-semibold text-foreground" style={{ fontFamily: LORA }}>
                {s.v}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}

      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2
          className="text-[1.875rem] font-semibold text-foreground mb-12 text-center"
          style={{ fontFamily: LORA }}
        >
          {t.featuresHeading}
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {t.features.map((f, i) => {
            const Icon = featureIcons[i];
            const isWellbeing = i === 4;
            return (
              <div
                key={i}
                className="rounded-2xl border border-border bg-white p-5 group hover:border-primary/20 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                  <Icon className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{f.body}</p>

                {isWellbeing && (
                  <div className="flex gap-1 mb-4 flex-wrap">
                    {(["good", "good", "usual", "attention", "good", "usual", "none"] as WellStatus[]).map(
                      (s, j) => (
                        <div key={j} className={clsx("w-4 h-4 rounded-full", dotBg[s])} />
                      )
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-1.5 transition-all">
                  {t.featuresOpen}
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Role Views ── */}

      <section className="bg-secondary border-y border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2
            className="text-[1.875rem] font-semibold text-foreground text-center mb-10"
            style={{ fontFamily: LORA }}
          >
            {t.rolesHeading}
          </h2>

          <div className="flex justify-center mb-8">
            <div className="flex gap-1 bg-white rounded-full p-1 border border-border shadow-sm">
              {(["admin", "caregiver", "family"] as Role[]).map((r, i) => (
                <button
                  key={r}
                  onClick={() => setActiveRole(r)}
                  className={clsx(
                    "px-5 py-2 rounded-full text-sm font-medium transition-all",
                    activeRole === r
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.rolesTabs[i]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-8 min-h-[260px]">
            {activeRole === "admin" && <AdminView t={t} />}
            {activeRole === "caregiver" && <CaregiverView t={t} />}
            {activeRole === "family" && <FamilyView t={t} />}
          </div>
        </div>
      </section>

      {/* ── Wellbeing Tracker ── */}

      <section className="bg-primary py-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs text-primary-foreground/50 tracking-widest uppercase mb-1">
                  {t.wellbeingSub}
                </p>
                <h2
                  className="text-3xl font-semibold text-primary-foreground"
                  style={{ fontFamily: LORA }}
                >
                  {t.wellbeingHeading}
                </h2>
              </div>
            </div>
            <p className="text-primary-foreground/65 text-sm max-w-sm leading-relaxed">
              {t.wellbeingDesc}
            </p>
          </div>

          {/* Stats */}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {t.wellbeingStats.map((s, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-4">
                <div
                  className="text-3xl font-semibold text-primary-foreground mb-1"
                  style={{ fontFamily: LORA }}
                >
                  {s.v}
                </div>
                <div className="text-xs text-primary-foreground/55">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Day strip + detail */}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
            {/* Left */}

            <div className="bg-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-medium text-primary-foreground">{t.dayByDay}</p>
                <p className="text-xs text-primary-foreground/45">{t.wellbeingRecorded}</p>
              </div>

              {/* Dots */}

              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {wellbeingDays.map(({ day, status }) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                    className={clsx(
                      "w-7 h-7 rounded-full transition-all shrink-0",
                      dotBg[status],
                      selectedDay === day
                        ? "ring-2 ring-white ring-offset-2 ring-offset-primary scale-110"
                        : "hover:scale-105 hover:ring-1 hover:ring-white/40"
                    )}
                    title={t.dayLabel(day)}
                  />
                ))}
              </div>

              {/* Day numbers */}

              <div className="flex gap-1.5 mb-6 flex-wrap">
                {wellbeingDays.map(({ day }) => (
                  <div
                    key={day}
                    className="w-7 text-center text-[10px] text-primary-foreground/35 shrink-0 tabular-nums"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Legend */}

              <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8">
                {t.legend.map((label, i) => {
                  const colors = [
                    "bg-wb-good ring-1 ring-white/25",
                    "bg-wb-usual",
                    "bg-wb-attention",
                    "bg-wb-none",
                  ];
                  return (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={clsx("w-2.5 h-2.5 rounded-full", colors[i])} />
                      <span className="text-xs text-primary-foreground/55">{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Chart */}

              <p className="text-sm font-medium text-primary-foreground mb-4">{t.overallScore}</p>
              <ScoreChart />
            </div>

            {/* Right: Day detail */}

            <div className="bg-white/10 rounded-2xl p-6 flex flex-col">
              {selectedDay && selectedDayData ? (
                <>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={clsx("w-4 h-4 rounded-full shrink-0", dotBg[selectedDayData.status])} />
                    <p
                      className="text-xl font-semibold text-primary-foreground"
                      style={{ fontFamily: LORA }}
                    >
                      {t.dayLabel(selectedDay)}
                    </p>
                  </div>
                  <p className="text-sm text-primary-foreground/70 leading-relaxed mb-6 flex-1">
                    {selectedNote ?? t.noNote}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-primary-foreground/45 mb-3">
                    {t.howWas}
                  </p>
                  <div className="flex flex-col gap-2">
                    {t.ratingBtns.map((btn, i) => {
                      const statusMap: WellStatus[] = ["good", "usual", "attention"];
                      const isSelected = selectedDayData.status === statusMap[i];
                      const selectedStyles = [
                        "bg-primary border-primary text-primary-foreground",
                        "bg-gold border-gold text-gold-foreground",
                        "bg-attention border-attention text-primary-foreground",
                      ];
                      return (
                        <button
                          key={btn}
                          className={clsx(
                            "w-full py-2.5 rounded-xl border text-sm font-medium transition-all",
                            isSelected
                              ? selectedStyles[i]
                              : "bg-white/8 border-white/12 text-primary-foreground/55 hover:bg-white/15 hover:text-primary-foreground"
                          )}
                        >
                          {btn}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-primary-foreground/35 text-sm text-center leading-relaxed">
                    {t.selectDay}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}

      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2
          className="text-4xl font-semibold text-foreground mb-4"
          style={{ fontFamily: LORA }}
        >
          {t.ctaHeading}
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8 leading-relaxed">{t.ctaBody}</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/signup"
            className="px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:-translate-y-px"
          >
            {t.ctaBtn}
          </Link>
          <button className="px-8 py-3.5 border border-border text-foreground rounded-full font-medium hover:bg-secondary transition-colors">
            {t.ctaSecondary}
          </button>
        </div>
      </section>

      {/* ── Footer ── */}

      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Heart className="w-3 h-3 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground" style={{ fontFamily: LORA }}>
              Con Cariño PR Connect
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t.footerTagline}</p>
        </div>
      </footer>
    </div>
  );
}
