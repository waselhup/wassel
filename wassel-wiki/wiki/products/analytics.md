---
type: product
updated: 2026-04-18
sources: [client/src/components/landing/BentoFeatures.tsx, client/src/pages/Analytics.tsx]
---
# Analytics — التحليلات

**TL;DR:** Track progress and measure outcomes — تتبع تقدمك وقياس نتائج جهودك. Surfaces user-facing KPIs across [[profile-analysis]], [[posts]], and [[smart-outreach]].

## Purpose
Close the loop between "I'm doing things" and "my career is moving". Show profile strength trend, post engagement, and campaign response rates in one view.

## Current state
- Route: `/app/analytics` (client/src/pages/Analytics.tsx)
- Status: Pending full implementation (listed in root CLAUDE.md Next Steps)

## User flow
1. User opens the Analytics tab
2. Sees dashboards over time (profile score deltas, post reach, campaign replies)
3. Decides where to invest next

## Tech notes
- PostHog is installed at the infra layer (see root CLAUDE.md "Tools Connected")
- Will need its own tRPC router when built out

## Known issues — [[recurring-issues]]
Page is a stub — full implementation is pending.

## Related
- [[posts]] — engagement metrics land here
- [[smart-outreach]] — reply rates land here
- [[profile-analysis]] — score trend over repeated analyses
