import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError, toolJson, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_shifts",
  title: "List shifts",
  description: "List scheduled caregiving shifts, optionally filtered by care recipient and date range.",
  inputSchema: {
    client_id: z.string().uuid().optional().describe("Only shifts for this care recipient."),
    from: z.string().optional().describe("ISO date/time lower bound for shift start."),
    to: z.string().optional().describe("ISO date/time upper bound for shift start."),
    limit: z.number().int().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_id, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("shifts")
      .select("id, client_id, caregiver_id, starts_at, ends_at, status, notes")
      .order("starts_at", { ascending: true })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (client_id) query = query.eq("client_id", client_id);
    if (from) query = query.gte("starts_at", from);
    if (to) query = query.lte("starts_at", to);
    const { data, error } = await query;
    return error ? toolError(error.message) : toolJson(data ?? []);
  },
});