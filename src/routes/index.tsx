import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarHeart,
  ClipboardList,
  HeartPulse,
  MapPin,
  Menu,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
        content:
          "A warm place for home care teams and families to plan visits, share updates, and remember what matters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Lang = "en" | "es";

const COPY = {
  en: {
    signIn: "Sign in",
    getStarted: "Get started",
    menu: "Menu",
    eyebrow: "Caregiving coordination",
    headlineLead: "Care that stays",
    headlineAccent: "connected",
    lede:
      "Con Cariño PR gives home care teams and the families they serve one warm place to plan visits, share updates, and remember every small thing that matters.",
    ctaPrimary: "Create your workspace",
    ctaSecondary: "I already have an account",
    today: "Today · Tuesday",
    visits: "3 visits",
    verified: "Location verified",
    pending: "Location pending",
    demoHint: "Try it: tap a visit to focus it, tap the badge to change its state.",
    shifts: [
      { time: "8:30 AM", name: "Eleanor Ramírez", detail: "Morning care · Maya" },
      { time: "12:00 PM", name: "Harold Pagán", detail: "Lunch & meds · Sam" },
      { time: "5:30 PM", name: "Rosa Quiñones", detail: "Evening check-in · Maya" },
    ],
    features: [
      { title: "Schedules", body: "Assign shifts, spot gaps, and share who's coming when." },
      { title: "Care plans", body: "Living checklists for meds, meals, mobility, and moments." },
      { title: "Family updates", body: "Warm messages between caregivers and loved ones." },
      { title: "Visit logs", body: "Clock in, note what happened, and keep a gentle history." },
    ],
    footer: "Made with care.",
  },
  es: {
    signIn: "Iniciar sesión",
    getStarted: "Comenzar",
    menu: "Menú",
    eyebrow: "Coordinación de cuidado",
    headlineLead: "Cuidado que permanece",
    headlineAccent: "conectado",
    lede:
      "Con Cariño PR ofrece a los equipos de cuidado en el hogar y a las familias un espacio cálido para planificar visitas, compartir novedades y recordar cada pequeño detalle que importa.",
    ctaPrimary: "Crea tu espacio",
    ctaSecondary: "Ya tengo una cuenta",
    today: "Hoy · martes",
    visits: "3 visitas",
    verified: "Ubicación verificada",
    pending: "Ubicación pendiente",
    demoHint: "Pruébalo: toca una visita para enfocarla y el distintivo para cambiar su estado.",
    shifts: [
      { time: "8:30 AM", name: "Eleanor Ramírez", detail: "Cuidado matutino · Maya" },
      { time: "12:00 PM", name: "Harold Pagán", detail: "Almuerzo y medicinas · Sam" },
      { time: "5:30 PM", name: "Rosa Quiñones", detail: "Visita de la tarde · Maya" },
    ],
    features: [
      { title: "Horarios", body: "Asigna turnos, detecta espacios libres y comparte quién viene y cuándo." },
      { title: "Planes de cuidado", body: "Listas vivas para medicinas, comidas, movilidad y momentos." },
      { title: "Novedades para la familia", body: "Mensajes cálidos entre cuidadores y seres queridos." },
      { title: "Registro de visitas", body: "Marca tu llegada, anota lo sucedido y guarda un historial cuidadoso." },
    ],
    footer: "Hecho con cariño.",
  },
} as const;

type Copy = (typeof COPY)["en"] | (typeof COPY)["es"];

const FEATURE_ICONS = [CalendarHeart, ClipboardList, MessagesSquare, ShieldCheck];

