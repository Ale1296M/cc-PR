import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError, toolJson, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_care_plan_items",
  title: "List care plan items",
  description: "List the care plan checklist items for one care recipient.",
  inputSchema: {
    care_recipient_id: z.string().uuid().describe("The care recipient's id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ care_recipient_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("care_plan_items")
      .select("id, care_recipient_id, task_description, category, frequency, active")
      .eq("care_recipient_id", care_recipient_id)
      .order("created_at");
    return error ? toolError(error.message) : toolJson(data ?? []);
  },
});