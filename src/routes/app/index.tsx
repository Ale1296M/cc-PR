import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user, role } = useAuth();
  const uid = user?.id;

  const { data: shifts } = useQuery({
    queryKey: ["dash-shifts", uid, role],
    enabled: !!uid,
    queryFn: async () => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      let q = supabase
        .from("shifts")
        .select("id, starts_at, ends_at, status, notes, clients(id, full_name)")
        .gte("starts_at", from.toISOString())
        .lte("starts_at", to.toISOString())
        .order("starts_at");
      if (role === "caregiver") q = q.eq("caregiver_id", uid!);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientCount } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => {
      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: unread } = useQuery({
    queryKey: ["dash-unread", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", uid!)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  const today = new Date();
  const todayShifts = (shifts ?? []).filter(
    (s) => new Date(s.starts_at).toDateString() === today.toDateString(),
  );

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 font-display text-4xl md:text-5xl">Good to see you.</h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Today's visits" value={todayShifts.length} />
        <Stat label="Active clients" value={clientCount ?? 0} />
        <Stat label="Unread messages" value={unread ?? 0} accent />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Upcoming this week</h2>
          <Link to="/app/schedule" className="text-sm text-primary hover:underline">
            Full schedule →
          </Link>
        </div>
        <div className="card-soft divide-y divide-border">
          {(shifts ?? []).length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">
              No shifts scheduled in the next 7 days.
            </p>
          )}
          {(shifts ?? []).slice(0, 8).map((s) => {
            const d = new Date(s.starts_at);
            const e = new Date(s.ends_at);
            return (
              <div key={s.id} className="flex items-center gap-4 p-4">
                <div className="w-20 shrink-0 text-sm">
                  <p className="font-medium">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="text-muted-foreground">
                    {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    {(s.clients as unknown as { full_name: string } | null)?.full_name ?? "Client"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((+e - +d) / 3600000)}h · {s.status}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs">{s.status}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card-soft p-5 ${accent ? "bg-gold/10" : ""}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-4xl">{value}</p>
    </div>
  );
}