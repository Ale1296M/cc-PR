import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Activity, AlertTriangle, CalendarDays, ClipboardList, Home, LogOut, MapPinOff, MessageCircle, NotebookPen, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/use-auth";

export const Route = createFileRoute("/app")({
  component: AppLayout,
  head: () => ({
    meta: [
      { title: "Workspace · Con Cariño PR" },
      { name: "description", content: "Your Con Cariño PR caregiving workspace." },
    ],
  }),
});

type NavItem = { to: string; label: string; icon: typeof Home };

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  admin: [
    { to: "/app", label: "Home", icon: Home },
    { to: "/app/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/app/clients", label: "Care recipients", icon: Users },
    { to: "/app/users", label: "Users", icon: ShieldCheck },
    { to: "/app/care-plan", label: "Care plan", icon: ClipboardList },
    { to: "/app/wellbeing", label: "Trends", icon: Activity },
    { to: "/app/incidents", label: "Incidents", icon: AlertTriangle },
    { to: "/app/exceptions", label: "Exceptions", icon: MapPinOff },
    { to: "/app/messages", label: "Messages", icon: MessageCircle },
  ],
  caregiver: [
    { to: "/app", label: "Home", icon: Home },
    { to: "/app/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/app/care-plan", label: "Care plan", icon: ClipboardList },
    { to: "/app/visit", label: "Log visit", icon: NotebookPen },
    { to: "/app/messages", label: "Messages", icon: MessageCircle },
  ],
  family_member: [
    { to: "/app", label: "Home", icon: Home },
    { to: "/app/wellbeing", label: "Wellbeing", icon: Activity },
    { to: "/app/care-plan", label: "Care plan", icon: ClipboardList },
    { to: "/app/messages", label: "Messages", icon: MessageCircle },
  ],
};

function AppLayout() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const visibleNav = role ? NAV_BY_ROLE[role] : [{ to: "/app", label: "Home", icon: Home }];

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: path } });
  }, [loading, user, navigate, path]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:flex-col bg-sidebar text-sidebar-foreground">
        <div className="p-6">
          <Link to="/" className="font-display text-2xl text-sidebar-primary">Con Cariño</Link>
          <p className="mt-1 text-xs uppercase tracking-widest text-sidebar-foreground/60">
            {role ? role.replace("_", " ") : "awaiting role"}
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-4">
        {visibleNav.map(({ to, label, icon: Icon }) => {
            const active = to === "/app" ? path === to : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to as "/app"}
                className={`flex items-center gap-4 rounded-lg px-4 py-2 text-sm transition ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm">{user.email}</p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="mt-2 flex w-full items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 pb-24 md:pb-0">
        <div className="mx-auto max-w-5xl px-6 py-8 md:px-12">
          {role === null ? <AwaitingRole email={user.email ?? ""} /> : <Outlet />}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border bg-card/95 py-2 backdrop-blur md:hidden">
        {visibleNav.map(({ to, label, icon: Icon }) => {
          const active = to === "/app" ? path === to : path.startsWith(to);
          return (
            <Link
              key={to}
              to={to as "/app"}
              className={`flex flex-col items-center gap-1 px-4 py-1 text-[11px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function AwaitingRole({ email }: { email: string }) {
  return (
    <div className="card-soft mx-auto max-w-xl p-8 text-center">
      <h1 className="font-display text-3xl">Your account is set up</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        An admin will assign your role shortly. Once that's done, your schedule, care plans and
        messages will appear here automatically.
      </p>
      {email && <p className="mt-4 text-xs text-muted-foreground">Signed in as {email}</p>}
    </div>
  );
}