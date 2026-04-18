---
type: product
updated: 2026-04-18
sources: [client/src/components/landing/BentoFeatures.tsx, client/src/pages/KnowledgeBase.tsx, server/_core/routes/knowledge.ts]
---
# Knowledge Base — قاعدة المعرفة

**TL;DR:** User's personal career knowledge store — saved profile analyses, CV versions, campaign artifacts, and market tips. Exports to Google NotebookLM as JSON for external study.

## Purpose
Give users a single place to return to the insights Wassel produced for them. Prevents the "where did that analysis go?" problem and enables long-term compounding learning.

## Current state
- Route: `/app/knowledge` (client/src/pages/KnowledgeBase.tsx)
- Server: `server/_core/routes/knowledge.ts` (list, save, delete, export)
- DB: `knowledge_items` table with RLS
- Skill docs: `skills/notebooklm/SKILL.md`

## User flow
1. User completes a [[profile-analysis]] or [[cv-tailor]] session
2. Clicks "Save to Knowledge Base"
3. Item is stored in the user's private collection
4. Later: opens `/app/knowledge`, browses, or exports to JSON for NotebookLM

## Tech notes
- RLS enforces per-user isolation — never trust client-side filtering
- Export format: JSON with LinkedIn analyses, campaigns, CV versions, market tips
- Client wrapper: `trpcQuery("knowledge.list")`, `trpc.knowledge.save(...)`

## Known issues — [[recurring-issues]]
None specific at time of writing.

## Related
- [[profile-analysis]], [[cv-tailor]] — feed items into the KB
- [[analytics]] — aggregate view over time
