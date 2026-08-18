# Full app internationalization (English + Spanish)

## Summary

Add a real i18n layer to Con Cariño PR so every screen renders in the user's chosen language. Language is picked as the first step of signup, saved to `profiles.preferred_language`, and applied app-wide from then on. Logged-out visitors get a language from browser/localStorage. A toggle lets anyone switch at any time, instantly, with no page reload.

## 1. Library choice

**react-i18next + i18next**, with `initReactI18next` and bundled JSON resources (no HTTP backend, no language detector plugin).

Why:
- Mature, tiny per-component API (`const { t } = useTranslation()`), interpolation, plurals, namespaces.
- Resources bundled at build time means SSR has no async load step — the biggest source of hydration flicker disappears.
- shadcn/Tailwind agnostic; nothing about the design system changes.

Rejected: Lingui (needs a macro/compile step that fights the Vite+Start setup); a custom context (we'd reimplement plurals, interpolation, and fallbacks by hand).

### SSR hydration handling (TanStack Start)

The rule: the server render and the first client render must use the *same* language string.

- i18n instance is created synchronously at module load with both `en` and `es` resources already in memory and `lng` defaulting to `en` (never `undefined`).
- No `localStorage`/`navigator` reads during module init or render. The stored/browser preference is applied in a `useEffect` in the provider (post-hydration), so the first client paint matches SSR, then swaps.
- To avoid a visible English flash for Spanish users on public pages, the resolved language is also written to a cookie (`cc-lang`). The root route reads that cookie server-side (`getRequest()` inside the root loader / a server fn) and passes it as the initial language, so SSR already emits Spanish. Cookie + effect stay in sync.
- `<html lang>` is set from the same resolved value in `__root.tsx`.
- Authenticated screens are client-fetched anyway, so profile-driven language never affects SSR markup.

## 2. Language resolution and reactivity

Priority order, highest first:
1. `profiles.preferred_language` (once the session + profile load)
2. `cc-lang` cookie / localStorage (set by any prior choice, including the signup step)
3. `navigator.language` starts with `es` → `es`
4. `en`

Mechanics:
- New `src/lib/i18n.ts` — creates and exports the configured i18next instance.
- New `src/lib/language-provider.tsx` — mounts `I18nextProvider` in `__root.tsx`, exposes `useLanguage()` returning `{ lang, setLang }`. `setLang` calls `i18n.changeLanguage()` (re-renders every subscribed component immediately, no reload), writes cookie + localStorage, and — if a session exists — persists to `profiles.preferred_language` via a small update.
- Logged out: steps 2–4 above cover it; signup and login are fully translated before any profile exists.
- Signup: the wizard's new Step 1 calls `setLang()` right away so the rest of the wizard is already translated; the value is included in the `profiles` upsert the wizard already performs (`auth.tsx` already writes `preferred_language`, so this reuses an existing path).
- Login/return: `useAuth` gains a `preferredLanguage` read from `profiles`; the provider applies it when it arrives (skipped if the user manually toggled during the session).

## 3. Translation file structure

```text
src/locales/
  en/  common.json  auth.json  nav.json  home.json  schedule.json
       clients.json  careplan.json  wellbeing.json  incidents.json
       messages.json  users.json  admin.json  enums.json
  es/  (same filenames)
```

Key convention: `namespace:section.element` in lowerCamel, describing role not English text — `schedule:filters.statusLabel`, `careplan:dialog.deleteConfirmBody`, `common:actions.save`. Shared verbs (Save, Cancel, Delete, Retry, Loading, empty-state copy) live only in `common.json`. Interpolation uses named vars (`wellbeing:trend.summary` → `"{{count}} visits in the last {{days}} days"`), never string concatenation.

## 4. Inventory and phases

Measured from the codebase (excluding `src/components/ui/*` primitives, which carry almost no copy — only a handful of aria-labels in `sidebar.tsx`, `pagination.tsx`, `carousel.tsx`):

- ~30 files with real user-facing copy.
- Heaviest: `app/wellbeing.tsx`, `app/care-plan.tsx`, `app/visit.tsx`, `app/index.tsx`, `SignupWizard.tsx`, `routes/index.tsx` (landing), `app/incidents.tsx`, `app/clients.$clientId.tsx`, `EmergencyContacts.tsx`, `app/messages.tsx`, `app/activity.tsx`, `AdminShiftCalendar.tsx`, `ShiftDialog.tsx`.
- Estimated **650–850 distinct strings** total (labels, headings, buttons, placeholders, toasts, empty/error states, aria-labels, enum labels).

Scope call: **`src/routes/dashboard/*` (admin/caregiver/family mock screens) is OUT of scope** — they run on `src/lib/mock/dashboard-data.ts` and are superseded by `/app/*`. Recommend deleting them separately rather than translating them. If you want them kept and translated, add ~90 strings / ~1 extra turn.

Phases:
- **Phase 1 — Foundation.** i18n instance, provider, cookie/SSR wiring, `useLanguage`, `common.json` + `enums.json` scaffolding, signup Step 1 language picker, persistence to `profiles.preferred_language`, `useAuth` reads preference, header/menu toggle.
- **Phase 2 — Public + auth.** Landing (`routes/index.tsx`, replacing its ad-hoc `COPY` object and local `LangToggle` with the real system), `login.tsx`, `auth.tsx`, rest of `SignupWizard.tsx`, `ProtectedRoute`/awaiting-role screen.
- **Phase 3 — /app core.** `app.tsx` shell + nav, `app/index.tsx` heroes, `app/visit.tsx`, `app/schedule.tsx` + shift components, `app/wellbeing.tsx`.
- **Phase 4 — Remaining /app.** care-plan, clients + client detail + EmergencyContacts, incidents + dialogs, users, messages, activity, exceptions, deleted, async-state/confirm-action shared copy.
- **Phase 5 — QA sweep.** Grep for leftover literals, Spanish proofread pass, long-string layout check (Spanish runs ~20% longer — verify buttons/sidebar/table headers don't wrap badly), toggle both languages through each role.

## 5. Where the language toggle lives

Three placements, all fed by the same `useLanguage()`:
1. **Signup Step 1** — the primary choice.
2. **Public header** — the existing landing toggle, rewired to the real provider (also visible on login/signup).
3. **New `/app/settings` route** — a small "Account" screen (name, phone, language, sign out), linked from the sidebar footer / avatar area in `app.tsx`. This is the persistent home for logged-in users, since no settings screen exists today. Built in Phase 1 as a minimal page; can grow later.

## 6. Enums and date/time

- New `enums.json` namespace with keys mirroring DB values: `enums:role.admin|caregiver|family_member`, `enums:incidentType.fall|medication_error|...`, `enums:incidentSeverity.*`, `enums:incidentStatus.*`, `enums:shiftStatus.*`, `enums:appetite.good|fair|poor`, `enums:medicine.yes|no|partial`, `enums:visitMethod.*`. Existing label maps (`incident-meta.ts`, `shift-types.ts`) are converted from hardcoded strings to key lookups, so DB values never change.
- Dates: keep `date-fns`, add its `es` locale and a `useDateLocale()` helper so every `format()` call passes `{ locale }`. Weekday/month names in the calendar and wellbeing ribbon come from the same helper.
- Numbers/relative times: `Intl.NumberFormat` / `Intl.RelativeTimeFormat` with the active locale.
- Timezone list (`src/lib/timezones.ts`) stays English-labeled for city names but its relative-time strings get localized.

## 7. Effort estimate

| Phase | Scope | Est. turns |
|---|---|---|
| 1 | Foundation + signup step + persistence + settings/toggle | 2–3 |
| 2 | Public + auth screens (~120 strings) | 1–2 |
| 3 | /app core screens (~250 strings) | 2–3 |
| 4 | Remaining /app screens (~250 strings) | 2–3 |
| 5 | QA sweep, layout fixes, Spanish proofread | 1–2 |
| **Total** | | **8–13 turns** |

**Recommendation: several smaller builds, not one large one.** Reasons: each phase touches many files at once, and a single mega-build risks a broken typecheck across 30 files with no clean rollback point. Phase 1 alone delivers visible value (language picked at signup, persisted, toggleable) and is independently reviewable. Phases 3 and 4 can each be split further per-screen if you'd rather spend credits incrementally.

Also worth deciding before Phase 1: whether to delete `src/routes/dashboard/*` (recommended) — it removes ~90 strings and ~800 lines from the surface area.
