# Wassel — Language Rules

This document defines the bilingual voice. It is referenced from every prompt in `docs/prompts/` and every UI string in `client/public/locales/{ar,en}/translation.json`.

The rules apply to:
- In-app strings (toasts, buttons, labels, modals, errors)
- AI output (Radar analysis, Resume content, Content posts)
- Marketing copy (Landing, Pricing, Public pages)
- Transactional copy (emails, invoices, exports)

They do NOT apply to user-generated content (the user's own LinkedIn About, their resume entries, etc.) — that text is preserved verbatim.

---

## 1. Bilingual Contract

Every UI string ships with **both** AR and EN keys at the same time. There is no staging period where only one language exists.

```json
// client/public/locales/ar/translation.json
"onboarding.step1.title": "ما هدفك المهني؟"

// client/public/locales/en/translation.json
"onboarding.step1.title": "What is your career goal?"
```

If a feature is committed with only AR keys, the PR is incomplete. If a feature is committed with only EN keys, the PR is incomplete. **R19** made concrete.

---

## 2. Primary Language

**Arabic is the primary language.** This is not just a default — it shapes:
- Layout direction (RTL is the canonical direction)
- Font priority (Thmanyah Sans is shaped for Arabic first)
- Word choice: Arabic copy is *originally* written in Arabic, not translated from English
- Examples and analogies that make sense to a Saudi/GCC professional

English exists for users who actively switch, and for international hires using Wassel from inside a GCC market.

---

## 3. Tone

### Arabic
- Standard Arabic (فصحى مبسطة) — not dialect
- Professional but not stiff. The Wassel voice is the voice of a calm senior colleague, not a corporate brochure
- No religious salutations in opening lines ("السلام عليكم" lives in personal messages, not in product copy)
- No flattery ("نتشرف بخدمتك") — Wassel respects the user's time
- No exclamation marks except in real celebrations (post published, payment succeeded)

### English
- Plain professional. American spelling.
- No marketing jargon ("game-changing", "world-class", "revolutionary")
- Active voice. Short sentences.
- Sentence case for buttons ("Save changes", not "Save Changes")

---

## 4. Forbidden Vocabulary

Already enumerated in `ban-list.md`, restated here for the language angle:

| Forbidden | Use instead |
| --- | --- |
| مجاني | مشمول |
| Free (in pricing) | Included |
| أتمنى أن تكون بخير | (omit — start with the substance) |
| إعادة إنشاء | نسخة جديدة |
| Regenerate | New version |
| Powered by Anthropic / Claude / Apify | (omit — never name vendors) |
| ٠١٢٣٤٥٦٧٨٩ | 0123456789 |

---

## 5. Numerals & Formatting

- **All digits are Western 0–9**, in both Arabic and English UI
- Currency: **"149 ر"** (Arabic) and **"SAR 149"** (English)
- Token counts: **"149 توكن"** (Arabic) and **"149 tokens"** (English)
- Dates: **DD MMM YYYY** in both languages — "12 مايو 2026" / "12 May 2026"
- Times: **24-hour** in both languages — "14:30"
- Percentages: **"%50"** in Arabic, **"50 %"** in English

The translation system has a `formatNumber()` helper to enforce this. Never use `toLocaleString('ar-SA')` — it returns Arabic-Indic digits.

---

## 6. Error Voice

Error messages have three jobs:
1. Tell the user what happened, plainly
2. Suggest what to do about it
3. Never reveal the runtime

Bad:
> Anthropic API returned 529: overloaded_error.

Good (AR):
> الخدمة مشغولة حالياً. حاول من جديد بعد لحظات. لم نخصم أي توكن.

Good (EN):
> The service is busy right now. Try again in a moment. No tokens were spent.

The closing "لم نخصم أي توكن" / "No tokens were spent" is the standard reassurance whenever a failed operation could have consumed wallet tokens.

---

## 7. Pluralization

Arabic plural forms are nuanced (1 / 2 / 3-10 / 11+). Use react-i18next's pluralization. Examples in `translation.json`:

```json
"wallet.tokens_zero":  "لا يوجد توكن",
"wallet.tokens_one":   "توكن واحد",
"wallet.tokens_two":   "توكنان",
"wallet.tokens_few":   "{{count}} توكنات",
"wallet.tokens_many":  "{{count}} توكناً",
"wallet.tokens_other": "{{count}} توكن"
```

English is simpler:

```json
"wallet.tokens_one":   "1 token",
"wallet.tokens_other": "{{count}} tokens"
```

---

## 8. Gender

Arabic verbs and adjectives are gendered. Wassel's user-facing copy defaults to the **masculine singular** unless the user has explicitly set a feminine preference in their profile. The roadmap (Sprint 8) adds an explicit gender switch in Settings → Profile.

For now, copy is masculine singular. Forms that would feel sharp ("اشتركتَ بنجاح") are softened by using passive or impersonal phrasing where natural ("تم تسجيل الاشتراك").

---

## 9. RTL Direction

CSS handles direction via `dir="rtl"` on the document, set from i18n.

Constructs that need extra care:
- Icons with directional meaning (arrows, chevrons) are flipped via `rtl:scale-x-[-1]` Tailwind utility
- Number ranges keep LTR: "100–250 SAR" stays "100–250" in both languages
- Punctuation: Arabic ends with "." (the AR full stop "۔" is not used in the modern professional register Wassel targets)

---

## 10. Translation Key Namespaces

Career Copilot owns the following namespaces (the AI Workforce parallel session owns others, listed in `docs/decisions/A22.md`):

- `onboarding.*` — the 4-step wizard + complete screen
- `careerProfile.*` — settings → career profile page
- `wallets.*` — wallet display + transaction history
- `privacy.*` — settings → privacy & data page
- `radar.*` — Radar UI (Sprint 3, scaffolded)
- `resume.*` — Resume UI (Sprint 4, scaffolded)
- `content.*` — Content UI (Sprint 5, scaffolded)
- `dashboard.*` — Smart Dashboard (Sprint 6, scaffolded)
- `errors.*` — generic error formatter (Sprint 8, scaffolded)

Additive edits only. Never delete a key from `translation.json` without a `docs/decisions/` entry justifying the breakage.
