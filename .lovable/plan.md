# One consistent family-access model (schema + RLS + backfill)

## The problem in one sentence

Two different rules decide "is this person family of this care recipient": the household path (`families.profile_id = uid`) and the per-user path (`client_family_members.user_id = uid`). Screens disagree, so a relative sees the schedule but not the visit logs — or a family appears with no recipients at all. This plan collapses both into a single rule used by every policy and every query.

---

## 1. Target schema — Option (a), with a `name` column

**Chosen: introduce `public.family_members` (family_id, user_id, relationship) and retire `client_family_members`.**

```text
profiles --< family_members >-- families --< care_recipients --< everything else
```

Why (a) over (b):
- The real-world statement is "Ana belongs to the González family," not "Ana is linked to Abuela and separately to Abuelo." One row per relative, not one per relative-per-recipient.
- Adding a recipient to a family automatically grants every relative access — no fan-out inserts, no drift. Under (b) you would have to insert an extra `client_family_members` row for every existing relative each time a recipient is added, and forgetting one silently removes access.
- (b) still needs a join through `care_recipients.family_id` to be correct, so you end up with the family-level rule anyway — but with a table whose grain lies about the model. That is the messier option.
- (a) makes `families.profile_id` unnecessary as an access path (kept only as "primary contact"), removing the one-account-per-family assumption.

Schema changes:
- `ALTER TABLE public.families ADD COLUMN name text` — display label ("Familia González"). Fixes the dropdown, which today shows the owner's profile name and blanks out when `profile_id` has no matching profile.
  Backfill: `'Familia ' || split_part(p.full_name, ' ', 2)` when a profile with a two-part name exists, else `'Familia ' || p.full_name`, else `'Familia ' || left(id::text, 8)`. Set `NOT NULL` later, once verified.
- `families.profile_id` becomes nullable and is redefined as "primary contact", no longer an access grant. Not dropped in this migration.
- New table:

```sql
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
GRANT SELECT ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
```

Policies on `family_members` itself: admins full access via `has_role(auth.uid(),'admin')`; authenticated users read only their own rows (`user_id = auth.uid()`); writes are admin/service-role only (the approval flow already uses `supabaseAdmin`). Reading other members of your own family is deliberately not granted — nothing in the app needs it. Attach the `fn_audit` trigger to match sibling tables.

`client_family_members` is kept but frozen through the whole rollout, dropped only in the final cleanup step.

---

## 2. The single helper functions, and every policy rewrite

Two SECURITY DEFINER functions, both `STABLE`, `SET search_path = public`:

```sql
CREATE OR REPLACE FUNCTION public.user_in_family(_user_id uuid, _family_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.family_id = _family_id AND fm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_in_family_of_recipient(_user_id uuid, _recipient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_recipients r
    JOIN public.family_members fm ON fm.family_id = r.family_id
    WHERE r.id = _recipient_id AND fm.user_id = _user_id
  );
$$;
```

Both are recursion-safe: they read `family_members` / `care_recipients` from inside a definer function and never re-enter the policy being evaluated.

Existing `user_can_access_family` and `user_can_view_recipient` are rewritten in place to delegate to these, keeping their admin and caregiver branches byte-for-byte, so any policy already using them upgrades for free.

Policy-by-policy. Admin-all and caregiver policies are left untouched throughout; existing `deleted_at IS NULL` clauses are carried over verbatim — only the family clause changes.

| Table | Policy | New expression |
|---|---|---|
| care_recipients | `cr family read` (SELECT) | `USING (public.user_in_family(auth.uid(), family_id))` |
| care_shifts | `care_shifts family read` (SELECT) | `USING (public.user_in_family_of_recipient(auth.uid(), care_recipient_id))` |
| caregivers | `caregivers family read assigned` (SELECT) | `USING (EXISTS (SELECT 1 FROM care_shifts s JOIN care_recipients r ON r.id = s.care_recipient_id WHERE s.caregiver_id = caregivers.id AND public.user_in_family(auth.uid(), r.family_id)))` |
| emergency_contacts | `ec family read` (SELECT) | `USING (public.user_in_family_of_recipient(auth.uid(), care_recipient_id))` |
| incident_reports | `ir family read` (SELECT) | `USING (public.user_in_family_of_recipient(auth.uid(), care_recipient_id))` |
| incident_reports | `ir family create` (INSERT) | `WITH CHECK (reported_by = auth.uid() AND public.user_in_family_of_recipient(auth.uid(), care_recipient_id))` |
| visit_logs | `vl family read` (SELECT) | `USING (public.user_in_family_of_recipient(auth.uid(), care_recipient_id))` |
| wellbeing_entries | `we family read` (SELECT) | `USING (EXISTS (SELECT 1 FROM visit_logs v WHERE v.id = wellbeing_entries.visit_log_id AND public.user_in_family_of_recipient(auth.uid(), v.care_recipient_id)))` |
| family_messages | via `can_access_family_thread` | rewrite body to `SELECT public.has_role(_user_id,'admin') OR public.user_in_family(_user_id, _family_id);` — every policy referencing it upgrades automatically |

