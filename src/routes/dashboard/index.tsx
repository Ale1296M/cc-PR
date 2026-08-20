import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndex,
  head: () => ({
    meta: [
      { title: "Dashboard · Con Cariño PR" },
      { name: "description", content: "Taking you to the dashboard for your role." },
      { property: "og:title", content: "Dashboard · Con Cariño PR" },
      { property: "og:description", content: "Role-based caregiving dashboards for teams and families." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DashboardIndex() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (role === "admin") navigate({ to: "/app", replace: true });
    else if (role === "caregiver") navigate({ to: "/dashboard/caregiver", replace: true });
    else if (role === "family_member") navigate({ to: "/dashboard/family", replace: true });
  }, [loading, user, role, navigate]);

  if (!loading && user && role === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 md:px-8">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="type-display">Almost there</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Your account is set up. An agency admin will assign your role shortly — you'll see your
            dashboard as soon as that happens.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-12 items-center rounded-full border border-border px-6 hover:border-primary"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-24 md:px-8">
      <p className="text-muted-foreground">Loading your dashboard…</p>
    </main>
  );
}