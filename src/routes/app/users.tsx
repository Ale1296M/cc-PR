import { RoleGate } from "@/lib/role-gate";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { listUsers, setUserRole, type AppRole } from "@/lib/users.functions";

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

function UsersPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");

  const fetchUsers = useServerFn(listUsers);
  const updateRole = useServerFn(setUserRole);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: role === "admin",
  });

  const mutate = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole | null }) => updateRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update role"),
  });

  if (role && role !== "admin") {
    return <p className="card-soft p-6 text-sm text-muted-foreground">Only admins can manage users.</p>;
  }

  const users = data ?? [];
  const filtered = users.filter((u) =>
    tab === "all" ? true : tab === "pending" ? u.role === null : u.role === tab,
  );

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="mt-1 font-display text-4xl">Users &amp; roles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everyone with an account. New signups stay pending until you assign a role.
        </p>
      </header>

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
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {isLoading && <p className="card-soft p-6 text-sm text-muted-foreground">Loading users…</p>}
      {error && (
        <p className="card-soft p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load users."}
        </p>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <p className="card-soft p-6 text-sm text-muted-foreground">No users in this view.</p>
      )}

      <div className="space-y-3">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{u.full_name || "Unnamed"}</p>
              <p className="truncate text-sm text-muted-foreground">{u.email ?? "No email on file"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs capitalize ${
                  u.role ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {roleLabel(u.role)}
              </span>
              <select
                value={u.role ?? ""}
                disabled={mutate.isPending}
                onChange={(e) =>
                  mutate.mutate({ userId: u.id, role: (e.target.value || null) as AppRole | null })
                }
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm capitalize"
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
        ))}
      </div>
    </div>
  );
}
