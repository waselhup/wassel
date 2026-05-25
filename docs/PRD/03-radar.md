# PRD 03 — Radar (الرادار)

**Sprint:** 3 (future).
**Status in this branch:** Scaffolded — prompts written, namespace reserved.

---

## What the Radar Does

Reads the user's LinkedIn data + `career_profile`. Compares against an internal model of what the user's *target role* expects. Outputs:

1. **Strengths** — bullets of what's already aligned
2. **Gaps** — bullets of what's missing or weak
3. **Included Fixes** — small profile rewrites Wassel can perform for zero tokens
4. **Suggested Actions** — larger moves (write 3 posts, take a course, expand a section) with links into the other Career Copilot pillars

---

## Inputs

```
{
  career_profile: { goal, level, target_role, industry, primary_language, ... },
  section_overrides: ActiveOverride[],   // 0..n
  linkedin_data: ScrapedLinkedInProfile  // from cache if fresh; refreshed if stale
}
```

`section_overrides` of section `'radar'` layer non-destructively on top of `career_profile` for this analysis only.

---

## Prompt

`docs/prompts/radar.md` — uses `claude-sonnet-4-6` for analysis. The discovery step (parsing the raw scrape into structured fields) uses `claude-haiku-4-5-20251001` and a separate prompt (`docs/prompts/radar.md` includes the discovery sub-prompt).

---

## Output Shape

```ts
type RadarResult = {
  strengths: Array<{ title: string; detail: string }>;
  gaps:      Array<{ title: string; detail: string; severity: 'low'|'medium'|'high' }>;
  included_fixes: Array<{
    title: string;
    field: 'headline'|'about'|'experience'|'skills';
    suggestion: string;        // proposed new text
    rationale: string;
  }>;
  suggested_actions: Array<{
    title: string;
    detail: string;
    pillar: 'resume'|'content'|'profile';
    deeplink: string;          // /v2/cvs, /v2/posts, /v2/settings/career, etc.
  }>;
  meta: { target_role: string; profile_hash: string; generated_at: string };
};
```

---

## Caching

Per `docs/decisions/A09.md`:
- Key: `(user_id, target_role, profile_hash)`
- Store: `radar_cache` table (added in Sprint 3 migration)
- TTL: until inputs change
- Cache hit = 0 wallet tokens

---

## Pricing (149 tokens — Master Brief)

Confirm against `system_settings.radar_cost` before going live. If the DB has a different number, document the live number here with a `Sprint 7 adjusts to brief target` note.

---

## UI Outline (Sprint 3 builds this)

- **Input screen** (`/v2/analyze`) — input mode: LinkedIn URL + target role chip + optional "override target role" link
- **Loading screen** (`/v2/analyze/loading`) — progress strip + "Wassel يحلل بروفايلك…"
- **Results screen** (`/v2/analyze/result/:id`) — four sections (strengths, gaps, fixes, actions). Each fix has Apply / Skip. Each suggested action has a deeplink button.

---

## Open Questions (resolve in Sprint 3 kickoff)

- Should included-fixes be applied automatically with a 5-second undo, or always require explicit Apply? (Leaning toward explicit Apply for trust.)
- Maximum gap count to display? (Leaning toward 5; rest in a "show more".)
- Should the user be allowed to mark a gap as "I disagree" to suppress it in future runs? (Defer to Sprint 8.)
