# Career Copilot — The In-App AI Brain

This document describes how the four product pillars (Radar, Resume, Content, Dashboard) connect into one continuous experience driven by a single backbone (`career_profile`) and a single set of prompts (`server/_core/prompts/_generated.ts`).

It is the architectural document. The product story is in `docs/PRD/01-vision.md`. The decisions that make this story enforceable are in `docs/decisions/A01.md` … `A22.md`.

---

## 1. The Brain at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                       career_profile (DB)                       │
│  goal · level · target_role · industry · primary_language       │
│       (one row per user, the only source of truth)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ injected into every prompt
       ┌───────────────────┼──────────────────────┐
       ▼                   ▼                      ▼
 ┌──────────┐       ┌──────────┐         ┌──────────────┐
 │  Radar   │       │  Resume  │         │   Content    │
 │ (Haiku   │       │ (Sonnet  │         │ (Haiku posts │
 │  ingest, │       │  build,  │         │  Sonnet      │
 │  Sonnet  │       │  Sonnet  │         │  carousel)   │
 │  analyze)│       │  refine) │         │              │
 └────┬─────┘       └────┬─────┘         └──────┬───────┘
      │                  │                      │
      └─────────────┬────┴───────────────┬──────┘
                    ▼                    ▼
            ┌─────────────────────────────────┐
            │      activity_log (DB)          │
            │ every meaningful user action    │
            └──────────┬──────────────────────┘
                       ▼
            ┌─────────────────────────────────┐
            │  ai_suggestions (DB)            │
            │  computed nightly: "next task"  │
            └──────────┬──────────────────────┘
                       ▼
            ┌─────────────────────────────────┐
            │    Smart Dashboard              │
            │    one Next Task card           │
            └─────────────────────────────────┘
```

---

## 2. Why the Backbone Matters

Without `career_profile`:
- Radar asks for the target role
- Resume asks for the target role again
- Content asks for the target role a third time
- The Dashboard cannot suggest "make a post about your new target role" because nothing knows what that role is

With `career_profile`:
- Onboarding writes it once
- Every other screen reads from it
- Settings → Career Profile is the *only* place it changes
- A "what if I targeted a Director role instead?" experiment goes into `section_overrides`, decays in 24h, never affects the canonical row

This is **Mother Rule R02** made concrete: the user is never asked the same question twice.

---

## 3. The Prompt Pipeline

```
docs/prompts/radar.md
docs/prompts/resume.md
docs/prompts/content-post.md
docs/prompts/content-carousel.md
docs/prompts/content-repurpose.md
docs/prompts/next-task.md
docs/prompts/error-formatter.md
                │
                ▼
       scripts/build-prompts.ts
                │
                ▼
server/_core/prompts/_generated.ts   ← regenerated on each build
                │
                ▼
    consumed by tRPC routers
```

Prompts are markdown. Each `.md` file is a complete prompt with three sections:

1. **System prompt** (fenced ` ```system ` block)
2. **User-message template** with `{{placeholders}}` resolved at runtime
3. **Output schema** (a TypeScript-flavored type definition, also fenced)

The build script reads each file, parses the three blocks, and emits one named export per prompt into `_generated.ts`. A router calling the Radar imports `radarPrompt` from `_generated.ts`. **There is no other path to a Claude call.**

