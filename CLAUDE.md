# Wassel (وصل) — Project Identity

## Live URLs
- Production: https://wasselhub.com
- GitHub: https://github.com/waselhup/wassel
- Local: C:\Users\WIN11-24H2GPT\Desktop\wassel-v2

## Stack
- Frontend: React 19 + Vite 7 + Wouter + Tailwind + Framer Motion
- Backend: Express + tRPC on Vercel Serverless
- Database: Supabase PostgreSQL + RLS
- Auth: Supabase Auth
- AI: Anthropic Claude API (claude-sonnet-4-6 for campaigns/CV, claude-haiku-4-5-20251001 for LinkedIn)
- Prospect Scraping: Apify (harvestapi/linkedin-profile-search) — NEVER say "Apify" in UI
- Payments: Moyasar (pending registration)
- Fonts: Thmanyah Sans (bilingual Arabic+Latin, self-hosted woff2) + JetBrains Mono (code)
- i18n: react-i18next, AR + EN
## Credentials (never commit to public repo)
SUPABASE_URL=https://hiqotmimlgsrsnovtopd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0ODA4NywiZXhwIjoyMDg3NzI0MDg3fQ.8FrY-dp6uBa7-UkkXybJyNi_7y4irhrThTR33VFDtAA
VITE_SUPABASE_URL=https://hiqotmimlgsrsnovtopd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcW90bWltbGdzcnNub3Z0b3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDgwODcsImV4cCI6MjA4NzcyNDA4N30.jy0blU9Ph4BDmKRxVRP10yUdXKaqBbxI4kpr5SOA9yU
APIFY_TOKEN=apify_api_CWdZMugTbgkgRByDMhsYDTAmCzez3g4EZ4S9
VERCEL_TOKEN=vcp_7FfzSQ0DubMJTD63JYgUCOYC9CZoGsnLbrinmsE8iy0hjW4ah73Kwcd2
VERCEL_TEAM=team_2tP8mn672ZnaOchbse2uKBT7
VERCEL_PROJECT=prj_msTtD1ckLs0lyMtFrtPBhhfRPdUz
ANTHROPIC_API_KEY= (set in Vercel env — do not hardcode)
## Critical Paths
- Frontend pages: client/src/pages/
- Components: client/src/components/
- Server routes: server/_core/routes/
- API entry: server/_core/vercel.ts → MUST rebuild to api/index.js after any change
- Translations: client/public/locales/ar/translation.json + en/translation.json
- Supabase client (frontend): client/src/lib/supabase.ts
- Auth context: client/src/contexts/AuthContext.tsx

