# PRD 01 — Career Copilot Vision

**Status:** Authoritative for product direction.
**Owner:** Ali.
**Companion docs:** `docs/MASTER-BRIEF.md`, `docs/career-copilot-brain.md`.

---

## The One-Sentence Story

> Wassel is a Career Copilot for working professionals in Saudi Arabia and the wider GCC — it leads them from "I have a goal" to "I have an offer / a promotion / a real audience", in Arabic by default and in English when they want.

---

## Who Wassel Is For

Three concentric circles, ordered from inside out:

1. **Mid-to-senior Arabic-speaking professionals in the GCC** seeking promotion, new role, or career pivot. They're employed, busy, value their time, are skeptical of "AI tools". This is the bullseye.
2. **Bilingual professionals (AR + EN)** working at multinational employers in the Gulf — they expect English-grade UX, Arabic-grade respect, and clean ATS resumes for international applications.
3. **GCC employers** as a secondary audience (longer term, via Workforce portal which is owned by the AI Workforce session).

The first circle defines product priorities. The second circle defines language and quality. The third is a parallel revenue line — not part of Career Copilot scope.

---

## What the Career Copilot Does

Four pillars, each a doorway into the same journey:

### 1. Radar (الرادار)
Surfaces the gap between *who the user is today* (LinkedIn + manual signals) and *who the target role wants*. The output is structured: strengths, gaps, suggested actions. Some actions are "Included Fixes" (the Radar performs them for zero tokens — small profile rewrites). Others are pointers ("write 3 posts about leadership in fintech").

### 2. Resume (السيرة ATS)
Builds an ATS-readable resume *for the chosen target role*, in Arabic or English. Refinement is iterative: the user can request "stronger verb here", "shorter summary", "add a bullet about X". The first 5 refinements per document are included.

### 3. Career Content (المحتوى المهني)
Generates LinkedIn posts and carousels that build professional presence. Tone is calm and senior. Three modes:
- **Post** — one short LinkedIn post on a topic
- **Carousel** — 5–8 slide narrative
- **Repurpose Bundle** — take an existing post and produce a carousel + a short-form video script + a follow-up post

### 4. Smart Dashboard (Dashboard الذكي)
The home surface (`/v2/home`). One Next Task card at the top, generated nightly from the user's activity log. Below the fold: recent activity, drafts, wallet summary.

---

## What Wassel Is NOT

- **Not a job board** — it does not list openings or apply for the user
- **Not a recruiter** — does not source candidates for employers (the AI Workforce parallel product line handles that)
- **Not a Chrome extension** — explicitly excluded from roadmap
- **Not an English-first product translated to Arabic** — Arabic is the primary design language
- **Not a productivity-tool grab bag** — every screen advances the user's career goal

---

## The Mother Rule, restated

The user is never asked the same question twice. `career_profile` is the backbone; every screen reads from it; section overrides handle temporary divergences and decay.

If a screen has to ask "what's your target role?" again — the screen is broken.

---

## Sprint Map (this branch)

| Sprint | Status | Output |
| --- | --- | --- |
| 1 | **DONE in this branch** | Docs, schema, 3-wallet system, prompt build pipeline |
| 2 | **DONE in this branch** | Onboarding wizard, careerProfile router, Settings screens |
| 3 | Future | Radar v2 (caching, included-fixes, refinement) |
| 4 | Future | Resume v2 (target-role driven, ATS-keyed) |
| 5 | Future | Career Content (post + carousel + repurpose) |
| 6 | Future | Smart Dashboard (Next Task card, activity log → suggestions) |
| 7 | Future | Pricing alignment + Moyasar integration + RPC unification |
| 8 | Future | Polish, analytics, error formatter, CI translation gate |

Sprints 3–8 are individually scoped in the remaining PRD files (`02-onboarding.md` covers what Sprint 2 already shipped, then `03-radar.md` through `06-errors-roadmap.md` describe the future work).

---

## Success Criteria for the Transformation

Career Copilot is successful when:

1. A new user finishes onboarding in under 4 minutes and lands inside their first Radar result
2. A returning user, by day 7, has built one resume tailored to a declared target role
3. A paying user, by day 30, has published at least 3 LinkedIn posts via Wassel
4. The Dashboard's Next Task card is dismissed *or actioned* at least 50 % of the time it's shown
5. No user reports being asked the same question twice
6. The four pillars are perceived as one product, not four tools (qualitative — user interview signal)

The numeric targets above are directional, not contracts; they become real KPIs in Sprint 8.
