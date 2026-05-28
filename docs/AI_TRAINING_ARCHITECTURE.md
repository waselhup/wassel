# AI Training Architecture — Future Roadmap

> **Status:** FUTURE — implement after **50+ paying users + 100+ AI calls/day + 30+ negative feedback signals**.
> Until then, ~80 % of this architecture already exists in scaffolding form (Layers 1–3). This document is a **reference**, not an active spec. It triggers no code changes by itself.

---

## Why this document exists

Ali sketched a 5-layer training architecture for Wassel's Career Copilot AI. On audit, three of the five layers are already wired into the codebase in a usable (if minimal) form. The other two require **real user signal** before they pay off — synthetic data, in their case, would be noise, not training.

This file archives the full plan so that future-Ali (and future agents) can pick it up at the right moment, instead of building feedback loops against zero data.

---

## The 5-Layer Architecture (as designed)

### Layer 1 — Brain (project-wide constraints)

The non-negotiable rules every AI call inherits: voice, language, bans, tone, formatting, persona. The brain is consulted by every prompt-building helper before a Claude call is assembled.

### Layer 2 — Feature Prompts (per-deliverable templates)

System + user + JSON-schema fragments per AI feature (Radar discovery, Radar analysis, Resume build/variant/refine, Content post/repurpose, Dashboard insights). Each prompt is a versioned, reviewable artifact — not a string concatenated at call time.

### Layer 3 — Context Injection (per-call user state)

Before each call, the engine assembles a context blob: career profile, recent activity, current goal, locale, feature-specific inputs. This blob is appended to the user message before the Claude call goes out.

### Layer 4 — Few-Shot Examples (calibration via real failures)

A library of `{input → ideal output}` pairs extracted from **observed** failures and successes. Injected into prompts that consistently underperform. Examples are not invented — they are harvested from production traffic + manual review.

### Layer 5 — Validation (output guard before user sees it)

A deterministic, fast guard that runs over every Claude output before it reaches the user. Catches: banned words, banned brand names, Eastern Arabic digits, schema violations, hallucinated PII. Failures trigger an automatic retry or a friendly error + token refund.

---

## Continuous Loop (operational layer)

```
                ┌──────────────────────────────────┐
                │  1. AI generates output          │
                └──────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────────┐
                │  2. Validation Layer (L5) gates  │
                └──────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────────┐
                │  3. User receives + reacts       │
                │     (👍 / 👎 / silent / retry)   │
                └──────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────────┐
                │  4. Signal aggregated weekly     │
                │     into failure patterns        │
                └──────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────────┐
                │  5. Patterns → Few-Shot (L4) +   │
                │     Brain (L1) + Prompt (L2)     │
                │     updates                      │
                └──────────────────────────────────┘
                              │
                              ▼  (back to step 1)
```

The loop only runs when steps 3–4 have enough signal. With <50 active users, step 4 produces nothing actionable.

---

## Golden Sets

A frozen, hand-curated suite of `{input, expected output shape, must-have/must-not-have}` test cases per feature. Run before every prompt change. Failures block deploy.

**Required ingredients:**
- 20+ real user inputs per feature (anonymized)
- Reviewed pass/fail labels from Ali or a domain expert
- Diff harness that reports which cases regressed when a prompt is edited

**Why we don't have this yet:** synthetic golden sets train the AI on Ali's imagined user, not the real one. Build after the first 50 users — their actual inputs become the golden set.

---

## Workflow (steady-state, post-launch)

1. **Daily:** validation layer auto-flags any output that fails L5; flagged outputs are written to a review queue.
2. **Weekly:** Ali (or designated reviewer) skims the queue + 👎 feedback, tags failure modes.
3. **Bi-weekly:** failure modes >5 occurrences → add to golden set + draft a fix (prompt edit, brain rule, few-shot example).
4. **Monthly:** run full golden set against current prompts. Compare pass-rate to last month. Ship prompt updates only when pass-rate is monotonic up.
5. **Quarterly:** refresh the brain (L1) based on accumulated learnings — rare, intentional, written decision in `docs/decisions/`.

---

## Current State vs. Architecture (codebase audit, 2026-05-28)

| Layer | In the plan | Where it lives today | Status |
|---|---|---|---|
| **L1 — Brain** | Project-wide tone / bans / language rules consulted by every call | `docs/golden-rules.md`, `docs/ban-list.md`, `docs/language-rules.md`, `docs/career-copilot-brain.md` | ✅ Exists |
| **L2 — Feature prompts** | Versioned system+user+schema per feature | `docs/prompts/*.md` → compiled via `scripts/build-prompts.ts` → `server/_core/prompts/_generated.ts` | ✅ Exists |
| **L3 — Context injection** | Engine assembles per-user context before each call | `server/_core/lib/{radar,resume,content,dashboard}-engine.ts` build context blobs from `career_profile` + recent activity per call | ✅ Exists |
| **L4 — Few-shot examples** | Real failure-derived `{input → ideal}` pairs in prompts | ❌ None — no few-shot blocks in `docs/prompts/*.md` | ❌ Missing — **build after** Beta yields ≥30 negative signals + identified failure patterns |
| **L5 — Validation** | Deterministic guard before user sees output | 🟡 Partial — Sprint 8 `error-formatter.ts` handles `MODEL_FAILED`; **this PR adds `output-guard.ts`** for banned-word + Eastern-digit blocking | 🟡 Partial — extended by `feat/output-guard` |
| **Temperature / max_tokens** | Per-feature tuning | Set per engine call (`temperature` + `max_tokens` in each `messages.create` invocation) | ✅ Exists |
| **Continuous Loop** | Output → user signal → pattern → prompt update | ❌ No 👍/👎 widget on AI outputs; no review queue; no pattern aggregation | ❌ Missing — needs Beta users first |
| **Golden Sets** | 20+ real-input test cases per feature | ❌ None | ❌ Missing — needs real user inputs |

---

## Implementation criteria (when to revisit this file)

Do not start L4, the Continuous Loop, or Golden Sets until **all four** of these are true:

1. **50+ paying users** on Wassel
2. **100+ AI calls per day** sustained for ≥2 weeks
3. **30+ negative-feedback signals** (👎, silent abandon, manual edit, refund-on-bad-output) from real users
4. **Identified failure patterns** — at least 3 distinct, named failure modes observed in production traffic that block a meaningful share of users

Below those thresholds, time spent on this architecture is time spent training the AI on Ali's imagination, not on real users. Spend it on acquisition instead.

---

## What `feat/output-guard` (this Sprint) adds

A minimal Layer 5 sliver: a `validateOutput(text, operation)` helper in `server/_core/lib/output-guard.ts`, called from every Claude-output extraction point in the radar / resume / content engines. It blocks the output when it contains a banned vendor / model name or an Eastern Arabic digit, throws `MODEL_FAILED`, and lets the existing Bowling Lane Rule refund the user's token via the Sprint 8 error formatter.

That is the **entire** L5 deliverable for now. No logging table. No 👍/👎 widget. No dashboard. Those are deferred until the four implementation criteria above are met.

---

## Related decisions and docs

- `docs/golden-rules.md` — the 22 rules (L1)
- `docs/ban-list.md` — what we never ship or say (L1 + L5 source-of-truth)
- `docs/language-rules.md` — AR primary, EN secondary, Western digits (L1)
- `docs/career-copilot-brain.md` — in-app brain architecture (L1)
- `docs/prompts/*.md` — feature prompts (L2)
- `docs/decisions/A01.md` … `A22.md` — architectural decisions
