import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, toolError, toolJson, unauthenticated } from "../supabase";

export default defineTool({
  name: "send_message",
  title: "Send message",
  description: "Send a message from the signed-in user to another member of the care team.",
  inputSchema: {
    recipient_id: z.string().uuid().describe("User id of the recipient."),
    body: z.string().trim().min(1).describe("Message text."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ recipient_id, body }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const userId = ctx.getUserId();
    if (!userId) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: userId, recipient_id, body })
      .select("id, created_at, recipient_id, body")
      .single();
    return error ? toolError(error.message) : toolJson(data);
  },
});