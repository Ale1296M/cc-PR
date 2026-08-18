import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Clock, Eye, EyeOff, MapPin } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardShell, Panel } from "@/components/dashboard/DashboardShell";
import { CarePlanChecklist } from "@/components/dashboard/CarePlanChecklist";
import { VisitLogModal } from "@/components/dashboard/VisitLogModal";
import { Button } from "@/components/ui/button";
import { caregiverTimeline, maskName } from "@/lib/mock/dashboard-data";

export const Route = createFileRoute("/dashboard/caregiver")({
  component: CaregiverDashboardRoute,
  head: () => ({
    meta: [
      { title: "Caregiver dashboard · Con Cariño PR" },
      { name: "description", content: "Your day at a glance: timeline, clock in/out, care plan checklists." },
      { property: "og:title", content: "Caregiver dashboard · Con Cariño PR" },
      { property: "og:description", content: "Timeline, one-tap clock in, and care plan checklists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CaregiverDashboardRoute() {
  return (
    <ProtectedRoute requiredRole="caregiver">
      <CaregiverDashboard />
    </ProtectedRoute>
  );
}

function CaregiverDashboard() {
  const [reveal, setReveal] = useState(false);
  const [selected, setSelected] = useState(caregiverTimeline[2]!.id);
  const [clockedInAt, setClockedInAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (clockedInAt === null) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - clockedInAt) / 1000));
    tick();
    timer.current = window.setInterval(tick, 1000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [clockedInAt]);

  const block = caregiverTimeline.find((b) => b.id === selected)!;
  const name = reveal ? block.client : maskName(block.client);
  const duration = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(
    Math.floor((elapsed % 3600) / 60),
  ).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <DashboardShell title="Your day" subtitle="Tuesday, August 18 · 5 visits scheduled">
      <Panel
        title={`Current visit — ${name}`}
        action={
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {reveal ? "Hide details" : "Reveal"}
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <VerificationChip verified={block.verified || clockedInAt !== null} />
          {clockedInAt !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums">
              <Clock className="h-4 w-4" aria-hidden="true" /> {duration}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            className={`min-h-[56px] w-full rounded-xl text-base ${
              clockedInAt !== null ? "bg-attention text-attention-foreground hover:bg-attention/90" : ""
            }`}
            onClick={() => setClockedInAt((v) => (v === null ? Date.now() : null))}
          >
            {clockedInAt !== null ? "Clock out" : "Clock in"}
          </Button>
          <Button
            variant="outline"
            className="min-h-[56px] w-full rounded-xl text-base"
            onClick={() => setLogOpen(true)}
          >
            Log this visit
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Client names are masked by default. Reveal only when you need full details.
        </p>
      </Panel>

      <Panel title="Today's timeline">
        <ol className="relative border-l border-border pl-6">
          {caregiverTimeline.map((b) => {
            const active = b.id === selected;
            return (
              <li key={b.id} className="relative pb-4 last:pb-0">
                <span
                  className={`absolute -left-[1.65rem] top-3 h-3 w-3 rounded-full border-2 border-background ${
                    b.status === "done" ? "bg-primary" : b.status === "active" ? "bg-gold" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setSelected(b.id)}
                  aria-pressed={active}
                  className={`grid w-full min-h-12 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active ? "bg-secondary" : "hover:bg-muted"
                  }`}
                >
                  <span className="text-sm font-medium tabular-nums text-foreground/80">{b.hour}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {reveal ? b.client : maskName(b.client)}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{b.summary}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel title="Care plan checklist">
        <CarePlanChecklist />
      </Panel>

      <VisitLogModal
        open={logOpen}
        onOpenChange={setLogOpen}
        client={name}
        verified={block.verified || clockedInAt !== null}
      />
    </DashboardShell>
  );
}

function VerificationChip({ verified }: { verified: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
        verified ? "bg-primary/15 text-primary" : "bg-attention-soft text-attention-foreground"
      }`}
    >
      <MapPin className="h-4 w-4" aria-hidden="true" />
      {verified ? "Verified" : "Pending"}
    </span>
  );
}