---
type: product
updated: 2026-04-18
sources: [client/src/components/landing/BentoFeatures.tsx, client/src/pages/Posts.tsx, server/_core/routes/posts.ts]
---
# LinkedIn Posts — منشورات LinkedIn

**TL;DR:** Thoughtful posts that build the user's reputation — محتوى احترافي يجذب التفاعل. AI-assisted drafting for posts that sound like the user, not like a template.

## Purpose
Help professionals show up consistently on LinkedIn without sounding generic. Posts should reinforce the user's voice and professional positioning.

## Current state
- Route: `/app/posts` (client/src/pages/Posts.tsx)
- Server: `server/_core/routes/posts.ts`
- Cost: 3 tokens per post (enforced server-side, posts.ts line 57; returns HTTP 402 when insufficient)

## User flow
1. User describes what they want to post (topic, angle, tone)
2. AI drafts a post in the user's voice
3. User edits, copies, publishes to LinkedIn manually (no auto-posting)

## Tech notes
- Uses Anthropic API (shared pattern with other services)
- Client wrapper follows the fetch-based pattern — direct function invocation

## Known issues — [[recurring-issues]]
None specific at time of writing.

## Related
- [[profile-analysis]] — voice cues can come from analyzed profile
- [[analytics]] — post performance shows up here (once wired)
