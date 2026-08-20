import { RoleGate } from "@/lib/role-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { AsyncState } from "@/components/ui/async-state";

export const Route = createFileRoute("/app/clients")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <CareRecipientsPage />
    </RoleGate>
  ),
});

type NewRecipient = {
  full_name: string;
  family_id: string;
  address_line: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
};

function CareRecipientsPage() {
  const { role } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const {
    data: recipients,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["care-recipients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_recipients")
        .select("id, full_name, address_line, city, municipality, emergency_contact_name, emergency_contact_phone")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: families } = useQuery({
    queryKey: ["families-options"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data } = await supabase
        .from("families")
        .select("id, name")
        .order("name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (fields: NewRecipient) => {
      const { error } = await supabase.from("care_recipients").insert({
        full_name: fields.full_name,
        family_id: fields.family_id,
        address_line: fields.address_line || null,
        emergency_contact_name: fields.emergency_contact_name || null,
        emergency_contact_phone: fields.emergency_contact_phone || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Care recipient added");
      qc.invalidateQueries({ queryKey: ["care-recipients-list"] });
      setShowNew(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't add the care recipient — try again."),
  });

  return (
    <div>
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Database</p>
          <h1 className="type-display mt-1">Who we care for</h1>
        </div>
        {role === "admin" && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm text-primary-foreground"
          >
            <Plus className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Add care recipient</span><span className="sm:hidden">Add</span>
          </button>
        )}
      </header>

      <AsyncState
        isPending={isPending}
        error={error}
        data={recipients}
        what="care recipients"
        onRetry={() => refetch()}
        skeleton="cards"
        empty={{
          title: "No care recipients yet",
          hint: "Use “Add care recipient” to create the first person on the roster and link them to a family.",
        }}
      >
        {(rows) => (
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((c, i) => {
          const tags = EXAMPLE_TAGS[i % EXAMPLE_TAGS.length];
          return (
          <article key={c.id} className="card-soft flex flex-col gap-4 p-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary font-medium">
              {c.full_name?.trim().charAt(0).toUpperCase() || "?"}
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold">{c.full_name}</h2>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t.label}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                        t.risk ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {(c.address_line || c.municipality || c.city) && (
              <p className="text-sm text-muted-foreground">
                {[c.address_line, c.municipality ?? c.city].filter(Boolean).join(", ")}
              </p>
            )}

            {c.emergency_contact_name && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Emergency contact</p>
                <p className="mt-1 text-sm">{c.emergency_contact_name}</p>
                {c.emergency_contact_phone && (
                  <p className="text-sm text-muted-foreground">{c.emergency_contact_phone}</p>
                )}
              </div>
            )}

            <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
              <Link
                to="/app/clients/$clientId"
                params={{ clientId: c.id }}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-3 text-sm hover:bg-muted"
              >
                View Profile
              </Link>
              <Link
                to="/app/care-plan"
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-3 text-sm text-primary-foreground hover:opacity-90"
              >
                Care Plan
              </Link>
            </div>
          </article>
          );
        })}
      </div>
        )}

      </AsyncState>

      {showNew && (
        <NewCareRecipient
          families={(families ?? []).map((f) => ({
            id: f.id,
            label: f.name ?? `Family ${f.id.slice(0, 8)}`,
          }))}
          onCreate={(f) => create.mutate(f)}
          onClose={() => setShowNew(false)}
          busy={create.isPending}
        />
      )}
    </div>
  );
}

function NewCareRecipient({
  families, onCreate, onClose, busy,
}: {
  families: Array<{ id: string; label: string }>;
  onCreate: (f: NewRecipient) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [full_name, setName] = useState("");
  const [family_id, setFamily] = useState("");
  const [address_line, setAddress] = useState("");
  const [emergency_contact_name, setContact] = useState("");
  const [emergency_contact_phone, setPhone] = useState("");
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="type-subhead mb-4">New care recipient</h3>
        <div className="space-y-4">
          <F label="Full name" value={full_name} onChange={setName} />
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Family</span>
            <select
              value={family_id}
              onChange={(e) => setFamily(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm"
            >
              <option value="">Select a family…</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">
              Everyone who belongs to this family will be able to see this care recipient.
            </span>
          </label>
          <F label="Address" value={address_line} onChange={setAddress} />
          <F label="Emergency contact" value={emergency_contact_name} onChange={setContact} />
          <F label="Contact phone" value={emergency_contact_phone} onChange={setPhone} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            disabled={!full_name || !family_id || busy}
            onClick={() => onCreate({ full_name, family_id, address_line, emergency_contact_name, emergency_contact_phone })}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function F({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm"
      />
    </label>
  );
}
