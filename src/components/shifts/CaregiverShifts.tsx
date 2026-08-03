import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SHIFT_STATUSES, formatDay, formatTime, statusClass, statusLabel } from "./shift-utils";

export function CaregiverShifts({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const { data: shifts, isLoading } = useQuery({
    queryKey: ["my-shifts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_shifts")
        .select(
          "id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes, care_recipients(full_name, address_line, city, municipality)",
        )
        .order("scheduled_date")
        .order("scheduled_start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("care_shifts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-shifts"] }),
  });

  type Shift = NonNullable<typeof shifts>[number];
  const byDay = (shifts ?? []).reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.scheduled_date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">My schedule</p>
        <h1 className="mt-1 font-display text-4xl">Your shifts</h1>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && Object.keys(byDay).length === 0 && (
        <p className="card-soft p-6 text-sm text-muted-foreground">
          No shifts are assigned to you yet.
        </p>
      )}

      <div className="space-y-8">
        {Object.entries(byDay).map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-3 font-display text-xl">{formatDay(day)}</h2>
            <div className="card-soft divide-y divide-border">
              {list.map((s) => {
                const r = s.care_recipients as unknown as {
                  full_name: string;
                  address_line: string | null;
                  city: string | null;
                  municipality: string | null;
                } | null;
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="w-32 text-sm">
                      {formatTime(s.scheduled_start_time)} – {formatTime(s.scheduled_end_time)}
                    </div>
                    <div className="min-w-40 flex-1">
                      <p className="font-medium">{r?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[r?.address_line, r?.city ?? r?.municipality].filter(Boolean).join(", ")}
                      </p>
                      {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                    </div>
                    <select
                      value={s.status}
                      onChange={(e) => setStatus.mutate({ id: s.id, status: e.target.value })}
                      className={`rounded-full px-3 py-1 text-xs ${statusClass(s.status)}`}
                    >
                      {SHIFT_STATUSES.map((o) => (
                        <option key={o} value={o}>
                          {statusLabel(o)}
                        </option>
                      ))}
                    </select>
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