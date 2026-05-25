# Wassel (وصل) — Career Copilot Master Brief

**Document Status:** Authoritative — supersedes any older Master Brief draft.
**Last Updated:** 2026-05-25
**Owner:** Ali (founder).
**Sprint Coverage:** Foundation document for Sprints 1–8. Sprints 1+2 are executed in branch `feat/career-copilot-transformation`. Sprints 3–8 are roadmap.

---

## 1. The Identity Shift

Wassel does NOT build a portfolio of AI tools. Wassel is a **Career Copilot** that leads a working professional in Saudi Arabia and the wider GCC to their next career destination — promotion, new role, personal brand, or career change.

The four pillars:

| Pillar | Role |
| --- | --- |
| **Radar (الرادار)** | Surfaces gaps between the user's current profile and a target role |
| **ATS Resume (السيرة الذاتية)** | Builds the resume *for the chosen target*, ATS-readable and bilingual |
| **Career Content (المحتوى المهني)** | Builds professional presence: posts, carousels, repurposing |
| **Smart Dashboard (Dashboard ذكي)** | Leads the *next* action, never just lists features |

The **backbone** that connects all four pillars: the `career_profile` table — one row per user, the single source of truth for goal, level, target role, industry, language, and intent. Plus `section_overrides` for temporary "act as if" experiments.

**Mother Golden Rule:** The user is never asked the same question twice.

---

## 2. Corrections vs. Earlier Master Brief Drafts

Earlier internal drafts of this brief contained inaccuracies. The corrected canonical values are:

| Earlier draft said | The truth (use this) |
| --- | --- |
| Vendor: Bright Data | **Apify** (`harvestapi/linkedin-profile-search` actor) |
| Build tool: pnpm | **npm** |
| Fonts: Cairo + Inter | **Thmanyah Sans** (bilingual, self-hosted woff2) + JetBrains Mono for code |
| Single model: `claude-sonnet-4-6` | **Two models:** `claude-sonnet-4-6` (Radar, CV, Campaigns) + `claude-haiku-4-5-20251001` (LinkedIn ingest, content posts) |
| Chrome Extension on roadmap | **Removed entirely.** Wassel never ships a browser extension. |
| Vision 2030 references | **Removed.** No external macro narrative attached to the product story. |
| Project directory: unspecified | `C:\Users\WIN11-24H2GPT\Desktop\wassel-v2` |

---

## 3. Stack Snapshot (as of 2026-05-25)

- **Frontend:** React 19 + Vite 7 + Wouter + Tailwind + shadcn/ui + Framer Motion
- **Backend:** Express + tRPC running on Vercel Serverless (single function bundle at `api/index.js`)
- **Database:** Supabase PostgreSQL (project `hiqotmimlgsrsnovtopd`) with RLS everywhere
- **Auth:** Supabase Auth + LinkedIn OAuth
- **AI:** Anthropic Claude (Sonnet 4.6 + Haiku 4.5)
- **Discovery vendor:** Apify (never said in UI — UI word is "اكتشاف" / "discovery")
- **Payments:** Moyasar (Saudi-compatible; integration pending)
- **i18n:** react-i18next, AR primary + EN secondary
- **Fonts:** Thmanyah Sans (UI), JetBrains Mono (code blocks)
- **Numerals:** Always Western digits 0–9 regardless of UI language

---

## 4. The Problem We're Solving

The pre-Copilot version of Wassel has these symptoms:

1. The user feels in front of **separate tools**, not one product
2. Each section **asks the same questions again** (goal, field, target role)
3. There is **no connection** between pillars — analyzing a profile does not pre-fill the resume
4. The Dashboard is a **list of icons**, not a coach — it doesn't lead the next move
5. **Pricing is opaque** — users see a token count without knowing what it buys
6. There is **no real onboarding** — new users land on a feature menu

Career Copilot's success criterion is that all six symptoms disappear.

---

## 5. The Career Profile (Backbone Table)

`career_profile` is one row per user, written once during onboarding and edited from Settings. It carries:

- `goal` — `job_search | promotion | personal_brand | opportunities | career_change`
- `level` — `entry | mid | senior | executive`
- `target_role` — free text (e.g. "Senior Product Designer")
- `industry` — free text (e.g. "Fintech")
- `primary_language` — `ar | en`
- `linkedin_url` — optional; populated by step 4 of onboarding
- `manual_about` / `manual_experience` / `manual_skills` — optional fallback when LinkedIn is skipped
- `created_at` / `updated_at`

`section_overrides` is short-lived: a user can run *one analysis* as if they were targeting a different role without rewriting their profile. Overrides expire on their own (default 24 hours).

---

## 6. The 3-Wallet Token System

Replaces the single `token_balance` column with three wallets and a unified audit trail:

| Wallet | Source | Consumption order | Expires? |
| --- | --- | --- | --- |
| `wallet_bonus` | Free trial, promotional grants, refunds-as-bonus | **1st** | Yes (default 90 days, configurable) |
| `wallet_subscription` | Monthly plan renewal | **2nd** | Yes (each month wipes unused balance) |
| `wallet_topup` | Paid top-up purchases | **3rd** | **No** (lifetime) |

A unified audit trail in `wallet_transactions` records every credit and debit with source wallet, operation, amount, and balance after.

**New RPC** `deduct_tokens_v2(user_id, amount, operation, metadata)` deducts in the order above. The legacy `deduct_tokens_atomic` continues to exist in parallel during Sprint 1+2; both RPCs are unified in Sprint 7 (pricing sprint). This is the canonical answer to a coordination question with the parallel AI Workforce session: both RPCs ship; harmonization is deferred.

