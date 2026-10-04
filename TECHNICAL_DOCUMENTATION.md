# Con Cariño PR — Technical Documentation

Caregiving coordination platform for home-care agencies in Puerto Rico: scheduling, GPS-verified visits (EVV), care plans, wellbeing check-ins, incidents/SOS, and messaging between admins, caregivers, and families.

> Schema and RLS sections below were generated from the **live database catalog** (`pg_policies`, `information_schema`, `pg_constraint`) on 2026-10-04, not from migration files. Re-generate after any migration.

---

## 1. Architecture Overview

### Stack
| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 (React 19, SSR) on Vite 7 |
| Runtime | Cloudflare Workers (workerd) — **not Node**; no Node-only APIs server-side |
| Routing | File-based, `src/routes/` (`src/routeTree.gen.ts` is generated — never edit) |
| Data | Supabase (Postgres + Auth + Realtime), project ref `pabngxfbzleheigkejoz` |
| Client state | TanStack Query |
| Styling | Tailwind CSS v4 via `src/styles.css` semantic tokens |
| Charts | recharts, lazy-loaded behind `ClientOnly` + `Suspense` |
| Tests | Vitest (`bunx vitest --run`) — `src/lib/__tests__/workflows.test.ts` |

Security-sensitive packages are pinned (`@tanstack/react-start@1.168.60`, `@tanstack/react-router@1.170.41`, `@tanstack/router-plugin@1.168.42`). Do not bump casually.

### Roles
`app_role` enum in `user_roles`: **admin**, **caregiver**, **family**. A signed-up user with no row sees the "Awaiting role" screen until an admin approves them. Self-selecting `admin` at signup is impossible.

**Patients (care recipients) do not log in.** They exist only as `care_recipients` rows; all access to their data is mediated through the three roles above.

### Directory map
```text
src/
  server.ts                 Edge entry: SSR error normalization + cache/security headers
  start.ts                  Client function middleware (attaches bearer token)
  routes/
    __root.tsx              HTML shell, fonts, bilingual global error boundary
    index.tsx               Public landing page
    auth.tsx, login.tsx, signup.tsx
    app.tsx                 Signed-in shell (sidebar, skip link, landmarks, role gate)
    app/                    index, schedule, visit, clients, clients.$clientId, care-plan,
                            wellbeing, exceptions, incidents, messages, activity, users, deleted
    mcp.ts, [.mcp]/...      MCP agent tool endpoints
  lib/
    use-auth.ts             Session + role (TanStack Query, realtime-refreshed)
    role-gate.tsx           Client-side role guard component
    visit-clock.ts, geo.ts  EVV clock-in/out, GPS capture, Haversine
    offline-queue.ts        localStorage queue for offline visit finish
    pr-time.ts              Puerto Rico wall-clock helpers
    soft-delete.ts          deleted_at helpers
    family-access.ts        Family membership helpers
    recipients.functions.ts Server functions: getRecipientProfile, getRecipientLogs
    users.functions.ts      Admin user/role server functions
    security/access.ts      assertAdmin, assertRecipientAccess, ForbiddenError (403)
    security/pii.ts         maskRecipient + mask helpers
    security/validation.ts  Zod schemas + sanitizeText, birthdateSchema, checkUploadSize
  integrations/supabase/    client.ts (browser), client.server.ts (admin), auth-middleware.ts
```

### Core conventions
- **Time:** Shift times are Puerto Rico wall-clock (UTC-4, no DST). Convert via `src/lib/pr-time.ts`; the schedule shows PR time plus the viewer's local time.
- **Soft delete:** Rows are never hard-deleted; queries filter `deleted_at IS NULL`. Admins restore from `/app/deleted`.
- **EVV:** Clock-in is online-only and server-stamped via the `clock_in_visit` RPC (distance vs. `geofence_radius_m`, default 150 m). Out-of-range or missing home coordinates record `evv_exception` instead of blocking. Visit finish (wellbeing + clock-out) captures time/GPS on-device and queues to `localStorage` (`ccpr-offline-queue-v1`) when offline, replaying on reconnect.
- **Defense in depth:** RLS is the primary gate. Server functions add `assertRecipientAccess` / `assertAdmin` (logs denials to `security_events`) and `maskRecipient` on output.
- **Edge headers (`src/server.ts`):** `/app`, `/_serverFn`, `/api`, `/dashboard`, `/mcp` → `Cache-Control: no-store …`; `/assets/*` → `public, max-age=31536000, immutable`; HTML default `no-store`. All responses: `nosniff`, `X-Frame-Options: DENY`, strict referrer, `Permissions-Policy: geolocation=(self)`.

