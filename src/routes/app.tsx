import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardList,
  Heart,
  HelpCircle,
  History,
  Home,
  LogOut,
  MapPinOff,
  MessageCircle,
  NotebookPen,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/use-auth";
import { useIncidentAlerts, usePendingUsers, useUnreviewedIncidents } from "@/lib/use-incident-alerts";
import { Button } from "@/components/ui/button";

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
    { to: "/app/activity", label: "Activity log", icon: History },
    { to: "/app/deleted", label: "Recently deleted", icon: Trash2 },
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

const ROLE_BADGES: Record<AppRole, string> = {
  admin: "ADMIN CONSOLE",
  caregiver: "CAREGIVER",
  family_member: "FAMILY",
};

const ROLE_TITLES: Record<AppRole, string> = {
  admin: "Super Admin",
  caregiver: "Caregiver",
  family_member: "Family Member",
};

function AppLayout() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const visibleNav = role ? NAV_BY_ROLE[role] : [{ to: "/app", label: "Home", icon: Home }];
  useIncidentAlerts(role, user?.id);
  const { data: unreviewed } = useUnreviewedIncidents(role);
  const { data: pendingUsers } = usePendingUsers(role);
  const badgeFor = (to: string) => {
    if (to === "/app/incidents") return (unreviewed ?? 0) > 0 ? unreviewed : null;
    if (to === "/app/users") return (pendingUsers ?? 0) > 0 ? pendingUsers : null;
    return null;
  };

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

  const today = new Date();
  const dateEyebrow = today
    .toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();

  const displayName =
    ((user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "User");
  const initials = displayName.charAt(0).toUpperCase();
  const roleBadge = role ? ROLE_BADGES[role] : "AWAITING ROLE";
  const roleTitle = role ? ROLE_TITLES[role] : "Awaiting role";

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 md:flex-col bg-sidebar text-sidebar-foreground">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Heart className="h-4 w-4 fill-current" />
            </div>
            <div>
              <Link to="/" className="font-display text-2xl text-sidebar-foreground">
                Con Cariño
              </Link>
              <span className="mt-1 block w-fit rounded-md bg-sidebar-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-accent-foreground">
                {roleBadge}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {visibleNav.map(({ to, label, icon: Icon }) => {
            const active = to === "/app" ? path === to : path.startsWith(to);
            const badge = badgeFor(to);
            return (
              <Link
                key={to}
                to={to as "/app"}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {badge != null && (
                  <span className="rounded-full bg-attention-soft px-2 py-0.5 text-[11px] font-medium text-attention-foreground">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-sidebar-foreground">{displayName}</p>
                <p className="text-xs text-sidebar-foreground/60">{roleTitle}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-background pb-24 md:pb-0">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-6 md:px-12">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {dateEyebrow}
          </span>
          <div className="flex items-center gap-3">
            <Link
              to="/app/incidents"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {(unreviewed ?? 0) > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-attention-soft text-[10px] font-medium text-attention-foreground">
                  {unreviewed}
                </span>
              )}
            </Link>
            <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" onClick={() => toast.info("Help Center coming soon")}>
              <HelpCircle className="h-4 w-4" />
              Help Center
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-6 md:px-12 md:py-8">
          {role === null ? <AwaitingRole email={user.email ?? ""} /> : <Outlet />}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border bg-card/95 py-2 backdrop-blur md:hidden">
        {visibleNav.map(({ to, label, icon: Icon }) => {
          const active = to === "/app" ? path === to : path.startsWith(to);
          const badge = badgeFor(to);
          return (
            <Link
              key={to}
              to={to as "/app"}
              className={`relative flex flex-col items-center gap-1 px-4 py-1 text-xs ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {badge != null && (
                <span className="absolute right-2 top-0 rounded-full bg-attention-soft px-1.5 text-[10px] font-medium text-attention-foreground">
                  {badge}
                </span>
              )}
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
      <h1 className="type-display">Your account is set up</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        An admin will assign your role shortly. Once that's done, your schedule, care plans and
        messages will appear here automatically.
      </p>
      {email && <p className="mt-4 text-xs text-muted-foreground">Signed in as {email}</p>}
    </div>
  );
}
