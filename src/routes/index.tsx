import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarHeart, ClipboardList, MapPin, MessagesSquare, ShieldCheck } from "lucide-react";

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
    <div className="min-h-screen" lang={lang}>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-2xl tracking-tight">Con Cariño PR</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <LangToggle lang={lang} onChange={setLanguage} />
          <Link
            to="/auth"
            className="min-h-10 px-2 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.signIn}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="min-h-10 rounded-full bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.getStarted}
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-28">
        <section className="grid gap-16 pt-12 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-16 md:pt-24">
          <div>
            <p className="mb-8 flex items-center gap-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              {t.eyebrow}
            </p>
            <h1 className="type-display text-primary">
              {t.headlineLead}{" "}
              <em className="italic text-foreground">{t.headlineAccent}</em>.
            </h1>
            <p className="mt-12 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              {t.lede}
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="min-h-11 rounded-full bg-primary px-8 py-4 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                {t.ctaPrimary}
              </Link>
              <Link
                to="/auth"
                className="min-h-11 rounded-full border border-border px-8 py-4 transition-colors hover:border-primary"
              >
                {t.ctaSecondary}
              </Link>
            </div>
          </div>

          <SchedulePreview t={t} />
        </section>

        <section className="mt-32 border-t border-border pt-16 md:mt-40">
          <div className="grid gap-x-16 gap-y-12 md:grid-cols-2">
            {t.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div
                  key={f.title}
                  className="flex gap-4 border-b border-border/70 pb-12 last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0"
                >
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-primary/70" aria-hidden="true" />
                  <div>
                    <h2 className="type-section">{f.title}</h2>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                      {f.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-8 text-sm text-muted-foreground">
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
      className="flex items-center rounded-full border border-border p-0.5 text-xs"
    >
      {(["en", "es"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          aria-pressed={lang === code}
          className={`min-h-8 rounded-full px-4 py-1.5 uppercase tracking-wide transition-colors ${
            lang === code
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

function SchedulePreview({ t }: { t: (typeof COPY)["en"] | (typeof COPY)["es"] }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-secondary/40 blur-2xl"
      />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_24px_60px_-32px_oklch(0.24_0.035_155/0.45)]">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-display text-2xl">{t.today}</p>
          <span className="rounded-full border border-border px-4 py-1 text-xs text-muted-foreground">
            {t.visits}
          </span>
        </div>
        <ul className="space-y-1">
          {t.shifts.map((s, i) => (
            <li
              key={s.name}
              className={`flex items-start gap-4 py-3.5 ${i > 0 ? "border-t border-border/70" : ""}`}
            >
              <span className="w-[4.5rem] shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                {s.time}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.detail}</p>
                {i === 0 && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gold-foreground">
                    <MapPin className="h-3 w-3 text-gold" aria-hidden="true" />
                    {t.verified}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
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
