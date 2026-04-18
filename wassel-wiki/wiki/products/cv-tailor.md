---
type: product
updated: 2026-04-18
sources: [client/src/components/landing/BentoFeatures.tsx, client/src/pages/CVTailor.tsx, server/_core/routes/cv.ts]
---
# CV Tailor — تخصيص السيرة الذاتية

**TL;DR:** A polished CV tailored to every opportunity, with Saudi-market standards baked in. Form-based input, Claude generates a context-aware CV version per target role.

## Purpose
Eliminate the "one-CV-fits-all" trap. Let users produce a distinct, role-tailored CV for each application, respecting Saudi recruiting norms (Vision 2030 alignment where relevant, Arabic/English duality).

## Current state
- Route: `/app/cv` (client/src/pages/CVTailor.tsx)
- Server: `server/_core/routes/cv.ts` (uses Anthropic `claude-sonnet-4-6`)
- Cost: 10 tokens per generation (enforced server-side, cv.ts line 201)
- Input: structured form fields + context notes passed to Claude
- Client timeout: 60s (feature complete as of 2026-04-11)

## User flow
1. User fills form fields (target role, company, tone)
2. Adds optional context (saved [[profile-analysis]] can seed this)
3. Claude Sonnet generates tailored CV sections
4. Error states surface clearly; user can retry or adjust context

## Tech notes
- Client wrapper: `trpc.cv.generate(fields, context)` — no `.mutate()` suffix
- Arabic content stays Arabic, English stays English — no auto-translation
- Font: Cairo (Arabic) + Inter (English)

## Known issues — [[recurring-issues]]
None specific at time of writing.

## Related
- [[profile-analysis]] — analyzed profiles feed CV context
- [[knowledge-base]] — CV versions saved for reuse
