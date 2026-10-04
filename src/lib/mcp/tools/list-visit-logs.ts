import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError, toolJson, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_visit_logs",
  title: "List visit logs",
  description: "List recent visit logs (clock in/out, mood, notes) for care recipients the user can access.",
  inputSchema: {
    care_recipient_id: z.string().uuid().optional().describe("Only visits for this care recipient."),
    since: z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date").optional().describe("ISO date/time lower bound for clock-in."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ care_recipient_id, since, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("visit_logs")
      .select("id, care_recipient_id, caregiver_id, clock_in, clock_out, mood, notes")
      .is("deleted_at", null)
      .order("clock_in", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (care_recipient_id) query = query.eq("care_recipient_id", care_recipient_id);
    if (since) query = query.gte("clock_in", since);
    const { data, error } = await query;
    return error ? toolError(error.message) : toolJson(data ?? []);
  },
});