---

## 3. Data migration, in order, idempotent

**Step A — add `family_members`, `families.name`, and the two functions.** Additive only; no policy references them yet, so nothing can break.

**Pre-check before backfilling** (so the widening below is a conscious decision):

```sql
SELECT r.id, r.full_name, r.family_id,
       (SELECT count(*) FROM public.client_family_members c WHERE c.care_recipient_id = r.id) AS direct_links
FROM public.care_recipients r ORDER BY r.family_id, r.full_name;
```

**Step B — backfill membership from BOTH current sources:**

```sql
-- B1: household owners
INSERT INTO public.family_members (family_id, user_id, relationship)
SELECT f.id, f.profile_id, 'primary'
FROM public.families f
WHERE f.profile_id IS NOT NULL
ON CONFLICT (family_id, user_id) DO NOTHING;

-- B2: per-recipient links, promoted to family level
INSERT INTO public.family_members (family_id, user_id, relationship)
SELECT DISTINCT r.family_id, cfm.user_id, cfm.relationship
FROM public.client_family_members cfm
JOIN public.care_recipients r ON r.id = cfm.care_recipient_id
WHERE r.family_id IS NOT NULL
ON CONFLICT (family_id, user_id) DO NOTHING;
```

**Step C — backfill `families.name`** with the heuristic above; leave nullable for now.

