import { createFileRoute } from "@tanstack/react-router";
import WellbeingTracker from "@/components/wellbeing/WellbeingTracker";

export const Route = createFileRoute("/wellbeing")({
  component: WellbeingTracker,
  head: () => ({
    meta: [
      { title: "Wellbeing Tracker · Kindred" },
      {
        name: "description",
        content:
          "Log daily wellbeing check-ins and review a care recipient's 14-day wellbeing history.",
      },
      { property: "og:title", content: "Wellbeing Tracker · Kindred" },
      {
        property: "og:description",
        content: "Daily wellbeing check-ins and 14-day history for care recipients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});