---

## 2. Database Schema

### Tables
| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One per auth user | id (= auth.users.id), full_name, phone, avatar_url, preferred_language |
| `user_roles` | Role assignment | user_id, role (`app_role`) |
| `subscription_tiers` | Service plans | name, hours_per_week, monthly_price |
| `families` | Household account | profile_id (owner), subscription_tier_id, status, name |
| `family_members` | Users linked to a household | family_id, user_id, relationship |
| `care_recipients` | Patients | family_id, full_name, address/city/municipality/zip, date_of_birth, emergency contact fields, notes, home_lat/lng, geofence_radius_m, soft-delete cols |
| `caregivers` | Caregiver staff record | profile_id, background_check_status/date, bio, active |
| `care_shifts` | Scheduled visits | care_recipient_id, caregiver_id, scheduled_date, start/end time (PR wall-clock), status, notes |
| `visit_logs` | Actual visits (EVV) | shift_id, caregiver_id, care_recipient_id, clock_in/out + lat/lng/accuracy, methods, location_verified, evv_exception, mood, notes, visit_date |
| `wellbeing_entries` | Daily check-in per visit | visit_log_id, medicine_taken, food_appetite, meals, movement_assisted, hygiene flags, mood_scale, mood_tags, notes |
| `care_plan_items` | Tasks per recipient (meds live here — no prescription table) | care_recipient_id, task_description, category, frequency, active |
| `care_plan_completions` | Task done during a visit | care_plan_item_id, visit_log_id, completed, notes |
| `emergency_contacts` | Contacts per recipient | care_recipient_id, full_name, relationship, phones, email, is_primary, sort_order |
| `incident_reports` | Incidents + SOS | care_recipient_id, visit_log_id, reported_by, reporter_role, incident_type, severity, status, occurred_at, description, resolution fields |
| `family_messages` | Family ↔ admin thread | family_id, sender_profile_id, content, read_at |
| `caregiver_messages` | Caregiver ↔ admin thread | caregiver_profile_id, sender_profile_id, content, read_at |
| `messages` | Legacy direct messages | sender_id, recipient_id, body, read_at |
| `audit_log` | Row change history | actor_id, action, table_name, row_id, before, after |
| `security_events` | Denied-access trail (403s) | actor_id, event, resource_type, resource_id, details |

### Relationships
```text
auth.users ─┬─ profiles (1:1)
            ├─ user_roles
            ├─ family_members.user_id
            └─ messages.sender_id / recipient_id

subscription_tiers ─< families ─┬─< family_members
profiles ─< families.profile_id ├─< care_recipients ─┬─< care_shifts >─ caregivers >─ profiles
                                └─< family_messages  ├─< visit_logs ──┬─< wellbeing_entries
                                                     │   (shift_id → care_shifts)
                                                     │                 ├─< care_plan_completions
                                                     │                 └─< incident_reports.visit_log_id
                                                     ├─< care_plan_items ─< care_plan_completions
                                                     ├─< emergency_contacts
                                                     └─< incident_reports
profiles ─< caregiver_messages (caregiver_profile_id, sender_profile_id)
```
`visit_logs.caregiver_id` references a **profile/auth user id**, while `care_shifts.caregiver_id` references **`caregivers.id`**. Don't mix them.

### Helper functions (SECURITY DEFINER, used by RLS)
| Function | Returns |
|---|---|
| `has_role(uid, role)` | user holds role |
| `current_user_role()` | caller's role |
| `is_caregiver_self(caregiver_id, uid)` | caregivers row belongs to uid |
| `caregiver_has_shift_with_recipient(uid, recipient)` | uid has a shift with recipient |
| `user_in_family(uid, family)` / `user_in_family_of_recipient(uid, recipient)` | family membership |
| `user_can_view_recipient(uid, recipient)` | admin OR family OR assigned caregiver |
| `user_can_access_family(uid, family)` / `can_access_family_thread(uid, family)` | family thread access |
| `profiles_share_care_circle(a, b)` | two users share a recipient |
| `recipient_access_level(recipient)` | `'admin' \| 'family' \| 'caregiver' \| null` |
| `log_security_event(event, type, id, details)` | inserts into security_events as `auth.uid()` (cannot spoof) |
| `clock_in_visit(...)` | server-stamped EVV clock-in |
| `meters_between(lat1,lng1,lat2,lng2)` | Haversine distance |

