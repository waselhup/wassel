# Wassel — API Keys & Environment Variables

All keys live in **Vercel → Project Settings → Environment Variables** (Production scope).
Never commit to git. Rotate every 90 days.

## Required (production blocks without these)

| # | Service | Env Var | Purpose | Where to Get | Free Tier | Est. Cost (SAR/mo) |
|---|---|---|---|---|---|---|
| 1 | Supabase | `SUPABASE_URL` | DB connection | https://app.supabase.com → Project Settings → API | ✅ 500MB | 95 (Pro) |
| 2 | Supabase | `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin | Same panel — service_role tab | — | included |
| 3 | Supabase | `SUPABASE_ANON_KEY` | Client-side | Same panel — anon tab | — | included |
| 4 | Anthropic | `ANTHROPIC_API_KEY` | Claude AI for messages, scoring, CV | https://console.anthropic.com → API Keys | $5 trial | 500–1500 |
| 5 | Apify | `APIFY_TOKEN` | LinkedIn prospect discovery + email finder | https://console.apify.com → Settings → Integrations | $5/mo free credits | 300–800 |
| 6 | Vercel | `VERCEL_TOKEN` | CLI deploys from CI | https://vercel.com/account/tokens | ✅ Hobby | 75 (Pro) |

## Recommended (unlocks features)

| # | Service | Env Var | Purpose | Where to Get | Free Tier | Est. Cost (SAR/mo) |
|---|---|---|---|---|---|---|
| 7 | Resend | `RESEND_API_KEY` | Transactional email (signup, drip) | https://resend.com → API Keys | 100/day | 75 |
| 8 | Moyasar | `MOYASAR_SECRET_KEY` | Saudi-compatible payments | https://moyasar.com → Dashboard → Settings | — | 2.75% per txn |
| 9 | Moyasar | `MOYASAR_PUBLIC_KEY` | Client-side checkout | Same panel | — | included |
| 10 | OpenAI (fallback) | `OPENAI_API_KEY` | Optional fallback when Anthropic down | https://platform.openai.com/api-keys | $5 trial | 0–200 |
| 11 | Sentry | `SENTRY_DSN` | Error tracking | https://sentry.io → Project Settings → Client Keys | ✅ 5K events | 0 |
| 12 | PostHog | `POSTHOG_API_KEY` | Product analytics | https://app.posthog.com → Project Settings | ✅ 1M events | 0 |

## Saudi-Specific

| # | Service | Env Var | Purpose | Where to Get | Notes |
|---|---|---|---|---|---|
| 13 | Tap Payments (alt) | `TAP_SECRET_KEY` | Backup KSA payment | https://www.tap.company → Dashboard | Fallback to Moyasar |
| 14 | ZATCA | `ZATCA_VAT_NUMBER` | E-invoicing compliance | https://zatca.gov.sa | Required > 375K SAR/yr |

## Setup Order
1. Supabase → create project → copy 3 keys
2. Anthropic → create key → set monthly budget cap to 1500 SAR (~400 USD)
3. Apify → get token → set spending limit
4. Vercel → add all envs to Production scope → redeploy
5. Resend → verify domain (DKIM + SPF)
6. Moyasar → submit commercial registration → wait for approval (2–5 days)

## Verification
After setting envs, run:
```bash
curl https://wassel-alpha.vercel.app/api/health
# Should return: {"status":"ok","version":"2.0.0"}
```

## Total Monthly Cost (live)
**~1,250–2,800 SAR/mo** depending on AI + Apify usage. Stays under 4K SAR target.
