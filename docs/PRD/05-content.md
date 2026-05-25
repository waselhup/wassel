# PRD 05 — Career Content (المحتوى المهني)

**Sprint:** 5 (future).
**Status in this branch:** Scaffolded — prompts written, namespace reserved.

---

## What the Content Pillar Does

Generates LinkedIn-ready professional content in three modes:

| Mode | Cost | Output |
| --- | --- | --- |
| **Post** | 5 tokens | One short LinkedIn post on a topic |
| **Carousel** | 25 tokens | A 5–8 slide narrative (PDF export) |
| **Repurpose Bundle** | 15 tokens | Take an existing post → produce a carousel + a short-form video script + a follow-up post |

---

## Tone Rules (A11)

Hard constraints in the prompts (`docs/prompts/content-post.md`, `content-carousel.md`, `content-repurpose.md`):

- ❌ Hook patterns ("Stop scrolling…", "I cannot believe this…", "Hot take:")
- ❌ Vision 2030 references
- ❌ Fabricated statistics
- ❌ Hashtag spam — max 3 hashtags per post
- ❌ Emoji-heavy openers
- ✅ A concrete observation from the user's experience
- ✅ One actionable insight
- ✅ A modest closing invitation

The prompts inherit `docs/language-rules.md` voice spec.

---

## Inputs

```
{
  career_profile,
  recent_activity: ActivityLog[30],     // last 30 days, optional
  topic?: string,                       // user-supplied
  language: 'ar' | 'en',                // default career_profile.primary_language
}
```

If no `topic` is supplied, the prompt suggests three topics derived from `career_profile` + recent activity. The user picks one, then it generates.

---

## Models

| Operation | Model |
| --- | --- |
| Post | `claude-haiku-4-5-20251001` |
| Carousel | `claude-sonnet-4-6` |
| Repurpose | `claude-haiku-4-5-20251001` |

---

## Output Shapes

```ts
type Post = {
  body: string;          // 800-1500 chars typically
  hashtags: string[];    // 0-3
  language: 'ar'|'en';
  topic: string;
  meta: { generated_at };
};

type Carousel = {
  slides: Array<{ title: string; body: string; image_prompt?: string }>;
  caption: string;       // the LinkedIn caption that accompanies the carousel
  hashtags: string[];
  language: 'ar'|'en';
  topic: string;
  meta: { generated_at };
};

type RepurposeBundle = {
  source_post_id: string;
  carousel: Carousel;
  short_video_script: { hook: string; beats: string[]; cta: string };
  follow_up_post: Post;
  meta: { generated_at };
};
```

---

## Caching

| Surface | Key | TTL |
| --- | --- | --- |
| Post | `(user_id, topic_hash, language)` | 7 days |
| Carousel | `(user_id, topic_hash, language)` | 7 days |
| Repurpose | `(user_id, source_post_id)` | 30 days |

---

## UI Outline (Sprint 5 builds)

- `/v2/posts` — list of drafts + published posts, with empty state per R05
- `/v2/posts/new` — topic input + mode toggle (Post / Carousel / Repurpose) + generate
- `/v2/posts/:id` — preview + refinement (first 5 refinements free per R12) + "Mark as published" button

"Mark as published" writes a `post.published` row into `activity_log` but does NOT actually publish to LinkedIn — there is no LinkedIn publishing API in Wassel's scope.

---

## Carousel Export

The carousel ships as:
- A PDF (rendered via the existing `jspdf` + maybe `node-html-parser` for layout) — slide per page
- A ZIP of PNGs (one per slide) — rendered via `sharp` server-side
- Image generation for slide visuals is **out of scope** for Sprint 5 — the carousel ships text-only with optional image prompts the user can paste into their preferred image tool

---

## Out of Scope

- Direct LinkedIn publishing
- Image generation
- Schedule-to-publish (would require LinkedIn API, not Wassel scope)
- A/B test variants
