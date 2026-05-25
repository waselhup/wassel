# Wassel — Hard Bans

Two sets of bans: user-facing (anything the user could read on a screen, error message, email, invoice, export) and engineering (anything in the code or workflow).

A ban here is binding. Lifting one requires a written decision in `docs/decisions/` referencing the rule it overrides.

---

## User-Facing Bans

### Vendor names (never visible)
- ❌ **Apify**
- ❌ **Apollo**
- ❌ **Bright Data**
- ❌ **Waalaxy**
- ❌ Any other scraping or enrichment vendor name

The UI word for the underlying operation is **"اكتشاف"** (discovery) in Arabic and **"discovery"** in English. Never "scraping", "fetching", "crawling".

### AI / model names (never visible)
- ❌ **Claude**
- ❌ **GPT**
- ❌ **OpenAI**
- ❌ **Anthropic**
- ❌ Any model code (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, etc.)
- ❌ Any "powered by" attribution to a foundation model

The UI says "Wassel analyzed your profile" — not "Claude analyzed your profile".

### Linguistic landmines
- ❌ **"مجاني"** (mafrūd: free of charge) — say **"مشمول"** (included)
- ❌ **"أتمنى أن تكون بخير"** — no auto-pleasantries at the top of generated content
- ❌ **"إعادة إنشاء"** as a button — use **"نسخة جديدة"**
- ❌ "Powered by", "Made with", "Built on" + any backend brand

### Numeric / typographic
- ❌ Eastern Arabic numerals: ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩ — always Western 0–9
- ❌ Decorative emojis inside product copy (allowed in marketing pages with restraint, never inside in-app strings)

### Empty / error UX
- ❌ Text-only empty states ("لا توجد عناصر")
- ❌ Technical jargon in error messages ("HTTP 429", "Connection refused", "Timeout")
- ❌ "Try again later" without a "try again" button

### Pricing UX
- ❌ A token count displayed without the deliverable it buys
- ❌ "Pro plan" without the list of what's included

### Macro / political
- ❌ **Vision 2030** references in any copy, marketing, blog, or in-app
- ❌ Any government or royal-court attribution
- ❌ Fabricated statistics ("80 % of recruiters use ATS in the GCC" with no source)

### Surfaces we never ship
- ❌ **Chrome Extension** — not on the roadmap, not in copy, not in pricing pages
- ❌ Native mobile apps — web only for now
- ❌ Desktop installer — web only

---

## Engineering Bans

### Token & money safety
- ❌ Deducting tokens before the operation has succeeded
- ❌ Calling Anthropic with a custom system prompt instead of `_generated.ts`
- ❌ Hardcoding token costs — they live in `system_settings` (or, in Sprint 7+, the pricing table)

### Build & deploy
- ❌ Editing `api/index.js` by hand
- ❌ Forgetting to rebuild `api/index.js` after editing `server/_core/*`
- ❌ Pushing to `master` without a green local typecheck
- ❌ Two simultaneous Vercel pushes from parallel sessions (Vercel cancels parallel deploys)

### Code shape
- ❌ Hardcoded strings in JSX — `t('key')` is the only correct form
- ❌ `.mutate()` / `.query()` on the tRPC client — the wrapper exposes calls as plain functions
- ❌ Reading from `profiles.token_balance` once Sprint 7 ships — read from `wallet_*`
- ❌ Re-scraping a LinkedIn URL already cached for the same user

### Parallel-session safety
- ❌ Touching any file in the AI Workforce blocklist (see `docs/decisions/A22.md`)
- ❌ Reformatting (re-sorting imports, changing quote style) shared files like `server/_core/trpc.ts` or `client/public/locales/*/translation.json` — additive edits only, exactly where needed

### Process
- ❌ Half-finished work with `// TODO: implement later`
- ❌ Suppressing TypeScript errors with `// @ts-ignore` outside test files
- ❌ Committing secrets
- ❌ Rebasing or force-pushing the `feat/career-copilot-transformation` branch without Ali's say-so

---

A ban that gets lifted gets a corresponding `docs/decisions/A##-revision.md` entry with the date and the new directive. Otherwise: assume the ban holds.
