# PRD 02 — Onboarding

**Sprint:** 2 (this branch — implemented).
**Files:** `client/src/pages/onboarding/*`, `client/src/pages/v2/CareerProfileSettings.tsx`, `client/src/pages/v2/PrivacyAndData.tsx`.
**Router:** `server/_core/routes/career-profile.ts`.
**Tables:** `career_profile`, `section_overrides`.

---

## Why Onboarding Exists

To write the `career_profile` row that every other screen will read. The flow has four steps, each capturing one thing, and ending with a real first action (Radar analysis), not a feature menu.

---

## Flow

```
[Login] ──► AuthGate detects career_profile == null ──► /v2/onboarding
                                                            │
                  ┌─────────────────────────────────────────┘
                  ▼
        ┌──────────────────────┐
        │ Step 1: Goal         │  goal: job_search | promotion |
        │                      │        personal_brand |
        │                      │        opportunities | career_change
        └──────────┬───────────┘
                   ▼
        ┌──────────────────────┐
        │ Step 2: Level        │  level: entry | mid | senior |
        │                      │         executive
        └──────────┬───────────┘
                   ▼
        ┌──────────────────────┐
        │ Step 3: Identity     │  target_role: string
        │                      │  industry: string
        │                      │  primary_language: ar | en
        └──────────┬───────────┘
                   ▼
        ┌──────────────────────┐
        │ Step 4: LinkedIn     │  linkedin_url: optional
        │                      │  OR manual fallback (5 quick Q's)
        └──────────┬───────────┘
                   ▼
        ┌──────────────────────┐
        │ careerProfile.create │  writes career_profile row
        └──────────┬───────────┘
                   ▼
        ┌──────────────────────┐
        │ Complete screen      │  Welcome + single CTA →
        │                      │  /v2/analyze (Sprint 3) or
        │                      │  /v2/home (until Sprint 3 ships)
        └──────────────────────┘
```

---

## Step-by-Step Spec

### Step 1 — Goal
- One question: "What brings you to Wassel?"
- 5 options (radio cards, single select):
  - `job_search` — أبحث عن وظيفة جديدة
  - `promotion` — أسعى للترقية
  - `personal_brand` — أبني حضوري المهني
  - `opportunities` — أستكشف فرصاً مستقبلية
  - `career_change` — أغير مسار مسيرتي
- No "Other" — five buckets cover the space
- Skip not allowed (this is the foundational answer)
- Progress: 1 of 4

### Step 2 — Level
- Question: "Where are you in your career?"
- 4 options:
  - `entry` — مبتدئ (0–2 سنوات)
  - `mid` — متوسط (3–7 سنوات)
  - `senior` — قيادي (8–15 سنة)
  - `executive` — تنفيذي (15+ سنة)
- Single select
- Progress: 2 of 4

### Step 3 — Identity
- Three inputs:
  - **Target role** — text input, required, placeholder "مدير منتج أول"
  - **Industry** — text input with optional suggestions (Fintech, Healthtech, Edtech, Government, Retail, Real Estate, Energy)
  - **Primary language** — radio: AR / EN, default AR
- "اقتراح من تاريخك" link (visible only if the user has any prior LinkedIn analyses) — pre-fills target_role from the most recent analysis if accepted
- Progress: 3 of 4

