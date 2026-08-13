import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarHeart, ClipboardList, MessagesSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Con Cariño PR — caregiving coordination for teams and families" },
      {
        name: "description",
        content:
          "One calm workspace for caregivers, clients and families. Schedules, care plans, visit logs and messages — thoughtfully connected.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-2xl">Con Cariño PR</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-20">
        <section className="grid gap-12 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              Caregiving coordination
            </p>
            <h1 className="font-display text-5xl leading-[1.05] md:text-7xl">
              Care that stays{" "}
              <span className="gold-underline">connected</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Con Cariño PR gives home care teams and the families they serve one warm
              place to plan visits, share updates, and remember every small
              thing that matters.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-full bg-primary px-6 py-3 text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Create your workspace
              </Link>
              <Link
                to="/auth"
                className="rounded-full border border-border bg-card px-6 py-3 hover:border-primary"
              >
                I already have an account
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="card-soft rotate-1 p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-2xl">Today · Tuesday</p>
                <span className="rounded-full bg-gold/20 px-3 py-1 text-xs text-gold-foreground">
                  3 visits
                </span>
              </div>
              <ul className="space-y-3">
                {[
                  ["8:30 AM", "Eleanor R.", "Morning care · Maya"],
                  ["12:00 PM", "Harold P.", "Lunch & meds · Sam"],
                  ["5:30 PM", "Rose K.", "Evening check-in · Maya"],
                ].map(([t, n, c]) => (
                  <li
                    key={n}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3"
                  >
                    <span className="w-16 text-sm text-muted-foreground">{t}</span>
                    <div>
                      <p className="font-medium">{n}</p>
                      <p className="text-xs text-muted-foreground">{c}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CalendarHeart, title: "Schedules", body: "Assign shifts, spot gaps, and share who's coming when." },
            { icon: ClipboardList, title: "Care plans", body: "Living checklists for meds, meals, mobility, and moments." },
            { icon: MessagesSquare, title: "Family updates", body: "Warm messages between caregivers and loved ones." },
            { icon: ShieldCheck, title: "Visit logs", body: "Clock in, note what happened, and keep a gentle history." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card-soft p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Con Cariño PR</p>
          <p>Made with care.</p>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
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
