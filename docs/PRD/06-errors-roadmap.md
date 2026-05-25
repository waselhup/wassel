# PRD 06 — Errors, Smart Dashboard, and Roadmap

This file covers three smaller scopes that didn't justify standalone PRDs.

---

## Part 1 — Error Formatter (Sprint 8)

### Why

Raw exceptions ("Anthropic returned 529", "fetch failed", "TRPC NOT_FOUND") leak runtime into user-facing copy. Already partially solved by manual mappings; Sprint 8 finishes the job with an AI-powered formatter.

### How

Every server-side error caught by tRPC's error handler is, before being returned to the client, passed through the `error-formatter` prompt (Haiku 4.5). The prompt:

1. Takes the raw exception, the user's locale (`ar` or `en`), and the operation that failed
2. Returns `{ messageKey: string, params: object }` where `messageKey` references a row in the `errors.*` namespace of `translation.json`
3. If no good key fits, the formatter falls back to `errors.generic` with a short auto-translated message

The client renders `t(messageKey, params)`. The raw exception goes to Sentry.

### Pre-Sprint-8 (now)

Until the formatter is wired, the server returns manual mappings:

```ts
{ code: 'BUSY',         messageKey: 'errors.service_busy' }
{ code: 'TIMEOUT',      messageKey: 'errors.timeout' }
{ code: 'NO_TOKENS',    messageKey: 'errors.no_tokens' }
{ code: 'INVALID_INPUT',messageKey: 'errors.invalid_input', params: { field } }
```

The `errors.*` namespace has ~12 keys scaffolded in Sprint 1+2.

---

## Part 2 — Smart Dashboard (Sprint 6)

### What

`/v2/home` becomes a single Next Task card above the fold, with secondary surfaces below.

### Pipeline

```
activity_log         (every meaningful action, written by every router)
       │
       │ nightly cron at 02:00 AST
       ▼
next-task prompt     (claude-haiku-4-5-20251001)
       │
       ▼
ai_suggestions       (one to three rows per user per night, scored)
       │
       ▼
/v2/home renders top-scored suggestion as the Next Task card
```

The card has:
- Headline ("اكتب أول منشور عن قيادة المنتجات")
- One-sentence rationale ("بناءً على تحليل الرادار الأخير")
- Primary CTA → deeplink into the relevant pillar
- Dismiss button (writes `next_task.dismissed` to `activity_log`, lowering future similar suggestions' score)

### Below-the-fold

- Recent activity (last 7 days from `activity_log`)
- Draft library (collapsed by surface: Resume drafts, Post drafts)
- Wallet summary (3 wallets + total + expiry)

---

## Part 3 — Activity Log Catalogue

Actions emitted by Sprint 2 routers and beyond. The catalogue grows; this is the seed.

| action | written by | when |
| --- | --- | --- |
| `onboarding.started` | client | step 1 first render |
| `onboarding.step_completed` | client | each step's next |
| `onboarding.skipped_linkedin` | client | step 4 skip |
| `onboarding.completed` | server (`careerProfile.create`) | first successful create |
| `career_profile.updated` | server (`careerProfile.update`) | any field change |
| `career_profile.exported` | server (`careerProfile.export`) | every export |
| `career_profile.deleted` | server (`careerProfile.delete`) | every delete |
| `wallet.credited` | server (any credit) | every credit |
| `wallet.debited` | server (`deduct_tokens_v2`) | every debit |
| `radar.started` | server (Sprint 3) | every Radar call begin |
| `radar.completed` | server (Sprint 3) | every Radar call success |
| `radar.cache_hit` | server (Sprint 3) | every cache hit |
| `resume.built` | server (Sprint 4) | every resume build |
| `resume.refined` | server (Sprint 4) | every refinement |
| `resume.exported` | server (Sprint 4) | every export |
| `post.generated` | server (Sprint 5) | every post |
| `carousel.generated` | server (Sprint 5) | every carousel |
| `repurpose.generated` | server (Sprint 5) | every repurpose |
| `post.published` | client (Sprint 5) | "mark as published" click |
| `next_task.shown` | client (Sprint 6) | card render |
| `next_task.actioned` | client (Sprint 6) | primary CTA click |
| `next_task.dismissed` | client (Sprint 6) | dismiss click |

In Sprint 1+2, only the rows marked "server" with no future Sprint annotation are actually emitted. The rest are scaffolded for forward compatibility.

---

## Part 4 — The Full Roadmap

| Sprint | Title | Status | Key deliverable |
| --- | --- | --- | --- |
| 1 | Foundation | DONE (this branch) | docs/, schema, 3-wallet, prompt build |
| 2 | Onboarding | DONE (this branch) | wizard, careerProfile router, settings |
| 3 | Radar v2 | Future | cached + included-fixes + refinement |
| 4 | Resume v2 | Future | target-role driven, ATS-keyed, refinement |
| 5 | Career Content | Future | post + carousel + repurpose |
| 6 | Smart Dashboard | Future | Next Task card, activity → suggestions |
| 7 | Pricing + Moyasar + RPC unification | Future | finalize prices, integrate payments, unify deduct RPCs |
| 8 | Polish | Future | error formatter, CI translation gate, analytics, gender preference |

Each sprint is 1–2 weeks scoped tightly; the branch model assumes one sprint at a time after the AI Workforce parallel branch merges.

---

## Part 5 — When This Document Is Outdated

This is a snapshot at the moment Sprint 1+2 completes (2026-05-25). When Sprint 3 starts, this file gets a new `03-radar.md` companion with the real implementation details, and Section 1 of *this* file moves to a Sprint 8 PRD when it ships.

Until then, this is the canonical reference for "what's coming next".