**Migration rule for existing users (decided 2026-05-25):**
- All existing `profiles.token_balance` → `wallet_topup` (lifetime, never expires)
- Every existing user receives one additional free "Explore" journey on cutover as a goodwill grant — booked into `wallet_bonus`

---

## 7. Pricing Plans (documented now, applied in Sprint 7)

```
استكشف   (Explore)    | 0 SAR/mo    | 1 full lifetime journey
الانطلاق (Liftoff)    | 149 SAR/mo  | 200 tokens, renews monthly
النمو   (Growth)     | 299 SAR/mo  | 500 tokens, renews monthly
المؤسسات (Enterprise) | custom      | bespoke
```

**Top-ups (lifetime, no expiry):**
```
100 tokens =  79 SAR
250 tokens = 169 SAR
500 tokens = 299 SAR
```

### Token cost catalogue (verify against `system_settings` before quoting publicly):

| Operation | Tokens |
| --- | --- |
| Radar full analysis | 149 |
| Radar — switch target role on existing profile | 149 |
| Resume — full ATS build (first time for a role) | 179 |
| Resume — new version for a different role | 49 |
| LinkedIn post | 5 |
| LinkedIn carousel | 25 |
| Repurpose bundle | 15 |
| Refinement chips (first 5/document) | 0 |
| Radar-included Fixes | 0 |
| Export PDF / DOCX | 0 |
| Cached re-display | 0 |
| Delete | 0 |

If `system_settings` shows different numbers, document the live numbers in `docs/PRD/03-radar.md` and similar, with a "Sprint 7 will adjust to Master Brief targets" note. Never silently mutate live token costs from Sprint 1+2.

---

## 8. Hard Bans

### User-facing (UI strings, error text, marketing copy)

- ❌ "Apify"
- ❌ "Apollo"
- ❌ "Bright Data"
- ❌ "Claude", "GPT", "OpenAI", "Anthropic", or any AI model name
- ❌ "مجاني" — use **"مشمول"** (included)
- ❌ "أتمنى أن تكون بخير" (auto-pleasantries)
- ❌ Eastern-Arabic numerals (٠١٢٣) — always Western (0123)
- ❌ Technical jargon inside error messages
- ❌ Pricing displayed without what-it-buys
- ❌ Text-only empty states ("لا توجد مسودات")
- ❌ Button labelled "إعادة إنشاء" — use **"نسخة جديدة"**
- ❌ Any Vision 2030 reference
- ❌ Fabricated claims or stats
- ❌ Any reference to a Chrome Extension

### Engineering

- ❌ Deducting tokens before confirming the operation succeeded
- ❌ Diagnosing a production bug before reading Vercel logs
- ❌ Forgetting to rebuild `api/index.js` after editing `server/_core/*`
- ❌ Hardcoded strings in UI — always `t('key')`
- ❌ Re-reading LinkedIn for a profile already in cache
- ❌ Wrapping the golden rules in a feature flag — they are constants
- ❌ Writing ad-hoc prompts in code — prompts must come from `server/_core/prompts/_generated.ts`
- ❌ Touching any file in the AI Workforce parallel-session blocklist (see `docs/decisions/A22.md`)

---

## 9. Sprint Roadmap

| Sprint | Scope | Status in this branch |
| --- | --- | --- |
| 1 | Knowledge base + schema + 3-wallet system | **Executed** |
| 2 | Onboarding + Career Profile management | **Executed** |
| 3 | Radar v2 (cached, included-fixes, refinement chips) | Documented as roadmap |
| 4 | ATS Resume v2 | Documented as roadmap |
| 5 | Career Content (post + carousel + repurpose) | Documented as roadmap |
| 6 | Smart Dashboard (Next Task, activity log, AI suggestions) | Documented as roadmap |
| 7 | Pricing alignment + RPC unification + Moyasar | Documented as roadmap |
| 8 | Polish + analytics + error-formatter | Documented as roadmap |

Detailed scopes for Sprints 3–8 live in `docs/PRD/`.

---

## 10. Non-Negotiable Engineering Rules

1. Never change `SUPABASE_URL` to a project other than `hiqotmimlgsrsnovtopd`
2. Never mention Apify / Waalaxy / scraping in UI text — use "اكتشاف" / "discovery"
3. Every new UI string requires AR + EN keys
4. RTL must work — Arabic is the primary direction
5. Numbers always Western digits (0–9)
6. After any change in `server/_core/*`, rebuild `api/index.js` with:
   ```
   npx esbuild server/_core/vercel.ts --platform=node --bundle --format=cjs --outfile=api/index.js --external:@napi-rs/canvas* --external:pdfjs-dist
   ```
7. Never hand-edit `api/index.js`
8. tRPC client pattern is the custom wrapper in `client/src/lib/trpc.ts` — no `.mutate()` / `.query()`
9. Do not break existing portals (Sayed, Faris, Marketing, Finance, Ops, Growth, Workforce, Customer Success, Revenue Lab, Product Intel, Compliance)
10. The transformation branch is `feat/career-copilot-transformation` — never push to `master` until Ali approves
11. WIP commits every 10 completed tasks on the feature branch (no push)
12. Apply destructive DB changes only with Ali's go-ahead

---

## 11. The Mother Golden Rule (restated)

The user is never asked the same question twice.

Every screen that needs goal/level/role/industry/language reads from `career_profile`. If it must temporarily diverge (the user wants to "run the Radar as if I were targeting a Director role"), it writes a `section_override` — never overwrites the canonical profile.

If a screen finds itself wanting to ask the user for one of these fields again, the screen is wrong, not the rule.