### RLS policies (live)
All policies apply to role `authenticated`; `anon` has no access. "Admin all" = `FOR ALL USING/WITH CHECK has_role(auth.uid(),'admin')` and exists on every operational table.

| Table | Admin | Caregiver | Family |
|---|---|---|---|
| `profiles` | read all, update any | read self + care circle; insert/update self | read self + care circle; insert/update self |
| `user_roles` | manage all | read own | read own |
| `subscription_tiers` | manage | read all | read all |
| `families` | all | — | read where `profile_id = uid` |
| `family_members` | all | — | read own rows |
| `care_recipients` | all | **read** only if `caregiver_has_shift_with_recipient` | **read** if `user_in_family(family_id)` |
| `caregivers` | all | read/update self | read caregivers with shifts for their recipients |
| `care_shifts` | all | read/update own (`is_caregiver_self`) | **read** for their recipient |
| `visit_logs` | all | ALL where `caregiver_id = uid` | **read** for their recipient |
| `wellbeing_entries` | all | insert/read/update on own visits | **read** for their recipient |
| `care_plan_items` | all | read via `user_can_view_recipient` | read via `user_can_view_recipient` (**no write**) |
| `care_plan_completions` | (via view) read | ALL on own visits | read via recipient |
| `emergency_contacts` | all | read if on shift with recipient | read for their recipient |
| `incident_reports` | all | insert (as self) + read if on shift with recipient | insert (as self) + read for their recipient |
| `family_messages` | read/post/update | — | read/post in own family thread; update own messages |
| `caregiver_messages` | read/post/update | read/post in own thread; update own | — |
| `messages` | read all | participant read; sender insert; recipient update | same |
| `audit_log` | read | — | — |
| `security_events` | read | — | — |

Notable guarantees:
- Families **cannot modify** care plans, medication tasks, visit logs, or wellbeing data (no write policies → Postgres denies).
- Only the caregiver who logged a visit (or an admin) can change it; the former broad `FOR ALL` policy on `visit_logs` was removed.
- Caregivers see a recipient only while they have a shift with them. Server-side masking further hides address/emergency phone unless on shift today, shows DOB year only, and hides notes.

Known gap to review: `vl caregiver own` checks only `caregiver_id = auth.uid()` on insert, not that the caregiver is assigned to `care_recipient_id`. Normal clock-in goes through `clock_in_visit`, but a direct insert is not shift-checked.

---

## 3. WCAG 2.1 AA Accessibility Features

Global baseline lives in `src/styles.css` (one place for every page).

| Area | Implementation |
|---|---|
| Typography | Body 18px, Atkinson Hyperlegible (body) + Inter; Lora/DM Sans on landing. Layout safe at 200% zoom. |
| Contrast | Darkened semantic tokens: ≥4.5:1 text, ~7:1 headings. No hardcoded colors in components. |
| Touch targets | ≥48×48px on buttons, links, checkboxes, radios, bottom bar. Dense grids opt out via `role="grid"` or `data-compact`. |
| Focus | `focus-visible` outline-2 / offset-2 rings everywhere. |
| Motion | `prefers-reduced-motion` disables scroll animations. |
| Landmarks | `app.tsx`: skip-to-content link, `<aside aria-label="Sidebar">`, `<nav aria-label="Main">` with `aria-current`, `<main id="main-content" tabIndex={-1}>`, footer. |
| Live regions | Unreviewed-incident count announced via `aria-live="polite"`; loading states `role="status"`; SOS status `aria-live="assertive"`, confirmation `role="alertdialog"`; global error page `role="alert"`. |
| Forms | Per-field errors with `aria-invalid`, `aria-describedby`, `role="alert"` (care-recipient form). Labels wrap inputs. |
| Choices | Visit check-in choices are a `radiogroup` with arrow-key navigation. |
| Calendar | Admin shift calendar has ARIA roles, keyboard navigation, focus management. |
| Dialogs | Add-recipient dialog: `aria-haspopup="dialog"`, focuses first field, Escape closes. Toggles use `aria-expanded`. |
| Responsive | Wide tables render as cards below `md`, tables at `md+`. |
| Performance | recharts lazy-loaded; `font-display: swap`. |
| Language | EN/ES toggle; error page bilingual. |

