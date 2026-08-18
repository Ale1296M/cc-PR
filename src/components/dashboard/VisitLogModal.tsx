import { useState } from "react";
import { MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function VisitLogModal({
  open,
  onOpenChange,
  client,
  verified,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: string;
  verified: boolean;
}) {
  // Clock-in timestamp is captured automatically when the log is created.
  const [clockedInAt] = useState(() => new Date());
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [errors, setErrors] = useState<{ notes?: string; signature?: string }>({});

  const save = () => {
    const next: typeof errors = {};
    if (notes.trim().length < 5) next.notes = "Add a short note about the visit.";
    if (!signature.trim()) next.signature = "Type your full name to sign this log.";
    setErrors(next);
    if (Object.keys(next).length) return;
    toast.success("Visit log saved", {
      description: `Signed by ${signature.trim()} · clocked in ${clockedInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log this visit</DialogTitle>
          <DialogDescription>{client}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 font-medium tabular-nums">
              Clocked in {clockedInAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                verified ? "bg-primary/15 text-primary" : "bg-attention-soft text-attention-foreground"
              }`}
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {verified ? "Location verified" : "Location pending"}
            </span>
          </div>

          <div>
            <label htmlFor="visit-notes" className="mb-1.5 block text-sm font-medium">
              Visit notes
            </label>
            <textarea
              id="visit-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? "visit-notes-error" : undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="How did the visit go?"
            />
            {errors.notes && (
              <p id="visit-notes-error" className="mt-1.5 text-sm text-destructive">{errors.notes}</p>
            )}
          </div>

          <div>
            <label htmlFor="visit-signature" className="mb-1.5 block text-sm font-medium">
              Digital signature
            </label>
            <input
              id="visit-signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              aria-invalid={!!errors.signature}
              aria-describedby={errors.signature ? "visit-signature-error" : "visit-signature-hint"}
              className="min-h-14 w-full rounded-md border border-input bg-background px-3 py-2 text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
              placeholder="Type your full name"
            />
            {errors.signature ? (
              <p id="visit-signature-error" className="mt-1.5 text-sm text-destructive">{errors.signature}</p>
            ) : (
              <p id="visit-signature-hint" className="mt-1.5 text-xs text-muted-foreground">
                Typing your name counts as your signature for this visit record.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="min-h-12 sm:min-h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-12 sm:min-h-11" onClick={save}>
            Save visit log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}