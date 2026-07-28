import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/app/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const { role } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, address, primary_contact_name, primary_contact_phone")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (fields: { full_name: string; address: string; primary_contact_name: string; primary_contact_phone: string }) => {
      const { error } = await supabase.from("clients").insert(fields);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-list"] });
      setShowNew(false);
    },
  });

  return (
    <div>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Clients</p>
          <h1 className="mt-1 font-display text-4xl">Who we care for</h1>
        </div>
        {role === "admin" && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add client
          </button>
        )}
      </header>

      {(clients ?? []).length === 0 && (
        <p className="card-soft p-6 text-sm text-muted-foreground">No clients yet.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(clients ?? []).map((c) => (
          <Link
            key={c.id}
            to="/app/clients/$clientId"
            params={{ clientId: c.id }}
            className="card-soft group p-5 transition hover:border-primary"
          >
            <p className="font-display text-2xl group-hover:text-primary">{c.full_name}</p>
            {c.address && <p className="mt-1 text-sm text-muted-foreground">{c.address}</p>}
            {c.primary_contact_name && (
              <p className="mt-3 text-xs text-muted-foreground">
                Contact: {c.primary_contact_name}
                {c.primary_contact_phone ? ` · ${c.primary_contact_phone}` : ""}
              </p>
            )}
          </Link>
        ))}
      </div>

      {showNew && (
        <NewClient
          onCreate={(f) => create.mutate(f)}
          onClose={() => setShowNew(false)}
          busy={create.isPending}
        />
      )}
    </div>
  );
}

function NewClient({
  onCreate, onClose, busy,
}: {
  onCreate: (f: { full_name: string; address: string; primary_contact_name: string; primary_contact_phone: string }) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [full_name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [primary_contact_name, setContact] = useState("");
  const [primary_contact_phone, setPhone] = useState("");
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="mb-4 font-display text-2xl">New client</h3>
        <div className="space-y-3">
          <F label="Full name" value={full_name} onChange={setName} />
          <F label="Address" value={address} onChange={setAddress} />
          <F label="Primary contact" value={primary_contact_name} onChange={setContact} />
          <F label="Contact phone" value={primary_contact_phone} onChange={setPhone} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            disabled={!full_name || busy}
            onClick={() => onCreate({ full_name, address, primary_contact_name, primary_contact_phone })}
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
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}