Open items: incidents, shifts, and care-plan forms still show toast-style errors rather than per-field errors.

---

## 4. Troubleshooting Guide

### 4.1 Authentication state
**Flow:**
1. Supabase Auth (email/password) stores the session in the browser via `src/integrations/supabase/client.ts`.
2. `src/lib/use-auth.ts` exposes session/user and fetches the role into TanStack Query key `["current-user-role", uid]`.
3. A realtime listener on `user_roles` invalidates that key, so role changes made by an admin apply without reload.
4. `src/routes/app.tsx` + `role-gate.tsx` guard pages client-side (no role → Awaiting Role screen; wrong role → redirect).
5. `src/start.ts` function middleware attaches `Authorization: Bearer <access_token>` to every server function call; `requireSupabaseAuth` verifies it server-side.

| Symptom | Likely cause / fix |
|---|---|
| Stuck on "Awaiting role" | No `user_roles` row. Admin assigns one in `/app/users`. |
| Role change not visible | Realtime disconnected; check `user_roles` is in `supabase_realtime` publication, or reload. |
| Brief flash of wrong page | Guards are client-side (beforeLoad guards deferred). Expected; data stays protected by RLS. |
| Server function returns 401 | Bearer token missing — check `src/start.ts` middleware is intact and the user is signed in. |
| `Expected 3 parts in JWT` | A hand-rolled client used an `sb_publishable_`/`sb_secret_` key as a JWT. Use the generated clients. |
| Empty lists, no error | RLS filtered the rows. Verify the user's role and family/shift linkage; not a bug in the query. |

### 4.2 Server functions & API routes
- App logic uses `createServerFn` (e.g. `src/lib/recipients.functions.ts`). Authenticated ones use `.middleware([requireSupabaseAuth])` and query through `context.supabase` (RLS applies as the user).
- Recipient access: call `assertRecipientAccess(context.supabase, recipientId)` → uses `recipient_access_level()`; on null it calls `log_security_event` and throws `ForbiddenError` (HTTP 403).
- Output recipient data through `maskRecipient(row, level, { onShiftToday })`. Validate inputs with schemas in `security/validation.ts`.
- Admin client (`client.server.ts`) bypasses RLS: import it dynamically **inside** a handler, only after verifying the caller.
- External/webhook endpoints belong under `src/routes/api/public/*` and must verify the caller themselves (this prefix bypasses auth). None exist today.
- MCP endpoints: `src/routes/mcp.ts`, `src/routes/[.mcp]/...`, tools in `src/lib/mcp/tools/`.
- Never call an auth-protected server function from a public route loader — SSR has no bearer token.

| Symptom | Fix |
|---|---|
| 403 from a server function | Expected denial. Inspect `select * from security_events order by created_at desc` as admin. |
| Works in preview, fails after publish | Node-only API used server-side; Workers runtime lacks it. |
| `process.env.X` undefined | Read env inside the handler, not at module top level; browser code uses `import.meta.env.VITE_*`. |
| Hydration mismatch | Browser storage/`window` read during render; move to `useEffect`. |
| Stale data after mutation | Invalidate the relevant query key (e.g. `["incidents"]`). |

### 4.3 EVV / offline
- Inspect queue: DevTools → Application → Local Storage → `ccpr-offline-queue-v1`.
- Queue flushes automatically on reconnect and when `/app/visit` loads.
- `no_home_set` exceptions mean the recipient lacks `home_lat/home_lng`; set them on the client detail page.
- GPS denied: browser permission; `Permissions-Policy` allows geolocation only on same origin.

### 4.4 Useful commands
```bash
npx tsgo --noEmit          # typecheck
bunx vitest --run          # tests
./scripts/pre-cutover-backup.sh   # PROD_DATABASE_URL required; snapshot before DNS cutover
```
Production secrets template: `.env.production.example`.
