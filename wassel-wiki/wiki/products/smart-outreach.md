---
type: product
updated: 2026-04-18
sources: [client/src/components/landing/BentoFeatures.tsx, client/src/pages/CampaignList.tsx, client/src/pages/CampaignNew.tsx, server/_core/routes/campaign.ts]
---
# Smart Outreach — التواصل المهني الذكي

**TL;DR:** A principled way to reach new opportunities — pick companies from a curated directory and let AI craft messages that feel personal. Called "campaigns" internally but always "التواصل المهني الذكي" in UI — never "outreach automation" and never a competitor's name.

## Purpose
Give users a compliant path to land conversations at target companies. Vision 2030-aligned framing: Saudi career platform, not cold-email spam tool.

## Current state
- Routes: `/app/campaigns` (list), `/app/campaigns/new` (5-step create flow), `/app/campaigns/:id` (report)
- Files: `client/src/pages/CampaignList.tsx`, `CampaignNew.tsx`, `CampaignReport.tsx`
- Server: `server/_core/routes/campaign.ts` (uses `claude-sonnet-4-6` for message generation)
- Token cost: variable — enforced server-side (campaign.ts line 217)
- Preview timeout: 45s with retry-on-error UX (feature-complete as of 2026-04-11)

## User flow
1. User picks companies from curated directory (no scraping language ever)
2. Sets campaign goal + tone
3. AI previews personalized messages per company
4. User reviews/edits, then launches

## Tech notes
- Client wrappers: `trpc.campaign.previewMessages({...})`, `trpc.campaign.create({...})`, `trpcQuery("campaign.list")` — no `.mutate()` suffix
- Grand Pivot context: legal B2B outreach positioning, dormant email sending (see [[2026-04-18-boris-workflow]] and project memory)

## Known issues — [[recurring-issues]]
Root CLAUDE.md lesson #7: never surface "Apify", "Waalaxy", or "LinkedIn automation" anywhere in UI.

## Related
- [[profile-analysis]] — analyzed profile feeds message personalization
- [[analytics]] — reply/response rates surface here once wired
