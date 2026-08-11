import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, toolError, toolJson, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_care_recipients",
  title: "List care recipients",
  description: "List the care recipients the signed-in user can access.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("care_recipients")
      .select("id, full_name, address_line, city, municipality, zip_code, emergency_contact_name, emergency_contact_phone, notes")
      .order("full_name");
    return error ? toolError(error.message) : toolJson(data ?? []);
  },
});
