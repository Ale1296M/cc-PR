import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCheck, ImagePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardShell, Panel } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { familyFeed, threadMessages, threads, upcomingVisits } from "@/lib/mock/dashboard-data";

export const Route = createFileRoute("/dashboard/family")({
  component: FamilyDashboardRoute,
  head: () => ({
    meta: [
      { title: "Family dashboard · Con Cariño PR" },
      { name: "description", content: "Updates from your loved one's caregivers, daily summaries and the week ahead." },
      { property: "og:title", content: "Family dashboard · Con Cariño PR" },
      { property: "og:description", content: "Daily care summaries, caregiver messages and upcoming visits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function FamilyDashboardRoute() {
  return (
    <ProtectedRoute requiredRole="family_member">
      <FamilyDashboard />
    </ProtectedRoute>
  );
}

function FamilyDashboard() {
  return (
    <DashboardShell title="How your loved one is doing" subtitle="Eleanor · Tuesday, August 18">
      <Panel title="Today at a glance">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Meals", value: "All eaten" },
            { label: "Medications", value: "On time" },
            { label: "Mood", value: "Bright" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-secondary/50 p-4">
              <p className="text-sm text-foreground/80">{s.label}</p>
              <p className="mt-1 font-display text-2xl">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-base leading-relaxed text-foreground/90">
          Maya was with Eleanor this morning. She ate her full lunch, took every medication on
          schedule, and spent some time on the balcony. A good, calm day.
        </p>
      </Panel>

      <UpdatesFeed />

      <Panel title="Messages with the care team">
        <Messaging />
      </Panel>

      <Panel title="The week ahead">
        <ul className="divide-y divide-border/70">
          {upcomingVisits.map((v) => (
            <li key={v.id} className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-4 py-4">
              <div>
                <p className="font-medium">{v.day}</p>
                <p className="text-sm tabular-nums text-foreground/80">{v.time}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-medium">{v.caregiver}</p>
                <p className="truncate text-sm text-muted-foreground">{v.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </DashboardShell>
  );
}

function UpdatesFeed() {
  const [items, setItems] = useState(familyFeed);

  return (
    <Panel title="Updates from caregivers">
      <div className="mb-5 rounded-lg border border-dashed border-border p-6 text-center">
        <ImagePlus className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">
          Photos shared by caregivers will appear here. Drop an image to share one back.
        </p>
      </div>

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary font-medium"
              >
                {item.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.caregiver}</p>
                <p className="text-sm text-foreground/80">{item.time}</p>
              </div>
              {item.tag && (
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    item.tag === "Urgent"
                      ? "bg-attention-soft text-attention-foreground"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {item.tag}
                </span>
              )}
            </div>
            <p className="mt-3 text-base leading-relaxed">{item.body}</p>
            <div className="mt-3">
              {item.read ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-primary">
                  <CheckCheck className="h-4 w-4" aria-hidden="true" /> Read
                </p>
              ) : (
                <Button
                  variant="ghost"
                  className="min-h-12 px-3 sm:min-h-11"
                  onClick={() =>
                    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, read: true } : i)))
                  }
                >
                  Mark as read
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Messaging() {
  const [active, setActive] = useState(threads[0]!.id);
  const [draft, setDraft] = useState("");
  const messages = threadMessages[active] ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <ul className="space-y-1">
        {threads.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setActive(t.id)}
              aria-pressed={active === t.id}
              className={`grid w-full min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active === t.id ? "bg-secondary" : "hover:bg-muted"
              }`}
            >
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-sm font-medium">
                {t.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{t.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{t.preview}</span>
              </span>
              {t.unread > 0 && (
                <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  {t.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex min-h-[18rem] flex-col rounded-lg border border-border p-4">
        <ul className="flex-1 space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={m.from === "me" ? "text-right" : ""}>
              <span
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-left text-base ${
                  m.from === "me" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.text}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">{m.time}</p>
            </li>
          ))}
        </ul>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            toast.success("Message sent");
            setDraft("");
          }}
        >
          <label htmlFor="family-message" className="sr-only">Write a message</label>
          <input
            id="family-message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            className="min-h-12 flex-1 rounded-full border border-input bg-background px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" className="min-h-12 w-full rounded-full sm:w-auto">
            <Send /> Send
          </Button>
        </form>
      </div>
    </div>
  );
}