Why this architecture:
- Prompts are content, not code. Product/copy edits don't require a TypeScript change
- Diffing prompts in git is meaningful — you see exactly what changed in the words
- A schema mismatch (the model returns a field that's no longer expected) fails type-check, not silently
- Reverting a bad prompt is `git revert` on a markdown file

---

## 4. Cost Model

Two models are routed by job type:

| Job | Model | Why |
| --- | --- | --- |
| LinkedIn ingest (parse the scraped profile into structured data) | `claude-haiku-4-5-20251001` | Volume work, deterministic shape |
| Radar gap analysis | `claude-sonnet-4-6` | Reasoning about fit |
| Resume build | `claude-sonnet-4-6` | Long-form generation with structure |
| Resume refinement (per-paragraph) | `claude-sonnet-4-6` | Quality matters over speed |
| Content post | `claude-haiku-4-5-20251001` | Short, repeatable shape |
| Content carousel | `claude-sonnet-4-6` | Coherent 5–8 slide narrative |
| Content repurpose | `claude-haiku-4-5-20251001` | Reformatting, not authoring |
| Next-task suggestion | `claude-haiku-4-5-20251001` | Cheap, runs nightly per user |
| Error formatter | `claude-haiku-4-5-20251001` | Cheap, runs on every failure |

Tokens consumed in the wallet system are independent of provider tokens. The Wassel token catalogue (Master Brief §7) is what users see and pay for.

---

## 5. Caching Layer

Every model call is keyed and cached. The cache is in Supabase, not in-memory.

| Surface | Cache key | TTL |
| --- | --- | --- |
| Radar | `(user_id, target_role, profile_hash)` | Until `target_role` or `profile_hash` changes |
| Resume | `(user_id, target_role, profile_hash, version)` | Until any input changes |
| Content post | `(user_id, topic_hash, language)` | 7 days |
| Content carousel | `(user_id, topic_hash, language)` | 7 days |
| Next-task | `(user_id, date)` | 24 hours |

Cache hits cost 0 wallet tokens. This is **R09** made concrete.

---

## 6. Override Mechanics (`section_overrides`)

When a user wants to "try the Radar as if I were targeting Director of Product instead of Senior PM":

1. UI captures the target role for the experiment
2. Backend writes `section_overrides` row: `{ user_id, section: 'radar', payload: { target_role: 'Director of Product' }, expires_at: now + 24h }`
3. Subsequent Radar call reads `career_profile` then layers any non-expired `section_overrides` of section `'radar'` on top
4. Result is cached under the *overridden* `target_role`, not the canonical one
5. The override decays naturally; the canonical profile is never touched

The user can also pin or delete overrides explicitly from Settings → Career Profile.

---

## 7. Activity Log → AI Suggestions → Dashboard

`activity_log` rows are short: `(user_id, action, target, payload, created_at)`. Examples:
- `('uid', 'radar.completed', 'target_role=Senior PM', { gaps_count: 4 }, …)`
- `('uid', 'resume.exported', 'format=pdf', { role: 'Senior PM' }, …)`
- `('uid', 'post.published', 'channel=linkedin', { topic: 'leadership' }, …)`

Every night, a job (Sprint 6) reads the last 30 days of activity per user and writes one to three rows into `ai_suggestions`, scored. The Smart Dashboard reads the top-scored suggestion and renders it as the Next Task card.

There is **no other path** for the Dashboard to suggest something. No hand-coded rules in the UI. No "if user hasn't logged in for 7 days, show X". Suggestions are model output; the dashboard renders them.

---

## 8. PDPL & Data Ownership

`careerProfile.export()` returns a single JSON blob with:
- `career_profile`
- All `section_overrides`
- All `wallet_transactions`
- All `activity_log` rows
- All Radar / Resume / Content artifacts the user has produced

`careerProfile.delete()` is the nuclear option:
- Deletes `career_profile`
- Deletes `section_overrides`
- Marks the `auth.users` row for soft deletion (handled by a Supabase trigger in Sprint 7)
- Refunds nothing (the user agreed to a non-refundable balance at purchase)

The user is shown both buttons on Settings → Privacy & Data, plainly labeled, never hidden in a sub-menu.

---

## 9. What This Document Does Not Cover

- **Radar UI implementation** — Sprint 3 / `docs/PRD/03-radar.md`
- **Resume UI implementation** — Sprint 4 / `docs/PRD/04-resume.md`
- **Content authoring UI** — Sprint 5 / `docs/PRD/05-content.md`
- **Pricing & Moyasar** — Sprint 7
- **Error formatter feedback loop** — Sprint 8

This is the brain. The bodies come in the later sprints.