## Build & Deploy (ALWAYS in this order)
1. npx esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js --external:@napi-rs/canvas --external:@napi-rs/canvas-win32-x64-msvc --external:@napi-rs/canvas-darwin-x64 --external:@napi-rs/canvas-darwin-arm64 --external:@napi-rs/canvas-linux-x64-gnu --external:@napi-rs/canvas-linux-arm64-gnu
   (canvas externals required — its .node native binaries can't be bundled by esbuild)
2. .\ship_it.bat

## Non-negotiable Rules
1. NEVER change SUPABASE_URL to any other project
2. NEVER manually edit api/index.js — always rebuild via esbuild
3. NEVER mention "Apify" or "Waalaxy" in any UI text
4. ALL new UI text must have AR + EN translation keys
5. RTL layout must work for all Arabic content
6. Numbers always in Western digits (0-9)
7. Ask Ali before any destructive DB operation
## Test Account
Email: almodhih.1995@gmail.com
Token balance: 1000
Plan: pro

## Tools Connected to This Project
| Tool | Purpose |
|------|---------|
| Supabase (hiqotmimlgsrsnovtopd) | Database + Auth |
| Vercel (wassel-alpha.vercel.app) | Hosting + Serverless |
| GitHub (waselhup/wassel) | Version control |
| Anthropic Claude API | AI message generation + LinkedIn analysis |
| Apify (harvestapi actor) | LinkedIn profile scraping |
| Moyasar | Payments (pending) |
| PostHog | Analytics (installed) |
| Sentry | Error tracking (installed) |

## tRPC Client Pattern (CRITICAL - do NOT use .mutate()/.query())
The client uses a CUSTOM fetch-based wrapper in client/src/lib/trpc.ts.
Calls are direct function invocations - NO .mutate() or .query() suffixes:
- trpc.linkedin.analyze(profileUrl)
- trpc.linkedin.history()
- trpc.cv.generate(fields, context)
- trpc.campaign.previewMessages({...}) / trpc.campaign.create({...})
- trpcQuery("campaign.list") for direct imports

## Token Balance Pattern (CRITICAL)
DashboardLayout.tsx fetches token_balance and plan directly from Supabase
on every navigation (useEffect on [user?.id, location]).
Never rely solely on AuthContext profile - it can be stale.

## Current Status (Updated 2026-04-11 14:00 AST)
Working: Dashboard, Auth, DashboardLayout (fresh token/plan from Supabase, no flicker)
Working: LinkedIn Analyzer (URL validator accepts all formats, auto-fill, progress bar, save to KB)
Working: CV Tailor (form-based input, context to Claude, 60s timeout, error display)
Working: Campaigns (list, create 5-step flow, AI preview with 45s timeout, retry on error)
Working: Token balance and plan display on ALL pages (direct Supabase, no flicker)
Working: Knowledge Base page (/app/knowledge) with NotebookLM export
Working: Lazy loading for all dashboard pages (React.Suspense)
Working: Smooth nav transitions (transition-all duration-150)
Pending: Moyasar payment integration
Pending: Early Access / Pricing page
Pending: Privacy Policy / ToS pages
Pending: Analytics Dashboard

## NotebookLM Integration
- Page: /app/knowledge (KnowledgeBase.tsx)
- Server: knowledge router (list, save, delete, export)
- DB: knowledge_items table with RLS
- Export: JSON file with LinkedIn analyses, campaigns, CV versions, market tips
- Save from LinkedIn Analyzer: "Save to Knowledge Base" button after analysis
- Skill docs: skills/notebooklm/SKILL.md

## Last Deploy
Commit: 9c0be47 - feat: Knowledge Base page with NotebookLM export integration
Pushed to master at 2026-04-11. Vercel auto-deploys.

## Next Steps
1. Moyasar payment integration (Saudi-compatible)
2. Early Access / Pricing page
3. Privacy Policy / ToS pages
4. Analytics Dashboard

## LESSONS LEARNED (update after every mistake)

1. **BOM breaks builds** — Desktop Commander write_file injects BOMs; always use Node fs.writeFileSync 'utf8' or PowerShell WriteAllText. PostToolUse hook now auto-strips BOMs.

2. **api/index.js must rebuild after ANY server/_core/* change** — stale bundles cause "why isn't my fix live?" confusion. PostToolUse hook now auto-rebuilds.

3. **Vercel cancels parallel deploys** — running multiple Claude Code sessions pushing to master simultaneously = all but one get CANCELED. Use separate git checkouts, coordinate pushes.

4. **"Ready" in Vercel UI can be a stale Redeploy** — always verify by commit hash, not by status color. verify-app subagent checks this now.

5. **DB schema can drift from code silently** — tRPC errors look like API bugs but the root cause may be missing tables/columns. Verify schema with Supabase MCP before any DB-dependent feature work.

6. **Mock data in admin pages is deceptive** — AdminUsers.tsx uses hardcoded users array; wire to real admin.listUsers tRPC before claiming admin panel "works".

7. **Don't mention Apify, Waalaxy, or LinkedIn automation in UI** — Wassel is a legal/compliant career platform for professionals in the Saudi/GCC market and the broader region. The word is "اكتشاف" (discovery), never "scraping".

8. **Plan Mode first for non-trivial tasks** — no writing code before plan is approved.

9. **Secrets never go in CLAUDE.md or any tracked file** — even in private repos. Credentials live in Vercel env vars (prod) or PowerShell env vars (local verify-app). If you need VERCEL_TOKEN for verify-app check 3, Ali sets it via:
   `[Environment]::SetEnvironmentVariable("VERCEL_TOKEN", "vcp_...", "User")`
   Never paste tokens into repo files.

## THREE CORE PRINCIPLES (Boris Cherny)

1. **Simple** — Prefer deleting lines over adding them. Minimal code.
2. **Root cause** — No band-aid fixes. Dig until you find the real cause.
3. **Minimal touch** — Only change what's necessary. No side effects.

---

## Career Copilot Transformation (branch `feat/career-copilot-transformation`)

Wassel is becoming a Career Copilot, not a portfolio of tools. The transformation is documented in `docs/`:

- `docs/MASTER-BRIEF.md` — corrected canonical brief (replaces older drafts)
- `docs/golden-rules.md` — the 22 product rules
- `docs/ban-list.md` — what we never ship or say
- `docs/career-copilot-brain.md` — the in-app AI brain architecture
- `docs/language-rules.md` — AR primary, EN secondary, Western digits, tone
- `docs/decisions/A01.md` … `A22.md` — 22 architectural decisions
- `docs/PRD/01-vision.md` … `06-errors-roadmap.md` — product specs per sprint
- `docs/prompts/*.md` — prompt source files compiled into `_generated.ts`

### The Backbone

`career_profile` is one row per user (goal / level / target_role / industry / primary_language). Every screen reads it. Settings → Career Profile is the only place it changes. Temporary "act as if" experiments go to `section_overrides` (decay in 24h).

**Mother Rule:** The user is never asked the same question twice.

### The 3-Wallet System

Replaces single `profiles.token_balance` with three wallets:
1. `wallet_bonus` — promos, refunds, Explore plan (90-day expiry). Consumed 1st.
2. `wallet_subscription` — monthly plan tokens (monthly expiry). Consumed 2nd.
3. `wallet_topup` — paid top-ups (lifetime). Consumed 3rd.

New RPC: `deduct_tokens_v2(user_id, amount, operation, metadata)`. Runs in parallel with legacy `deduct_tokens_atomic` (per A22 / Q4 of Sprint 1 pre-flight). Sprint 7 unifies. **Do not delete `deduct_tokens_atomic` before Sprint 7.**

Helpers: `server/_core/lib/wallets.ts` (read + deduct + credit) and `server/_core/lib/career-profile.ts` (read/write profile + overrides + PDPL export/delete).

### Prompt Pipeline

Prompts live in `docs/prompts/*.md` as fenced blocks (system / user / schema). `scripts/build-prompts.ts` compiles them into `server/_core/prompts/_generated.ts`. Run with `npm run build:prompts`. Routers consume `_generated.ts`; never write inline strings for Claude calls.

### Onboarding

- `/v2/onboarding` is the 4-step wizard (Goal / Level / Identity / LinkedIn).
- `AuthGate` redirects authenticated users with `career_profile == null` to `/v2/onboarding` (skipping Settings / Privacy / Billing / Onboarding-internal routes to avoid loops).
- Settings → Career Profile (`/v2/settings/career`) edits the profile.
- Settings → Privacy & Data (`/v2/settings/privacy`) exposes PDPL export + delete-all.

### Parallel-session Safety (CRITICAL)

A second Claude Code session is building **AI Workforce** (agents + portals) in parallel. **Career Copilot must NOT touch** any file listed in `docs/decisions/A22.md`. Managed exceptions:
- `client/public/locales/{ar,en}/translation.json` — additive only, under namespaces `onboarding.*`, `careerProfile.*`, `wallets.*`, `privacy.*`, `radar.*`, `resume.*`, `content.*`, `dashboard.*`, `errors.*`, `settings.*`.
- `package.json` — additive deps via `npm install` only.
- `server/_core/trpc.ts` — Career Copilot adds **one** import line and **one** router-registration line. Nothing else.
- `CLAUDE.md` — Career Copilot appends only (this very section).
- `vercel.json` — Career Copilot does NOT touch.

### Sprint Status (this branch)

- Sprint 1 (Foundation): docs + schema + 3-wallet + prompt build pipeline — **done**
- Sprint 2 (Onboarding + Profile management): wizard + careerProfile router + settings — **done**
- Sprint 3–8: documented as roadmap in `docs/PRD/`, executed in future branches
