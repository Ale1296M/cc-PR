import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError, toolJson, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_shifts",
  title: "List shifts",
  description: "List scheduled caregiving shifts, optionally filtered by care recipient and date range.",
  inputSchema: {
    care_recipient_id: z.string().uuid().optional().describe("Only shifts for this care recipient."),
    from: z.string().optional().describe("ISO date (YYYY-MM-DD) lower bound for the shift date."),
    to: z.string().optional().describe("ISO date (YYYY-MM-DD) upper bound for the shift date."),
    limit: z.number().int().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ care_recipient_id, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("care_shifts")
      .select(
        "id, care_recipient_id, caregiver_id, scheduled_date, scheduled_start_time, scheduled_end_time, status, notes",
      )
      .order("scheduled_date", { ascending: true })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (care_recipient_id) query = query.eq("care_recipient_id", care_recipient_id);
    if (from) query = query.gte("scheduled_date", from);
    if (to) query = query.lte("scheduled_date", to);
    const { data, error } = await query;
    return error ? toolError(error.message) : toolJson(data ?? []);
  },
});
