import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/use-auth";

/**
 * Route-level role guard. Returns a node to render instead of the page when the
 * user's role is not allowed (or still resolving); returns null when allowed.
 */
export function useRoleGate(allowed: AppRole[]) {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const denied = !loading && role !== null && !allowed.includes(role);

  useEffect(() => {
    if (denied) {
      toast.error("That page isn't available for your role.");
      navigate({ to: "/app" });
    }
  }, [denied, navigate]);

  if (loading || role === null) {
    return <p className="card-soft p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (denied) {
    return (
      <p className="card-soft p-6 text-sm text-muted-foreground">
        That page isn't available for your role. Taking you back home…
      </p>
    );
  }
  return null;
}

export function RoleGate({ allow, children }: { allow: AppRole[]; children: React.ReactNode }) {
  const gate = useRoleGate(allow);
  return <>{gate ?? children}</>;
}