Effect on the current data:
- `family_test` joins its family via B1 and again via B2 (María's link) — one row after the conflict clause. It now sees all three recipients instead of only María. This is a deliberate widening and is the point of the target model: all three already carry `family_id = family_test`, so the household path already granted them recipient and schedule access; only the per-user-path screens (visit logs, wellbeing, incidents, emergency contacts) were narrower. If Jose and Maria Amparo actually belong to different households, correct their `family_id` first — do not keep two rules to paper over it.
- `Al Pacino` joins his own empty family via B1. He still sees zero recipients, correctly, until an admin assigns one. His family now shows as "Familia Pacino" instead of blank.
- Recipients with `family_id` but no per-user link (Jose, Maria Amparo) need no action; they are reached through `family_id`, which is untouched.

**Post-migration verification set** — run all of these before touching any policy:

```sql
-- V1: no orphan members
SELECT fm.* FROM public.family_members fm
LEFT JOIN public.families f ON f.id = fm.family_id WHERE f.id IS NULL;  -- expect 0

-- V2: every old household grant survives
SELECT f.id, f.profile_id FROM public.families f
WHERE f.profile_id IS NOT NULL AND NOT public.user_in_family(f.profile_id, f.id);  -- expect 0

-- V3: every old per-user grant survives
SELECT cfm.user_id, cfm.care_recipient_id FROM public.client_family_members cfm
WHERE NOT public.user_in_family_of_recipient(cfm.user_id, cfm.care_recipient_id);  -- expect 0

-- V4: nobody reaches a recipient outside a family they belong to
SELECT fm.user_id, r.id FROM public.family_members fm
JOIN public.care_recipients r ON true
WHERE public.user_in_family_of_recipient(fm.user_id, r.id)
  AND r.family_id NOT IN (SELECT family_id FROM public.family_members WHERE user_id = fm.user_id);  -- expect 0

-- V5: names and family assignment complete
SELECT id FROM public.families WHERE name IS NULL;                          -- expect 0
SELECT id, full_name FROM public.care_recipients WHERE family_id IS NULL;   -- expect 0

-- V6: old vs new grant matrix (the acceptance artifact)
SELECT p.id AS user_id, p.full_name, r.full_name AS recipient,
       EXISTS (SELECT 1 FROM public.families f WHERE f.id = r.family_id AND f.profile_id = p.id) AS old_household,
       EXISTS (SELECT 1 FROM public.client_family_members c WHERE c.user_id = p.id AND c.care_recipient_id = r.id) AS old_direct,
       public.user_in_family_of_recipient(p.id, r.id) AS new_access
FROM public.profiles p CROSS JOIN public.care_recipients r
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'family_member')
ORDER BY p.full_name, r.full_name;
```

V6 is the gate: `new_access` must be true wherever `old_household OR old_direct` is true, and every additional true must be an intended widening within the same family.

**Step D (last, separate migration):** `families.name` to `NOT NULL`; drop `client_family_members` with its audit triggers, after the app no longer references it.

---

## 4. App and flow changes

**"Family" dropdown (`src/routes/app/clients.tsx`).** Today it selects `families.id, profiles:profile_id(full_name)` and falls back to `Family <uuid prefix>`. It becomes `select id, name` labeled by `f.name`. State the semantics in the UI: the Family field assigns the recipient to a household, and every relative in that household will see this person. Add that as a hint line under the select.

**Approval flow (`src/lib/users.functions.ts` + `src/routes/app/users.tsx`).** The dialog currently asks "which care recipients should this person see," which is the wrong question under the new model. It becomes "which family does this person belong to":
- `setUserRole` takes `familyId?: string` in place of `careRecipientIds` and, for `family_member`, inserts `family_members(family_id, user_id)` with `ON CONFLICT DO NOTHING`.
- A new `families` row is created only when the admin explicitly picks "New family" and supplies a name. The current unconditional auto-create is what produced Al Pacino's empty orphan family and should stop.
- Selecting nothing still sets the role — non-blocking, as today.

**Read sites to update:**
- `src/routes/app/wellbeing.tsx` (~L164–190) — family branch: replace the `families.profile_id` query plus `client_family_members` union with one query on `family_members -> care_recipients`.
- `src/routes/app/schedule.tsx` (~L56–70) — the same union in `FamilySchedule`.
- `src/routes/app/index.tsx` (~L119) — family hero's `families.profile_id` lookup.
- `src/routes/app/messages.tsx` (~L68) — family threads resolved from `family_members` rather than owned families.
- `src/routes/app/clients.tsx` — dropdown, above. The recipients list itself is admin-only and RLS-driven; no change.
- `src/lib/users.functions.ts` — as above.
- `src/routes/app/activity.tsx` (L40) — swap the `client_family_members` filter entry for `family_members`.
- `src/lib/use-auth.ts` — expose `familyIds` once so the screens above stop re-deriving it. Recommended: the duplication is why the two paths drifted.
- `src/routes/app/incidents.tsx`, `clients.$clientId.tsx`, `visit.tsx`, `care-plan.tsx` rely on RLS only — no membership query, no change. MCP tools go through the same RLS.

Extract one `src/lib/family-access.ts` (`useMyFamilyRecipients()`) so there is exactly one client-side implementation mirroring the one SQL rule.

---

## 5. Rollout and safety

Four applies, each independently verifiable, with no window of over- or under-exposure:

1. **Apply 1 (additive, zero risk).** Create `family_members` with its policies and audit trigger, add `families.name`, create the two helper functions. No existing policy references them. Access unchanged.
2. **Backfill and verify.** Run Steps B and C, then V1–V6. Both old paths are still live, so access is still unchanged. Stop here if V6 shows anything unexpected; rollback is `DELETE FROM family_members`.
3. **Apply 2 (the swap).** Drop and recreate the nine policies above and rewrite `can_access_family_thread`, `user_can_access_family`, `user_can_view_recipient` — all in one transactional migration. One migration is what prevents a mixed window where some tables use the new rule and some the old. Because step 2 proved the new rule is a superset of the old (V2/V3), no family loses access at the instant of the swap.
4. **Apply 3 (app code).** Reads are safe either side of the swap since RLS is the real gate, but the approval-flow write must ship after the swap so new members land in the table the policies actually read.
5. **Apply 4 (cleanup, days later).** `families.name NOT NULL`; drop `client_family_members`. Only after V6 has been re-run against real post-swap usage.

Before Apply 2, save the current policy bodies so the swap is reversible:
`SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname='public';`

Security-advisor re-check required after Apply 1 (new table plus two definer functions: RLS enabled, grants correct, `search_path` pinned) and after Apply 3 (no policy left permissive, no table lost RLS). Re-run the linter after Apply 4, since dropping a table drops its policies.

---

## 6. Effort

| Step | Work | Turns |
|---|---|---|
| Apply 1 | schema + functions + policies on the new table | 1 |
| Backfill + verification | data migration, run V1–V6, review V6 output | 1 |
| Apply 2 | nine-policy swap + three function rewrites | 1 |
| Apply 3 | app changes across ~8 files + shared `family-access.ts` | 2 |
| Apply 4 | cleanup migration | 1 (later) |
| **Total** | | **5–6** |

**Split it — do not do this as one apply.** The value of the split is entirely in step 2: the backfill runs while both old paths are still active, so the V6 diff tells you exactly who gains or loses access before any policy moves. A single combined migration would surface that only after the security boundary had already changed.

**One decision needed before Apply 1:** confirm the `family_test` widening — should Jose Rivera and Maria Amparo Perez really be visible to the `family_test` user, or do they belong to different households whose `family_id` should be corrected first?