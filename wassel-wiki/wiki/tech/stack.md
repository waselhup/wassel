---
type: decision
updated: 2026-04-18
sources: [CLAUDE.md]
---
# Tech Stack

**TL;DR:** React 19 + Vite 7 SPA on the client, Express + tRPC on Vercel Serverless on the server, Supabase (Postgres + Auth + RLS) as the data layer, Anthropic Claude as the AI brain. Arabic-first, RTL, Cairo + Inter fonts.

## Frontend
- React 19, Vite 7, Wouter (routing), Tailwind, Framer Motion
- i18n: react-i18next (AR + EN) — every new UI string needs both keys
- Supabase client: `client/src/lib/supabase.ts`
- Auth context: `client/src/contexts/AuthContext.tsx`
- Custom tRPC wrapper: `client/src/lib/trpc.ts` — **direct function invocation, no `.mutate()`/`.query()` suffixes**

## Backend
- Express + tRPC on Vercel Serverless
- Entry: `server/_core/vercel.ts` → bundled to `api/index.js` (NEVER edit `api/index.js` by hand; use `scripts/auto-rebuild-api.cjs`)
- Routes: `server/_core/routes/*.ts`

## Data
- Supabase Postgres + RLS (project `hiqotmimlgsrsnovtopd`)
- Knowledge store: `knowledge_items` table with RLS (see [[knowledge-base]])

## AI
- `claude-sonnet-4-6` for [[cv-tailor]] and [[smart-outreach]]
- `claude-haiku-4-5-20251001` for [[profile-analysis]]

## Scraping (internal only — never named in UI)
- Apify `harvestapi/linkedin-profile-search` — see [[recurring-issues]] lesson 7

## Payments
- Moyasar (registration pending)

## Observability
- PostHog (analytics) + Sentry (errors) — installed

## Related
- [[deployment]]
- [[recurring-issues]]
