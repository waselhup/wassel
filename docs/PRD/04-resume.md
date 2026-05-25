# PRD 04 — Resume (السيرة ATS)

**Sprint:** 4 (future).
**Status in this branch:** Scaffolded — prompt written, namespace reserved.

---

## What the Resume Builder Does

Generates an ATS-readable resume **for the user's currently active target role**. The target role comes from:
1. `career_profile.target_role` (default)
2. Active `section_overrides` with `section='resume'` (if present)

If neither exists, the user is prompted to declare a target role for the resume.

---

## Two Operations

| Operation | Cost | Description |
| --- | --- | --- |
| Full build | 179 tokens (per Master Brief; verify with `system_settings`) | Generates the entire resume from scratch for a target role |
| New version for a different role | 49 tokens | Reuses the experience data, re-tailors the language for a new target |

---

## Prompt

`docs/prompts/resume.md` — Sonnet 4.6. The prompt receives `career_profile`, raw experience entries (from LinkedIn scrape + manual additions), the target role, and produces structured resume content matching the output schema.

---

## Output Shape

```ts
type Resume = {
  header: { name; title; location; phone; email; linkedin_url };
  summary: string;                              // 2-4 sentence professional summary
  experience: Array<{
    role: string;
    company: string;
    location?: string;
    start: string;    // YYYY-MM
    end:   string;    // YYYY-MM or 'present'
    bullets: string[];   // 3-5 ATS-optimized bullets
  }>;
  education: Array<{ degree; institution; graduated; honors? }>;
  skills: { hard: string[]; soft: string[] };
  certifications?: Array<{ name; issuer; year }>;
  languages?: Array<{ name; proficiency }>;
  meta: { target_role; version; generated_at };
};
```

---

## Refinement (R12 — first 5 free)

After a build, the user can iterate per-section:
- "اجعل الملخص أقصر"
- "بدّل الفعل الافتتاحي في النقطة الثانية"
- "أضف نقطة عن قيادة الفرق"

The first 5 refinements per document cost zero tokens. Refinement count is per-document (so 3 documents = 15 free refinements available).

Refinement uses Sonnet 4.6 with a focused per-section prompt (sub-prompts inside `docs/prompts/resume.md`).

---

## Export

- **PDF** — 0 tokens. Uses `jspdf` (already in deps).
- **DOCX** — 0 tokens. Uses `docx` (already in deps).
- **JSON** — 0 tokens. Raw export of the structured resume.

---

## ATS Keyword Optimization

Sprint 4 adds a step that, before generation, extracts keywords from a public job description for the target role (sourced from a small curated set of job-description templates, NOT from a third-party scraper). The prompt incorporates these keywords as soft hints, never as keyword stuffing.

---

## Caching

Per A09:
- Key: `(user_id, target_role, profile_hash, version)`
- Store: `resume_cache`
- TTL: until inputs change

---

## UI Outline (Sprint 4 builds)

- `/v2/cvs` — list of existing resumes with version chips per target role
- `/v2/cvs/new` — target role selector (auto-fills from `career_profile`) + build button
- `/v2/cvs/:id` — split view: structured resume on left, refinement controls on right
- Export buttons in the top bar

---

## Migration of Existing CVs

Existing CVs in the database (pre-Copilot) are kept as-is but flagged `legacy=true`. They display in the list but can't be refined; a banner suggests "ابدأ نسخة جديدة لدور مستهدف".
