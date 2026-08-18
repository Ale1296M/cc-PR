import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/use-auth";

export const roleHome: Record<AppRole, "/dashboard/admin" | "/dashboard/caregiver" | "/dashboard/family"> = {
  admin: "/dashboard/admin",
  caregiver: "/dashboard/caregiver",
  family_member: "/dashboard/family",
};

/**
 * Route-level RBAC wrapper.
 * - Not authenticated  -> /login
 * - Authenticated, wrong role -> that user's own dashboard
 * - No role assigned yet -> "awaiting role" message
 */
export function ProtectedRoute({
  requiredRole,
  children,
}: {
  requiredRole: AppRole;
  children: React.ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const unauthenticated = !loading && !user;
  const mismatched = !loading && !!user && role !== null && role !== requiredRole;

  useEffect(() => {
    if (unauthenticated) navigate({ to: "/login", replace: true });
    else if (mismatched && role) navigate({ to: roleHome[role], replace: true });
  }, [unauthenticated, mismatched, role, navigate]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        Checking your access…
      </div>
    );
  }
  if (unauthenticated) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        Please sign in to continue. Taking you to the sign-in page…
      </div>
    );
  }
  if (role === null) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-display text-2xl">You're all set up</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An administrator will assign your role shortly. This page will open once that's done.
        </p>
      </div>
    );
  }
  if (mismatched) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        That dashboard isn't available for your role. Taking you to yours…
      </div>
    );
  }
  return <>{children}</>;
}