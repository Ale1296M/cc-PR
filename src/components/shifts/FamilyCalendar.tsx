import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CaregiverAvatar } from "./CaregiverAvatar";
import { firstName, formatDay, formatTime, statusClass, statusLabel, todayISO } from "./shift-utils";

export function FamilyCalendar({ userId }: { userId: string }) {
  const { data: shifts, isLoading } = useQuery({
    queryKey: ["family-shifts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, care_recipients(full_name), caregivers(profiles(full_name, avatar_url))",
        )
        .gte("scheduled_date", todayISO())
        .order("scheduled_date")
        .order("scheduled_start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  type Shift = NonNullable<typeof shifts>[number];
  const byDay = (shifts ?? []).reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.scheduled_date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Calendar</p>
        <h1 className="mt-1 font-display text-4xl">Upcoming visits</h1>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && Object.keys(byDay).length === 0 && (
        <p className="card-soft p-6 text-sm text-muted-foreground">
          No upcoming visits are scheduled yet.
        </p>
      )}

      <div className="space-y-8">
        {Object.entries(byDay).map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-3 font-display text-xl">{formatDay(day)}</h2>
            <div className="card-soft divide-y divide-border">
              {list.map((s) => {
                const profile = (
                  s.caregivers as unknown as {
                    profiles: { full_name: string | null; avatar_url: string | null } | null;
                  } | null
                )?.profiles;
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                    <CaregiverAvatar fullName={profile?.full_name} avatarUrl={profile?.avatar_url} />
                    <div className="min-w-40 flex-1">
                      <p className="font-medium">
                        {profile ? firstName(profile.full_name) : "Caregiver to be assigned"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        with{" "}
                        {(s.care_recipients as unknown as { full_name: string } | null)?.full_name}
                      </p>
                    </div>
                    <div className="text-sm">
                      {formatTime(s.scheduled_start_time)} – {formatTime(s.scheduled_end_time)}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs ${statusClass(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}