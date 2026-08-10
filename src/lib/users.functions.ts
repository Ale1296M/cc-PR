import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "caregiver" | "family_member";

export type AdminUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: AppRole | null;
  created_at: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Unable to verify permissions");
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (pErr) throw pErr;
    if (rErr) throw rErr;

    const emails = new Map<string, string | null>();
    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      data.users.forEach((u) => emails.set(u.id, u.email ?? null));
      if (data.users.length < 200) break;
      page += 1;
      if (page > 10) break;
    }

    const rank: Record<string, number> = { admin: 1, caregiver: 2, family_member: 3 };
    const roleByUser = new Map<string, AppRole>();
    (roles ?? []).forEach((r: any) => {
      const cur = roleByUser.get(r.user_id);
      if (!cur || rank[r.role] < rank[cur]) roleByUser.set(r.user_id, r.role);
    });

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: emails.get(p.id) ?? null,
      phone: p.phone,
      role: roleByUser.get(p.id) ?? null,
      created_at: p.created_at,
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "caregiver", "family_member"]).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (delErr) throw delErr;

    if (data.role) {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
      if (error) throw error;
    }
    return { ok: true };
  });
