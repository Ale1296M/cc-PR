import { createFileRoute } from "@tanstack/react-router";
import { AdminShifts } from "@/components/shifts/AdminShifts";
import { CaregiverShifts } from "@/components/shifts/CaregiverShifts";
import { FamilyCalendar } from "@/components/shifts/FamilyCalendar";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/app/shifts")({
  component: ShiftsPage,
  head: () => ({
    meta: [
      { title: "Shifts & visit calendar · Kindred" },
      {
        name: "description",
        content:
          "Schedule caregiver shifts, follow your loved one's upcoming visits, and check your own assignments.",
      },
      { property: "og:title", content: "Shifts & visit calendar · Kindred" },
      {
        property: "og:description",
        content:
          "Schedule caregiver shifts, follow your loved one's upcoming visits, and check your own assignments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ShiftsPage() {
  const { user, role, loading } = useAuth();

  if (loading || !user) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (role === "admin") return <AdminShifts adminId={user.id} />;
  if (role === "caregiver") return <CaregiverShifts userId={user.id} />;
  if (role === "family_member") return <FamilyCalendar userId={user.id} />;

  return (
    <div className="card-soft p-6">
      <h1 className="font-display text-2xl">Waiting on access</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An agency admin needs to grant you a role before shifts appear here.
      </p>
    </div>
  );
}