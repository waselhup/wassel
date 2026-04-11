# Wassel (وصّل) — Project Identity

## Live URLs
- Production: https://wassel-alpha.vercel.app
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
- Fonts: Cairo (Arabic) + Inter (English)
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
1. npx esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js
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

## Current Status (Updated 2026-04-11)
Working: Dashboard, Auth, DashboardLayout (fresh token/plan from Supabase)
Working: LinkedIn Analyzer (analyze button, auto-fill, progress bar, history, results)
Working: CV Tailor (form-based input, context sent to Claude, results display)
Working: Campaigns (list, create 5-step flow, AI message preview, inline editing, launch)
Working: Token balance and plan display on ALL pages (direct Supabase fetch)
Pending: Moyasar payment integration
Pending: Early Access / Pricing page
Pending: Privacy Policy / ToS pages
Pending: Analytics Dashboard