import { RoleGate } from "@/lib/role-gate";
import { AsyncState } from "@/components/ui/async-state";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { listFamilies, listUsers, setUserRole, type AppRole } from "@/lib/users.functions";

export const Route = createFileRoute("/app/users")({
  component: () => (
    <RoleGate allow={["admin"]}>
      <UsersPage />
    </RoleGate>
  ),
  head: () => ({
    meta: [
      { title: "Users & roles · Con Cariño PR" },
      { name: "description", content: "Admins review every Con Cariño PR account and assign caregiver, family, or admin roles." },
      { property: "og:title", content: "Users & roles · Con Cariño PR" },
      { property: "og:description", content: "Review Con Cariño PR accounts and assign roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "caregiver", label: "Caregivers" },
  { key: "family_member", label: "Family members" },
] as const;

const ROLES: AppRole[] = ["admin", "caregiver", "family_member"];

const roleLabel = (r: AppRole | null) => (r ? r.replace("_", " ") : "Pending");

const roleBadge = (r: AppRole | null) => {
  switch (r) {
    case "admin":
    case "caregiver":
      return "bg-primary/10 text-primary";
    case "family_member":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-attention text-attention-foreground";
  }
};


function UsersPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [linking, setLinking] = useState<{ userId: string; name: string } | null>(null);
  const [pickedFamily, setPickedFamily] = useState<string>("");
  const [newFamilyName, setNewFamilyName] = useState("");

  const fetchUsers = useServerFn(listUsers);
  const updateRole = useServerFn(setUserRole);
  const fetchFamilies = useServerFn(listFamilies);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: role === "admin",
  });

  const mutate = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole | null; familyId?: string; newFamilyName?: string }) =>
      updateRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-families"] });
      setLinking(null);
      setPickedFamily("");
      setNewFamilyName("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update role"),
  });

  const { data: families } = useQuery({
    queryKey: ["admin-families"],
    enabled: role === "admin",
    queryFn: () => fetchFamilies(),
  });

  if (role && role !== "admin") {
    return <p className="border-t border-border py-8 text-sm text-muted-foreground">Only admins can manage users.</p>;
  }

  const users = data ?? [];
  const filtered = users.filter((u) =>
    tab === "all" ? true : tab === "pending" ? u.role === null : u.role === tab,
  );

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="type-display mt-1">Users &amp; roles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage permissions &amp; roles for caregivers and family members
        </p>
      </header>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Security Announcement</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone with an account has specified boundaries. New signups stay pending until you assign a
          validated role.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count =
            t.key === "all"
              ? users.length
              : users.filter((u) => (t.key === "pending" ? u.role === null : u.role === t.key)).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:opacity-90"
              }`}
            >
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>


      <AsyncState
        isPending={isLoading}
        error={error}
        data={filtered}
        what="users"
        onRetry={() => refetch()}
        skeleton="list"
        empty={{
          title: "No users in this view",
          hint: "New people appear here as soon as they sign up — assign them a role to give them access.",
        }}
      >
        {(list) => (
      <div className="divide-y divide-border border-t border-border">
        {list.map((u) => (
          <div
            key={u.id}
            className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{u.full_name || "Unnamed"}</p>
              <p className="truncate text-sm text-muted-foreground">{u.email ?? "No email on file"}</p>
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Assigned role
                </p>
                <span className={`inline-block rounded-full px-4 py-1 text-xs capitalize ${roleBadge(u.role)}`}>
                  {roleLabel(u.role)}
                </span>
              </div>
              <div>
                <label
                  htmlFor={`role-${u.id}`}
                  className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                  Change role
                </label>
                <select
                  id={`role-${u.id}`}
                  value={u.role ?? ""}
                  disabled={mutate.isPending}
                  onChange={(e) => {
                    const next = (e.target.value || null) as AppRole | null;
                    if (next === "family_member") {
                      setPickedFamily("");
                      setNewFamilyName("");
                      setLinking({ userId: u.id, name: u.full_name || u.email || "This person" });
                      return;
                    }
                    mutate.mutate({ userId: u.id, role: next });
                  }}
                  className="min-h-10 rounded-lg border border-border bg-background px-4 text-sm capitalize"
                >
                  <option value="">Pending (no role)</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        ))}
      </div>
        )}
      </AsyncState>

      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="type-section">Add {linking.name} to a family</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              They&apos;ll see every care recipient belonging to the family you choose.
            </p>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Family</span>
                <select
                  value={pickedFamily}
                  onChange={(e) => {
                    setPickedFamily(e.target.value);
                    if (e.target.value !== "__new__") setNewFamilyName("");
                  }}
                  className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm"
                >
                  <option value="">Select a family…</option>
                  {(families ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name ?? `Family ${f.id.slice(0, 8)}`}
                    </option>
                  ))}
                  <option value="__new__">Create new family…</option>
                </select>
              </label>
              {pickedFamily === "__new__" && (
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                    New family name
                  </span>
                  <input
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    placeholder="Familia González"
                    className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm"
                  />
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setLinking(null);
                  setPickedFamily("");
                  setNewFamilyName("");
                }}
                className="rounded-full border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  mutate.isPending ||
                  !pickedFamily ||
                  (pickedFamily === "__new__" && !newFamilyName.trim())
                }
                onClick={() =>
                  mutate.mutate({
                    userId: linking.userId,
                    role: "family_member",
                    ...(pickedFamily === "__new__"
                      ? { newFamilyName: newFamilyName.trim() }
                      : { familyId: pickedFamily }),
                  })
                }
                className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
