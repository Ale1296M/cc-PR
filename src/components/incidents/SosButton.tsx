import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Siren, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { capturePosition } from "@/lib/geo";

// One-touch emergency alert: files a critical incident that lights up the admin
// console instantly. If it can't reach the server, falls back to calling 911.
export function SosButton({ careRecipientId, recipientName }: { careRecipientId: string; recipientName?: string }) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("offline");
      const pos = await capturePosition(5000).catch(() => null);
      const where = pos ? ` Location: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (±${Math.round(pos.accuracy ?? 0)}m).` : "";
      const { error } = await supabase.from("incident_reports").insert({
        care_recipient_id: careRecipientId,
        reported_by: user.id,
        reporter_role: role ?? null,
        incident_type: "other",
        severity: "critical",
        occurred_at: new Date().toISOString(),
        description: `SOS — emergency help requested${recipientName ? ` for ${recipientName}` : ""}.${where}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSent(true);
      setConfirming(false);
      toast.success("SOS sent — the care team has been alerted.");
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: () => {
      setFailed(true);
      setConfirming(false);
      toast.error("Couldn't send the alert. Call 911 now.");
    },
  });

  return (
    <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-destructive px-4 py-3 font-semibold text-destructive-foreground"
        >
          <Siren className="h-5 w-5" aria-hidden /> SOS — Emergency
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="sos-q" className="space-y-3">
          <p id="sos-q" className="font-semibold">Send an emergency alert to the care team now?</p>
          <div className="flex gap-3">
            <button
              type="button"
              autoFocus
              disabled={send.isPending}
              onClick={() => send.mutate()}
              className="min-h-12 flex-1 rounded-md bg-destructive px-4 font-semibold text-destructive-foreground disabled:opacity-60"
            >
              {send.isPending ? "Sending…" : "Yes, send SOS"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-12 flex-1 rounded-md border border-border px-4">
              Cancel
            </button>
          </div>
        </div>
      )}
      <p role="status" aria-live="assertive" className="mt-3 text-sm">
        {sent && "Alert sent. Stay with the person; an admin will contact you."}
        {failed && "The alert didn't go through."}
      </p>
      {(failed || sent) && (
        <a href="tel:911" className="mt-2 inline-flex min-h-12 items-center gap-2 font-semibold text-destructive underline">
          <Phone className="h-4 w-4" aria-hidden /> Call 911
        </a>
      )}
    </div>
  );
}
