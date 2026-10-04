// Server-side RBAC assertions. Used inside createServerFn handlers with the
// RLS-scoped client from requireSupabaseAuth. Denials are logged to
// public.security_events and surface as HTTP 403.
import { setResponseStatus } from "@tanstack/react-start/server";
import type { AccessLevel } from "./pii";

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

async function deny(supabase: any, event: string, resourceType: string, resourceId: string | null, details?: Record<string, unknown>): Promise<never> {
  try {
    await supabase.rpc("log_security_event", {
      _event: event,
      _resource_type: resourceType,
      _resource_id: resourceId,
      _details: details ?? null,
    });
  } catch {
    // logging must never turn a deny into an allow
  }
  try {
    setResponseStatus(403);
  } catch {
    /* not in a request context */
  }
  throw new ForbiddenError();
}

export async function assertAdmin(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) await deny(supabase, "admin_required", "admin_action", null);
}

export async function assertRecipientAccess(
  supabase: any,
  recipientId: string,
  allowed: AccessLevel[] = ["admin", "family", "caregiver"],
): Promise<AccessLevel> {
  const { data, error } = await supabase.rpc("recipient_access_level", { _recipient_id: recipientId });
  const level = (error ? null : data) as AccessLevel | null;
  if (!level || !allowed.includes(level)) {
    await deny(supabase, "recipient_access_denied", "care_recipient", recipientId, { level, allowed });
  }
  return level as AccessLevel;
}