function Landing() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("cc-lang");
    if (stored === "es" || stored === "en") setLang(stored);
  }, []);

  const setLanguage = (next: Lang) => {
    setLang(next);
    window.localStorage.setItem("cc-lang", next);
  };

  const t = COPY[lang];

  return (
    <div className="min-h-dvh" lang={lang}>
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-2xl tracking-tight">Con Cariño PR</span>
          </Link>

          {/* Desktop nav — brand, language, sign in, get started. Nothing else. */}
          <nav className="hidden items-center gap-4 text-sm md:flex">
            <LangToggle lang={lang} onChange={setLanguage} />
            <Link
              to="/login"
              className="min-h-11 rounded-md px-3 py-2 font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.signIn}
            </Link>
            <Button asChild className="min-h-11 rounded-full px-6">
              <Link to="/signup">{t.getStarted}</Link>
            </Button>
          </nav>

          {/* Mobile — everything lives in the drawer */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11" aria-label={t.menu}>
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle className="font-display text-2xl">Con Cariño PR</SheetTitle>
                </SheetHeader>
                <div className="mt-8 flex flex-col gap-4">
                  <LangToggle lang={lang} onChange={setLanguage} />
                  <Button asChild variant="outline" className="min-h-12 w-full">
                    <Link to="/login">{t.signIn}</Link>
                  </Button>
                  <Button asChild className="min-h-12 w-full">
                    <Link to="/signup">{t.getStarted}</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        <section className="grid gap-12 pt-12 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-16 md:pt-20">
          <div>
            <p className="mb-6 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/80">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              {t.eyebrow}
            </p>
            <h1 className="type-display text-primary">
              {t.headlineLead} <em className="italic text-foreground">{t.headlineAccent}</em>.
            </h1>
            <p className="mt-8 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              {t.lede}
            </p>
            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Button asChild className="min-h-12 w-full rounded-full px-8 text-base sm:w-auto">
                <Link to="/signup">{t.ctaPrimary}</Link>
              </Button>
              <Link
                to="/login"
                className="min-h-11 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t.ctaSecondary}
              </Link>
            </div>
          </div>

          <SchedulePreview t={t} />
        </section>

        <section className="mt-20 md:mt-28">
          <div className="grid gap-4 sm:grid-cols-2 md:gap-6">
            {t.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i]!;
              return (
                <div key={f.title} className="rounded-xl border bg-card p-6 shadow-sm">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 className="mt-4 type-subhead">{f.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground md:px-8">
          <p>© {new Date().getFullYear()} Con Cariño PR</p>
          <p>{t.footer}</p>
        </div>
      </footer>
    </div>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-1 rounded-full border border-border p-1 text-xs"
    >
      {(["en", "es"] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            aria-pressed={active}
            className={`min-h-9 rounded-full px-4 py-1.5 font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-transparent text-foreground hover:bg-secondary"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}

const BADGE_CYCLE = ["verified", "pending", "none"] as const;

function SchedulePreview({ t }: { t: Copy }) {
  const [selected, setSelected] = useState(0);
  const [badge, setBadge] = useState<(typeof BADGE_CYCLE)[number]>("verified");

  const cycleBadge = () =>
    setBadge((b) => BADGE_CYCLE[(BADGE_CYCLE.indexOf(b) + 1) % BADGE_CYCLE.length]!);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-display text-2xl">{t.today}</p>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          {t.visits}
        </span>
      </div>
      <ul className="space-y-1">
        {t.shifts.map((s, i) => (
          <li key={s.name}>
            <button
              type="button"
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
              className={`flex w-full items-start gap-4 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected === i ? "bg-secondary" : "hover:bg-muted"
              }`}
            >
              <span className="w-[4.5rem] shrink-0 pt-0.5 text-sm font-medium tabular-nums text-foreground/80">
                {s.time}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.detail}</span>
              </span>
            </button>
            {selected === i && badge !== "none" && (
              <button
                type="button"
                onClick={cycleBadge}
                className={`ml-[5.5rem] mb-2 inline-flex min-h-8 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  badge === "verified"
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "bg-attention-soft text-attention-foreground hover:opacity-80"
                }`}
              >
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {badge === "verified" ? t.verified : t.pending}
              </button>
            )}
            {selected === i && badge === "none" && (
              <button
                type="button"
                onClick={cycleBadge}
                className="ml-[5.5rem] mb-2 inline-flex min-h-8 items-center rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                + {t.verified}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border/70 pt-4 text-xs text-muted-foreground">{t.demoHint}</p>
    </div>
  );
}

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
          fill="currentColor"
          opacity=".9"
        />
        <circle cx="12" cy="10" r="2.2" fill="oklch(0.78 0.14 85)" />
      </svg>
    </span>
  );
}