import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Phone, Mail, Pencil, Trash2, Plus, Star } from "lucide-react";

type Contact = {
  id: string;
  care_recipient_id: string;
  full_name: string;
  relationship: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
};

type Draft = {
  full_name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary: string;
  email: string;
  is_primary: boolean;
  notes: string;
};

const emptyDraft: Draft = {
  full_name: "",
  relationship: "",
  phone_primary: "",
  phone_secondary: "",
  email: "",
  is_primary: false,
  notes: "",
};

const inputCls =
  "mt-1 min-h-10 w-full rounded-md border border-border bg-background px-4 text-sm";

export function EmergencyContacts({
  careRecipientId,
  canEdit,
}: {
  careRecipientId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const key = ["emergency-contacts", careRecipientId];
  const { data: contacts, isPending, error, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("care_recipient_id", careRecipientId)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("full_name", { ascending: true });
      if (e) throw e;
      return (data ?? []) as Contact[];
    },
  });

  function reset() {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  const save = useMutation({
    mutationFn: async () => {
      const name = draft.full_name.trim();
      const phone = draft.phone_primary.trim();
      if (!name) throw new Error("Add a name for this contact.");
      if (!phone) throw new Error("Add a primary phone number.");
      const payload = {
        care_recipient_id: careRecipientId,
        full_name: name,
        relationship: draft.relationship.trim() || null,
        phone_primary: phone,
        phone_secondary: draft.phone_secondary.trim() || null,
        email: draft.email.trim() || null,
        is_primary: draft.is_primary,
        notes: draft.notes.trim() || null,
      };
      if (draft.is_primary) {
        const clear = supabase
          .from("emergency_contacts")
          .update({ is_primary: false })
          .eq("care_recipient_id", careRecipientId);
        const { error: ce } = editingId ? await clear.neq("id", editingId) : await clear;
        if (ce) throw ce;
      }
      if (editingId) {
        const { error: e } = await supabase
          .from("emergency_contacts")
          .update(payload)
          .eq("id", editingId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("emergency_contacts").insert(payload);
        if (e) throw e;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Contact updated" : "Contact added");
      reset();
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save this contact — try again."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("emergency_contacts").delete().eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => {
      toast.success("Contact removed");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't remove this contact — try again."),
  });

  const makePrimary = useMutation({
    mutationFn: async (id: string) => {
      const { error: ce } = await supabase
        .from("emergency_contacts")
        .update({ is_primary: false })
        .eq("care_recipient_id", careRecipientId)
        .neq("id", id);
      if (ce) throw ce;
      const { error: e } = await supabase
        .from("emergency_contacts")
        .update({ is_primary: true })
        .eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => {
      toast.success("Primary contact updated");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update the primary contact."),
  });

  function startEdit(c: Contact) {
    setAdding(false);
    setEditingId(c.id);
    setDraft({
      full_name: c.full_name,
      relationship: c.relationship ?? "",
      phone_primary: c.phone_primary,
      phone_secondary: c.phone_secondary ?? "",
      email: c.email ?? "",
      is_primary: c.is_primary,
      notes: c.notes ?? "",
    });
  }

  const form = (
    <div className="card-soft space-y-4 p-6">
      <h3 className="font-display text-xl">{editingId ? "Edit contact" : "New contact"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Full name
          <input
            value={draft.full_name}
            onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
            className={inputCls}
            placeholder="María Rivera"
          />
        </label>
        <label className="text-sm">
          Relationship
          <input
            value={draft.relationship}
            onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
            className={inputCls}
            placeholder="Daughter"
          />
        </label>
        <label className="text-sm">
          Primary phone
          <input
            value={draft.phone_primary}
            onChange={(e) => setDraft({ ...draft, phone_primary: e.target.value })}
            inputMode="tel"
            className={inputCls}
            placeholder="(787) 555-0134"
          />
        </label>
        <label className="text-sm">
          Secondary phone
          <input
            value={draft.phone_secondary}
            onChange={(e) => setDraft({ ...draft, phone_secondary: e.target.value })}
            inputMode="tel"
            className={inputCls}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Email
          <input
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            inputMode="email"
            className={inputCls}
          />
        </label>
      </div>
      <label className="block text-sm">
        Notes
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-background px-4 py-2 text-sm"
          placeholder="Best reached after 5pm…"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.is_primary}
          onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        Primary contact — called first in an emergency
      </label>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="min-h-10 rounded-full bg-primary px-6 text-sm text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : editingId ? "Save changes" : "Add contact"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="min-h-10 rounded-full border border-border px-6 text-sm hover:bg-secondary/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <section className="mb-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl">Emergency contacts</h2>
        {canEdit && !adding && !editingId && (
          <button
            type="button"
            onClick={() => {
              setDraft({ ...emptyDraft, is_primary: (contacts ?? []).length === 0 });
              setAdding(true);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-secondary/50"
          >
            <Plus className="h-4 w-4" /> Add contact
          </button>
        )}
      </div>

      {isPending && <LoadingState label="Loading emergency contacts…" />}
      {error && <ErrorState what="emergency contacts" error={error} onRetry={() => refetch()} />}

      {(adding || editingId) && <div className="mb-4">{form}</div>}

      {!isPending && !error && (contacts ?? []).length === 0 && !adding && (
        <EmptyState
          title="No emergency contacts yet"
          hint={
            canEdit
              ? "Add the people who should be called first if something happens during a visit."
              : "An administrator hasn’t added contacts for this person yet."
          }
        />
      )}

      {(contacts ?? []).length > 0 && (
        <div className="card-soft divide-y divide-border">
          {(contacts ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.full_name}</p>
                  {c.is_primary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-xs">
                      <Star className="h-3 w-3" /> Primary
                    </span>
                  )}
                  {c.relationship && (
                    <span className="text-xs text-muted-foreground">{c.relationship}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                  <a
                    href={`tel:${c.phone_primary.replace(/[^+\d]/g, "")}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm text-primary-foreground"
                  >
                    <Phone className="h-4 w-4" /> {c.phone_primary}
                  </a>
                  {c.phone_secondary && (
                    <a
                      href={`tel:${c.phone_secondary.replace(/[^+\d]/g, "")}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-secondary/50"
                    >
                      <Phone className="h-4 w-4" /> {c.phone_secondary}
                    </a>
                  )}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="inline-flex min-h-10 items-center gap-2 text-sm text-primary underline"
                    >
                      <Mail className="h-4 w-4" /> {c.email}
                    </a>
                  )}
                </div>
                {c.notes && <p className="mt-2 text-sm text-muted-foreground">{c.notes}</p>}
              </div>

              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {!c.is_primary && (
                    <button
                      type="button"
                      onClick={() => makePrimary.mutate(c.id)}
                      disabled={makePrimary.isPending}
                      className="min-h-10 rounded-full border border-border px-4 text-xs hover:bg-secondary/50 disabled:opacity-50"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    aria-label={`Edit ${c.full_name}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-secondary/50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${c.full_name} from emergency contacts?`)) remove.mutate(c.id);
                    }}
                    disabled={remove.isPending}
                    aria-label={`Remove ${c.full_name}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-secondary/50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}