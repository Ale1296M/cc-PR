import { useState } from "react";
import { Check, Circle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { carePlanTasks, type CarePlanTask, type TaskState } from "@/lib/mock/dashboard-data";

const CATEGORIES = ["Medications", "Meals", "Mobility"] as const;

export function CarePlanChecklist() {
  const [tasks, setTasks] = useState<CarePlanTask[]>(carePlanTasks);
  const [skipping, setSkipping] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const setState = (id: string, state: TaskState, why?: string) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, state, reason: why } : t)));

  const confirmSkip = (id: string) => {
    if (!reason.trim()) {
      setReasonError("Add a short reason before saving a skipped task.");
      return;
    }
    setState(id, "skipped", reason.trim());
    setSkipping(null);
    setReason("");
    setReasonError(null);
  };

  return (
    <div className="space-y-6">
      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
            {cat}
          </h3>
          <ul className="divide-y divide-border/70">
            {tasks.filter((t) => t.category === cat).map((t) => (
              <li key={t.id} className="py-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className={`text-sm ${t.state === "completed" ? "text-muted-foreground line-through" : ""}`}>
                      {t.label}
                    </p>
                    {t.state === "skipped" && t.reason && (
                      <p className="mt-1 text-xs text-attention-foreground">Skipped — {t.reason}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StateButton
                      active={t.state === "completed"}
                      label="Completed"
                      onClick={() => setState(t.id, "completed")}
                      icon={<Check className="h-4 w-4" />}
                    />
                    <StateButton
                      active={t.state === "pending"}
                      label="Pending"
                      onClick={() => setState(t.id, "pending")}
                      icon={<Circle className="h-4 w-4" />}
                    />
                    <StateButton
                      active={t.state === "skipped"}
                      label="Skipped"
                      onClick={() => {
                        setSkipping(t.id);
                        setReason(t.reason ?? "");
                        setReasonError(null);
                      }}
                      icon={<SkipForward className="h-4 w-4" />}
                    />
                  </div>
                </div>

                {skipping === t.id && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4">
                    <label htmlFor={`skip-${t.id}`} className="mb-1.5 block text-sm font-medium">
                      Why was this skipped?
                    </label>
                    <input
                      id={`skip-${t.id}`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      aria-invalid={!!reasonError}
                      aria-describedby={reasonError ? `skip-${t.id}-error` : undefined}
                      className="min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Client declined, felt unwell…"
                    />
                    {reasonError && (
                      <p id={`skip-${t.id}-error`} className="mt-1.5 text-sm text-destructive">
                        {reasonError}
                      </p>
                    )}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Button className="min-h-12 sm:min-h-11" onClick={() => confirmSkip(t.id)}>
                        Save skip
                      </Button>
                      <Button variant="ghost" className="min-h-12 sm:min-h-11" onClick={() => setSkipping(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StateButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-12 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}