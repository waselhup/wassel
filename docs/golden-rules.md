# The 22 Golden Rules

These are not preferences. They are constants. None of them is wrapped in a feature flag, A/B test, or pricing tier. They apply to every screen, every API response, and every internal review of a Wassel feature.

The numbering matches the 22 decision files in `docs/decisions/A01.md` … `A22.md`. The rule here is the *principle*; the decision file is the *application* of that principle to a concrete tradeoff.

---

### R01 — Wassel leads, never offers a menu
Every screen has a most-likely next step. The user is never expected to choose between four equally-weighted options.

### R02 — The user is never asked the same question twice
Goal, level, target role, industry, language live in `career_profile`. No screen re-asks. Temporary divergences are `section_overrides`, never overwrites.

### R03 — Tokens are deducted only after success
If the operation fails (timeout, model error, validation), the wallet stays whole. Atomic deduction wraps the operation, not the prompt prep.

### R04 — Pricing always shows what-it-buys
The token count never appears without a sentence explaining the deliverable. No exceptions.

### R05 — No empty state is text-only
Every empty state has a single suggested action, written in the user's working language, leading into the canonical "next move."

### R06 — Errors speak the user's language, not the runtime's
"Anthropic returned 529" is not an error message. "The analysis is paused — try again in a moment" is.

### R07 — Numbers are always Western (0123456789)
Regardless of UI language. Arabic-Indic digits (٠١٢٣) never appear in product copy, error messages, invoices, or exports.

### R08 — The Radar is the entry point
Onboarding ends inside the Radar. A first-time user who finishes onboarding sees their first Radar result, not a dashboard.

### R09 — Caching is non-negotiable
Re-displaying a stored analysis costs zero tokens. The cache key is `(user_id, target_role, profile_hash)`.

### R10 — The Resume is targeted, not generic
The user picks a target role first. The resume builder reads that role from `career_profile` (or the active `section_override`).

### R11 — Content is professional, never trend-bait
Posts, carousels, and repurposing live inside the Career Copilot brain. Tone is professional. Vision 2030, hyperbole, and fabricated stats are banned.

### R12 — Refinement is free for the first five edits
The first five "refine this paragraph" actions per document cost zero tokens. After that, a small charge applies. Documented on every refinement screen.

### R13 — The dashboard leads, doesn't list
The home tile is a single "Next Task" card. Other surfaces (history, drafts) live below the fold.

### R14 — The Smart Dashboard is built from the activity log
`activity_log` is the only source. AI suggestions in `ai_suggestions` are derived from it. No screen invents activity it didn't observe.

### R15 — The user owns their data (PDPL)
Every user can export everything Wassel stores about them, and can delete it. Both actions are one click in Settings → Privacy.

### R16 — Discovery is private
LinkedIn data ingested for a user is never shown to another user. Vendor names are not displayed (no "Apify", "Apollo", "Bright Data" in UI).

### R17 — Trust is earned in the first journey
The free "Explore" plan is one full lifetime journey, end-to-end. It is not a teaser of one feature.

### R18 — Subscription tokens expire; top-up tokens don't
Users see this rule plainly on the pricing page. The 3-wallet system enforces it; the UI explains it.

### R19 — The bilingual contract is real
Every UI string has both AR and EN keys at the moment it ships. There is no "translate later" backlog.

### R20 — The build is repeatable
`api/index.js` is rebuilt from `server/_core/vercel.ts` via a single esbuild command. It is never edited by hand. The build is reproducible from a clean clone.

### R21 — The prompts are not in code
Prompts live in `docs/prompts/*.md`. They are compiled into `server/_core/prompts/_generated.ts` by `scripts/build-prompts.ts`. Editing prompts is editing markdown; the code consumes the generated file.

### R22 — Parallel work has hard fences
When two Claude sessions work simultaneously on Wassel (e.g. Career Copilot + AI Workforce), each has a written blocklist. Touching a file outside one's scope is a "stop and ask" event.
