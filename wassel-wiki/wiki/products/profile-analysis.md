---
type: product
updated: 2026-04-18
sources: [client/src/components/landing/BentoFeatures.tsx, client/src/pages/ProfileAnalysis.tsx, server/_core/routes/linkedin.ts]
---
# Profile Analysis — تحليل البروفايل المهني

**TL;DR:** In-depth LinkedIn profile review with a 100-point score and a clear, actionable growth plan. Hero/flagship feature — paste a LinkedIn URL, get scored sections (Headline, Summary, Experience) plus concrete improvements.

## Purpose
Help Saudi/GCC professionals understand how their LinkedIn profile reads to recruiters and what to fix. Positioned as "تحليل" / analysis — never "scraping".

## Current state
- Route: `/app/profile-analysis` (client/src/pages/ProfileAnalysis.tsx)
- Server: `server/_core/routes/linkedin.ts` (uses Anthropic `claude-haiku-4-5-20251001`)
- Cost: 5 tokens per analysis (enforced server-side, see linkedin.ts line 236)
- Results auto-save to [[knowledge-base]] via "Save to Knowledge Base" button

## User flow
1. User pastes LinkedIn URL (any format — validator accepts all variants)
2. Auto-fill + progress bar during scrape
3. Claude Haiku generates scored breakdown (100-point total, per-section %)
4. User can save to [[knowledge-base]] for later reference or NotebookLM export

## Tech notes
- Uses Apify `harvestapi/linkedin-profile-search` for scraping (never surfaced in UI)
- Client wrapper: `trpc.linkedin.analyze(profileUrl)` — no `.mutate()` suffix
- History: `trpc.linkedin.history()`

## Known issues — [[recurring-issues]]
None specific at time of writing.

## Related
- [[cv-tailor]] — shares the user's analyzed profile context
- [[knowledge-base]] — saved analyses live here
- [[smart-outreach]] — uses analysis output to personalize messages