### Step 4 — LinkedIn (optional)
Two paths:
- **Path A — Link LinkedIn:** Input `linkedin_url`, validate format. If valid, we save it; the actual scrape happens on first Radar run (we don't scrape during onboarding to keep the flow fast).
- **Path B — Skip and answer 5 quick questions:** A small form with `manual_about`, `manual_top_skills` (chip input, max 8), `manual_current_role`, `manual_years_experience`, `manual_education`. Stored as JSON in `career_profile.manual_*` fields.
- "Skip for now" link — saves career_profile without LinkedIn or manual inputs; user can fill later from Settings.
- Progress: 4 of 4

### Complete
- Headline: "تم! بروفايلك المهني جاهز."
- Sub-headline (dynamic): one sentence summarizing what the user just told us
- Primary CTA: **"ابدأ تحليل الرادار الأول"** → `/v2/analyze` (pre-filled, ready to run)
  - *Until Sprint 3 ships the new Radar:* CTA routes to `/v2/home`
- Secondary link: "اذهب إلى الصفحة الرئيسية" → `/v2/home`

---

## State Management

- `OnboardingWizard.tsx` holds local state for all 4 steps (no draft persistence between sessions — onboarding is one continuous flow)
- The Wizard auto-saves to `localStorage` keyed by `userId` so a refresh doesn't lose progress
- The final "Complete" step calls `careerProfile.create(payload)` once, then clears `localStorage`
- Back button works (one step back). Forward button only enabled when current step is valid.

---

## Validation Rules

| Field | Rule |
| --- | --- |
| goal | one of the 5 enum values |
| level | one of the 4 enum values |
| target_role | non-empty, max 80 chars |
| industry | non-empty, max 60 chars |
| primary_language | `ar` or `en` |
| linkedin_url | optional; if present, must match LinkedIn URL pattern |
| manual_about | optional; max 1000 chars |
| manual_top_skills | optional; array of 0–8 strings, each ≤ 40 chars |

Server-side Zod validation matches client-side rules — never trust the client.

---

## Edge Cases

- **User closes browser mid-flow:** localStorage holds state, returning to `/v2/onboarding` resumes
- **User completes onboarding and a `career_profile` row already exists (race condition with parallel signup tab):** treat as `update` not `create`, surface a toast "تم تحديث الملف"
- **User clicks back to step 1 from "Complete":** their answers are preserved; the wizard re-renders with the same state
- **AuthGate logic:** Only redirects to `/v2/onboarding` from inside `/v2/*` protected routes. It does NOT redirect from `/v2/settings/*`, `/v2/billing`, `/v2/me`, or any onboarding-internal route. This prevents a redirect loop.

---

## Settings Surface

Sprint 2 also ships:

### Career Profile (`/v2/settings/career`)
- Editable form for every field in `career_profile`
- View + delete current `section_overrides` (table with role / created / expires / "delete" button)
- "إعادة تعيين البروفايل" — destructive button that requires typed confirmation; clears career_profile (sends the user back to onboarding on next login)

### Privacy & Data (`/v2/settings/privacy`)
- "كيف نستخدم بياناتك" — three short paragraphs of plain-language data explanation
- "مصادر التحليل المُستخدمة + آخر تحديث" — lists the user's LinkedIn URL with its last scrape date
- Buttons:
  - "تحميل بياناتي" — download JSON export
  - "إدارة LinkedIn" — link to a future LinkedIn settings page (Sprint 8)
  - "إدارة الإشعارات" — link to a future notification settings page (Sprint 8)
  - **"حذف كل بياناتي نهائياً"** — danger button, typed confirmation required, calls `careerProfile.delete()`

---

## Telemetry (Sprint 6 wires it, Sprint 2 emits the events)

| Event | Where | Payload |
| --- | --- | --- |
| `onboarding.started` | enter Step 1 | `{}` |
| `onboarding.step_completed` | each step's "next" click | `{ step: 1\|2\|3\|4 }` |
| `onboarding.skipped_linkedin` | Step 4 if skipped | `{}` |
| `onboarding.completed` | "Complete" mount | `{ goal, level, has_linkedin: bool }` |
| `career_profile.updated` | Settings save | `{ fields_changed: string[] }` |
| `career_profile.export` | export click | `{}` |
| `career_profile.delete` | delete confirmation | `{}` |

These events write to `activity_log` (Sprint 6 builds the schema cleanly; Sprint 2 emits as best-effort and tolerates a missing table).

---

## Out of Scope for Sprint 2

- Running an actual scrape during Step 4 (deferred — Radar in Sprint 3 will handle first-run scrape)
- Saving target_role suggestions back to `system_settings` (deferred)
- Avatar upload during onboarding (deferred to Settings)
- LinkedIn OAuth re-flow during Step 4 (deferred — Step 4 only captures the URL, doesn't re-authenticate)
