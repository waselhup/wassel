---
type: decision
updated: 2026-04-18
sources: [client/src/pages/admin/AdminUsers.tsx, server/_core/routes/admin.ts, client/src/lib/trpc.ts]
---
# 2026-04-18 — Admin Users Page Wired to Real Backend

**TL;DR:** Replaced mock data in `/admin/users` with live Supabase-backed tRPC calls so Ali can grant tokens to beta users in one click. Added a markdown grant log that feeds the daily Beta Watchdog.

## Context
Beta launch needs a way to manually grant tokens before [[moyasar-payments]] is wired up. The admin users page was UI-only with hardcoded sample users — no way for Ali to actually give out tokens, ban bad actors, or see who signed up.

## What changed
- `AdminUsers.tsx` rewritten: fetches via `trpc.admin.users({ search })` with 300ms debounce, shows avatar/name/email/plan badge/tokens/status/joined-date rows
- Grant Tokens modal: amount input + preset buttons (100/500/1000/2500) + reason textarea (min 3 chars) → `trpc.admin.addTokens` → toast + refetch
- Ban/unban toggle per row via dropdown menu with confirm dialog
- 4 stat cards driven by `trpc.admin.stats` (total users, active in 7 days, paid users, total tokens granted)
- Safety rail: non-admin landing here gets "غير مصرح" + link back to `/app`
- Full AR + EN i18n under the `au.*` namespace

## Backend endpoints used
- `admin.users` — extended to accept `{ search?, limit? }` input, `ilike` on `email` + `full_name`
- `admin.addTokens` — unchanged signature, but now also appends a line to `wassel-wiki/raw/token-grants/YYYY-MM-DD.md` (non-blocking, fails silently on Vercel's read-only FS)
- `admin.toggleBan` — unchanged, toggles `profiles.is_banned`
- `admin.stats` — unchanged, returns totalUsers/activeUsers/tokensPurchased/mrr

## Commit
`153ed6d` — feat: admin users page wired to real backend + token grant UI

## Why
- Ali needs to grant tokens to beta friends manually — one click, with a reason for audit
- The markdown grant log feeds the daily [[beta-watchdog]] so we can see who got tokens when without having to query the DB
- Search + filter turns the admin page into an actual tool, not a dashboard decoration

## Screenshot
_(placeholder — Ali to drop `/app/admin/users` screenshot here after first grant)_

## Follow-ups
- Wire up a "Recent grants" widget on the admin dashboard that reads the markdown log
- Add pagination once user count > 50 (currently capped at 50)
- Bulk-grant UI for giving tokens to multiple users at once (e.g. "all beta signups this week")
