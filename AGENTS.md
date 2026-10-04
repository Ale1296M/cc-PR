<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The current user's role is cached in TanStack Query (`current-user-role`) and refreshed by a realtime listener on user_roles — so admin role changes apply without reloads.
- Caregiver visit finish (wellbeing + clock-out) captures time/GPS on-device and queues to localStorage when offline; clock-in stays online-only because the server stamps and verifies it.
- Shift times are stored as Puerto Rico wall-clock (UTC-4, no DST); convert for viewers via src/lib/pr-time.ts.
