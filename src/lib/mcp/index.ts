import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCarePlanItems from "./tools/list-care-plan";
import listClients from "./tools/list-clients";
import listShifts from "./tools/list-shifts";
import listVisitLogs from "./tools/list-visit-logs";
import sendMessage from "./tools/send-message";

// Must be the direct Supabase issuer; the published SUPABASE_URL is a proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "careconnect-hub",
  title: "CareConnect Hub",
  version: "0.1.0",
  instructions:
    "Tools for the Kindred caregiving coordination app. Read care recipients, shifts, care plan items, and visit logs, and send messages to the care team. All access is scoped to the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listClients, listShifts, listCarePlanItems, listVisitLogs, sendMessage],
});