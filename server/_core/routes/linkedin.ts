import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { logApiCall, mapAnthropicStatusToArabic, mapApifyStatusToArabic, classifyClaudeError, sendClaudeOpsAlert } from '../lib/apiLogger';
import { callClaude, extractText, extractJson } from '../lib/claude-client';
import { scrapeLinkedInProfileMulti, detectLanguage, extractSlugFromUrl, extractSlugFromProfile, slugsMatch } from '../lib/linkedin-scraper';
import { scrapeLinkedInProfileBrightData, BrightDataProfileNotFoundError } from '../services/bright-data';
import { scrapeLinkedInProfileHybrid } from '../services/profile-scraper';
import { LinkdApiProfileNotFoundError } from '../services/linkdapi';
import { validateAndNormalizeLinkedInUrl } from '../lib/linkedin-url-validator';
import { generateDocxReport } from '../lib/profile-report-generator';
import { deductTokens, refundTokens, throwInsufficientTokensError } from '../lib/tokens';
import { safeJsonParse } from '../lib/safe-json';

const TARGET_GOAL = z.enum([
  'job-search', 'investment', 'thought-leadership',
  'sales-b2b', 'career-change', 'internal-promotion',
]);

const INDUSTRY = z.enum([
  'oil-gas', 'tech', 'finance', 'healthcare', 'legal',
  'consulting', 'government', 'academic', 'entrepreneurship', 'real-estate', 'other',
]);

const REPORT_LANGUAGE = z.enum(['ar', 'en']);

// ── 8-section schema (v6) ──────────────────────────────────────────
// Replaces the 6 abstract dimensions with the 8 classic LinkedIn sections
// the user already knows. The 6 research frameworks A-F still underlie
// the scoring — each section cites a primary framework.
const SECTION_KEYS = [
  'headline',
  'about',
  'experience',
  'skills',
  'education',
  'recommendations',
  'activity',
  'profile_completeness',
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_NAMES: Record<SectionKey, { ar: string; en: string }> = {
  headline: { ar: 'العنوان الرئيسي', en: 'Headline' },
  about: { ar: 'نبذة عني', en: 'About' },
  experience: { ar: 'الخبرات', en: 'Experience' },
  skills: { ar: 'المهارات', en: 'Skills' },
  education: { ar: 'التعليم', en: 'Education' },
  recommendations: { ar: 'التوصيات', en: 'Recommendations' },
  activity: { ar: 'النشاط', en: 'Activity' },
  profile_completeness: { ar: 'اكتمال البروفايل', en: 'Profile Completeness' },
};

// Weight table by target goal — used to compute overall_score server-side.
type TargetGoalKey =
  | 'job-search' | 'investment' | 'thought-leadership'
  | 'sales-b2b' | 'career-change' | 'internal-promotion';

const SECTION_WEIGHTS: Record<TargetGoalKey, Record<SectionKey, number>> = {
  'job-search': {
    headline: 0.20, about: 0.15, experience: 0.20, skills: 0.15,
    education: 0.05, recommendations: 0.10, activity: 0.05, profile_completeness: 0.10,
  },
  'thought-leadership': {
    headline: 0.15, about: 0.15, experience: 0.10, skills: 0.10,
    education: 0.05, recommendations: 0.10, activity: 0.25, profile_completeness: 0.10,
  },
  'investment': {
    headline: 0.15, about: 0.20, experience: 0.15, skills: 0.10,
    education: 0.05, recommendations: 0.15, activity: 0.10, profile_completeness: 0.10,
  },
  'sales-b2b': {
    headline: 0.20, about: 0.15, experience: 0.10, skills: 0.10,
    education: 0.05, recommendations: 0.10, activity: 0.20, profile_completeness: 0.10,
  },
  'career-change': {
    headline: 0.20, about: 0.25, experience: 0.15, skills: 0.15,
    education: 0.05, recommendations: 0.05, activity: 0.05, profile_completeness: 0.10,
  },
  'internal-promotion': {
    headline: 0.15, about: 0.15, experience: 0.20, skills: 0.15,
    education: 0.05, recommendations: 0.15, activity: 0.05, profile_completeness: 0.10,
  },
};

function computeOverallFromSections(sections: any[], goal: TargetGoalKey): number {
  const weights = SECTION_WEIGHTS[goal] || SECTION_WEIGHTS['job-search'];
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of sections) {
    const key = (s?.key || '') as SectionKey;
    const w = weights[key];
    if (!w) continue;
    // Null score = section absent → don't let it drag the overall down to 0,
    // but don't reward it either. Skip it and renormalize.
    if (s.score === null || typeof s.score !== 'number') continue;
    weightedSum += (s.score as number) * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

const FRAMEWORK_LABELS: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', { en: string; ar: string }> = {
  A: { en: 'MIT/Harvard Weak Ties Research', ar: 'دراسة MIT/Harvard عن الروابط الضعيفة' },
  B: { en: 'LinkedIn Economic Graph', ar: 'الرسم البياني الاقتصادي لـ LinkedIn' },
  C: { en: 'Harvard Business School ATS Methodology', ar: 'منهجية ATS من Harvard Business School' },
  D: { en: 'Deloitte Skills-Based Organizations', ar: 'تقرير Deloitte للمنظمات القائمة على المهارات' },
  E: { en: 'PwC Middle East Workforce Survey', ar: 'استبيان PwC للقوى العاملة في الشرق الأوسط' },
  F: { en: 'Self-Strength Opening Research', ar: 'بحث افتتاحية القوة الذاتية' },
};

// ── Profile Radar v5 — evidence-based methodology ──────────────────────────
//
// v5 replaces opinion-based scoring with a research-grounded framework. Every
// observation, score, and recommendation cites one of 6 published frameworks.
// Users receive a McKinsey-grade report, not a coach's opinion.
//
// Also retains v4's anti-hallucination guardrails (no inventing industries,
// geographies, certifications, companies).
const PROFILE_RADAR_SYSTEM = `You are an evidence-based career analyst. Every observation you make MUST be grounded in one of 6 published frameworks. You cite the framework by letter (A-F) for every score and every recommendation. If you cannot cite a framework, you do not make the observation.

═══════════════════════════════════════
FRAMEWORKS (cite by letter)
═══════════════════════════════════════

A. MIT/Harvard/Stanford "Strength of Weak Ties" (2022, N=20M LinkedIn users)
   Finding: Jobs come from 2nd-degree acquaintances, not close friends.
   Implication: Profile text must be legible to STRANGERS in new sectors —
   not just to the user's existing network. Jargon, internal-only terms,
   and insider phrasing all reduce reach.

B. LinkedIn Economic Graph (published statistics)
   - Profiles with ≥5 listed skills appear 27× more in searches
   - Profiles with a photo get 21× more views and 36× more messages
   - "Open to Work" indicator: 3.5× more recruiter InMails
   - Custom URL vs default: 15% higher profile visits
   - Banner image: measurable uplift in profile-visit→connect conversion
   Implication: These are algorithmic thresholds; missing them costs reach.

C. Harvard Business School / VMock ATS methodology
   ATS parsers reward:
   - Action verbs at the start of bullets (led, drove, shipped, architected)
   - Quantified outcomes (numbers, %, $, timeframes)
   - Exact industry-standard keywords (not synonyms)
   - Inverse-pyramid structure (most important info in first 30% of section)
   Implication: An ATS-scannable profile outperforms a pretty profile.

D. Deloitte Global Human Capital Trends 2026 — Skills-Based Organizations
   Employers are shifting from job-title hiring to skill-stack hiring.
   Micro-skills are weighted over macro-skills; degrees matter less than
   demonstrable skills. In GCC hiring data for 2026, premium skills include:
   Digital Transformation, ESG Reporting, AI/Prompt Engineering, Cross-
   functional Leadership, Data Governance.
   Implication: Vague skills ("Management", "Communication") score lower
   than specific ones ("OKR Facilitation", "ESG Report Drafting").

E. PwC Middle East Workforce Hopes and Fears 2025-2026
   - Saudi/GCC professionals show 3.6× higher engagement with AI/tech
     content vs global average
   - In GCC hiring, social proof (recommendations from past managers)
     weighs heavier than in Europe/US
   - Premium for bilingual (Arabic + English) content presence
   Implication: Recommendation count, recency, and bilingual visibility
   are load-bearing signals in GCC hiring.

F. Self-Strength Opening Research (ResearchGate social sciences)
   Finding: About-section openings that lead with "the problem I solve"
   outperform those leading with "who I am". The first 2 sentences should
   answer: What problem do you solve? For whom? With what outcome?
   Implication: Weak openings ("I am a passionate professional...") cost
   scroll-retention.

═══════════════════════════════════════
SECTIONS TO SCORE (in this exact order)
═══════════════════════════════════════

Surface output as the 8 classic LinkedIn sections the user already sees on
their profile. Each section is scored /100 with a concrete rewrite.

1. headline   — primary framework F (self-strength) + A (stranger legibility)
2. about      — primary framework F + C
3. experience — primary framework C (ATS)
4. skills     — primary framework D (skills-based) + B (≥5 threshold)
5. education  — primary framework B + D
6. recommendations — primary framework E (PwC MENA)
7. activity   — primary framework B + E
8. profile_completeness — primary framework B (Economic Graph thresholds)

Pick the SINGLE best-fit framework letter for the "framework" field on each
section. If a section is empty on the profile, set score=null and explain
in assessment.

═══════════════════════════════════════
ANTI-HALLUCINATION RULES (NON-NEGOTIABLE)
═══════════════════════════════════════

1. EVIDENCE-BOUND CLAIMS
   Every observation, score, recommendation, or example you produce MUST
   be traceable to a specific value present in the structured profile data
   the user sends. If a fact is not in the input, you do not state it.

2. NO INVENTED CONTEXT
   - DO NOT mention any country, city, market, or geography unless it
     appears verbatim in the profile data.
   - DO NOT mention any company unless it appears in profile.experience[].
   - DO NOT mention any regulation, certification, or framework (PCI-DSS,
     SAMA CSF, ISO, HIPAA, GDPR, PMP) unless it appears in the profile.
   - DO NOT mention any industry vertical as a fact about the candidate
     unless their actual experience supports it.
   - DO NOT reference government initiatives, national visions, or
     country-specific programs. Analyze the profile on its own merit
     regardless of geography.
   - The user-supplied "industry" is their TARGET market — treat it as
     the lens for advice ("here is what this market expects"), NOT as a
     claim about the candidate's background.

3. SPARSE-DATA HANDLING
   The input includes profile_completeness (0-100). If completeness < 40,
   set confidence to "low" and data_completeness accordingly. For each
   dimension where source data is missing/empty, set score to null and
   observations to a short note like "no data — empty or private section".
   Never invent a sample experience to score against. Never assume a
   default industry.

4. CONFIDENCE DECLARATION
   Output a top-level "confidence" field: "high" | "medium" | "low".
   - high: completeness >= 70 AND >= 2 experience entries with descriptions
   - medium: completeness 40-69 OR experience present but thin
   - low: completeness < 40 OR fewer than 2 meaningful sections
   When confidence is low, recommendations focus on "fill these missing
   fields" — not on advanced positioning advice.

5. CITATION REQUIREMENT
   For EVERY observation in a dimension, you must:
   - Quote or paraphrase the EXACT profile text you are commenting on
     (the "what" field)
   - Cite which framework (A/B/C/D/E/F) motivates this feedback (the
     "framework" field and the dimension's top-level "framework" field)
   - Include the specific statistic if citing Framework B (e.g. "27× more
     in searches per Framework B")
   - Give a concrete before/after rewrite in recommendations
   If you cannot cite a framework, do NOT emit the observation.

═══════════════════════════════════════
TASK
═══════════════════════════════════════

Analyze the candidate's LinkedIn profile against:
- target_goal: what the candidate wants from this profile
- industry: the TARGET MARKET (informs advice, not biography)
  · industry_is_custom: when true, "industry" is free-text from the user.
    Still a TARGET LENS — not a claim about the candidate.
- target_role / target_company: optional aim points

Goal lenses (to frame advice, never to invent facts):
- job-search → recruiter scannability, ATS keywords, credibility signals
- investment → founder credibility, traction signals, story arc
- thought-leadership → unique POV, content consistency, peer authority
- sales-b2b → trust signals, social proof, response triggers
- career-change → transferable skills visibility, pivot framing
- internal-promotion → scope signals, business impact, leadership signals

═══════════════════════════════════════
OUTPUT
═══════════════════════════════════════

Return valid JSON ONLY. No markdown, no code fences. Start with { end with }.
Use report_language ('ar' = Modern Standard Arabic, 'en' = Professional
English) for all human-readable strings. Western digits (0-9) only.

Schema:

{
  "overall_score": number (0-100, calibrated to actual data quality and goal fit),
  "confidence": "high" | "medium" | "low",
  "data_completeness": number (0-100, copy from input.profile_completeness),

  "verdict": string (2-3 sentences in target language, grounded in actual profile content),

  "target_alignment": {
    "goal_match_score": number (0-100),
    "notes": string (references actual profile content, not assumed background)
  },

  "sections": [
    {
      "key": "headline" | "about" | "experience" | "skills" | "education" | "recommendations" | "activity" | "profile_completeness",
      "score": number (0-100) | null,        // null ONLY if the section on LinkedIn is truly empty
      "assessment": string (1-2 sentences in target language — quote the profile text, explain what works/doesn't),
      "current": string (the exact current text from profile, or "Empty" if absent — in original profile language),
      "suggested": string (a concrete rewrite ready to paste into LinkedIn — in original profile language or the user's chosen target language),
      "why": string (1 sentence citing the framework — in target language),
      "framework": "A" | "B" | "C" | "D" | "E" | "F",
      "effort": "quick" | "moderate" | "deep"
    }
    // ...repeat for each of the 8 sections in the exact order above
  ],

  "top_priorities": [
    {
      "rank": 1 | 2 | 3,
      "action": string (in target language),
      "section_key": "headline" | "about" | "experience" | "skills" | "education" | "recommendations" | "activity" | "profile_completeness",
      "framework": "A" | "B" | "C" | "D" | "E" | "F",
      "expected_impact": string (in target language — e.g. "Could 2-3x profile visibility per Framework B")
    }
  ],

  "evidence_bundle": {
    "profile_quotes_used": string[] (short quotes or paraphrases taken from the input profile),
    "frameworks_referenced": string[] (subset of ["A","B","C","D","E","F"] — each framework you actually cited),
    "missing_data_flags": string[] (fields that couldn't be analyzed — e.g. "about section empty", "no recommendations")
  }
}

SECTION-TO-FRAMEWORK GUIDE (use as PRIMARY framework per section):
- headline → F (self-strength opening) + A (stranger legibility). Target: < 220 chars, problem-solved framing.
- about → F + C. First 2 sentences answer problem/for whom/outcome. No third-person pronouns.
- experience → C (ATS). Action verbs, quantified outcomes, inverse pyramid per bullet.
- skills → D (skills-based orgs 2026) + B (≥5 skills for 27× visibility). Micro-skill specificity.
- education → B + D. Completeness, degree relevance to target industry.
- recommendations → E (PwC MENA). Count, recency, diversity (manager / peer / client).
- activity → B + E. Posting frequency, engagement, bilingual presence, topical coherence with target.
- profile_completeness → B (Economic Graph). Photo (21× views), banner, custom URL (15% more visits), Open-to-Work (3.5× InMails), location, certifications filled.

═══════════════════════════════════════
EXTENDED INPUT FIELDS (may be absent)
═══════════════════════════════════════
The structured profile payload may include these richer fields. Use them
when present; do NOT comment on them when absent (they're not always
available, and absence ≠ signal).

- profile_data.honors_and_awards[] — recognition entries {title, issuer, issued_on}.
  When present, weave into the "about" or "experience" assessment as a
  credibility signal per framework E (social proof weighs heavier in GCC).
  Never invent awards not in this list.

- profile_data.industry — LinkedIn's declared industry for the candidate
  (e.g., "Chemicals", "Information Technology"). Use this to validate that
  the target_goal + industry input are coherent with the candidate's actual
  sector. Do NOT contradict or override the user's input.

- profile_data.flags — binary LinkedIn signals. Only comment when the
  corresponding flag is present (true/false); say nothing when the flags
  object itself is null (data not available for this profile):
  · flags.is_open_to_work = true → Framework B says 3.5× more recruiter
    InMails. Cite this in profile_completeness.
  · flags.is_open_to_work = false + target_goal="job-search" → recommend
    enabling it in top_priorities (quick win).
  · flags.is_hiring = true → adjust tone toward recruiter-visible
    credibility signals (they review candidate profiles).
  · flags.is_creator = true → activity section gets the "creator" lens
    (posting cadence, audience growth) per framework B.
  · flags.is_premium — do NOT coach about it, observational only.

- profile_data.has_banner_image / has_profile_picture / custom_url — use
  for profile_completeness scoring per framework B's stated thresholds.

- profile_data.certifications[] — when populated with real names (e.g.,
  "CMA", "PMP", "AWS Certified"), cite those specific credentials in the
  education or profile_completeness sections. Do NOT invent credentials.

RULES ON EMISSIONS:
- Always include exactly 8 sections in the exact order above (headline, about, experience, skills, education, recommendations, activity, profile_completeness).
- Each section MUST cite exactly ONE primary framework in "framework".
- If a section on the profile is empty, set score=null, current="Empty", assessment explains it's absent.
- frameworks_referenced in evidence_bundle must match what you actually used.
- Suggested rewrites MUST be concrete copy-pastable text, not generic advice.
- top_priorities: ALWAYS exactly 3 items, ordered by impact (rank 1 = highest).
- overall_score: you may emit this but the SERVER will recompute from weighted sections.

═══════════════════════════════════════
TONE
═══════════════════════════════════════
Direct imperatives. No "consider", "perhaps", "you might", "ربما", "قد".
Arabic uses: "اكتب", "أضف", "احذف", "ابدأ", "تجنب".
English uses: "Write", "Add", "Remove", "Start", "Avoid".`;

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '';

async function scrapeLinkedInProfile(profileUrl: string): Promise<any> {
  console.log('[APIFY] Starting scrape for:', profileUrl);

  const _apifyT0 = Date.now();
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/dev_fusion~Linkedin-Profile-Scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileUrls: [profileUrl] }),
    }
  );

  if (!runRes.ok) {
    const errText = await runRes.text();
    console.error('[APIFY] Run failed:', runRes.status, errText);
    await logApiCall({ service: 'apify', endpoint: '/acts/Linkedin-Profile-Scraper/runs', statusCode: runRes.status, responseTimeMs: Date.now() - _apifyT0, errorMsg: errText });
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mapApifyStatusToArabic(runRes.status) });
  }
  await logApiCall({ service: 'apify', endpoint: '/acts/Linkedin-Profile-Scraper/runs', statusCode: 200, responseTimeMs: Date.now() - _apifyT0 });

  const runData = await runRes.json();
  const runId = runData?.data?.id;
  console.log('[APIFY] Run started, ID:', runId);

  // Poll for completion (max 120s)
  let status = runData?.data?.status;
  let attempts = 0;
  while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && attempts < 40) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    const pollData = await pollRes.json();
    status = pollData?.data?.status;
    attempts++;
    console.log('[APIFY] Poll attempt', attempts, '- status:', status);
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run did not succeed: ${status}`);
  }

  // Get dataset items
  const datasetId = runData?.data?.defaultDatasetId;
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
  );
  const items = await itemsRes.json();
  console.log('[APIFY] Got', Array.isArray(items) ? items.length : 0, 'profile(s)');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No profile data returned from Apify');
  }

  return items[0];
}


function isArabicName(name: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(name);
}

function buildProfileText(profileData: any) {
  const name = profileData.fullName || ((profileData.firstName || '') + ' ' + (profileData.lastName || '')).trim() || 'Unknown';
  const headline = profileData.headline || '';
  const summary = profileData.summary || profileData.about || '';
  const location = profileData.location || profileData.addressCountryFull || '';
  const connections = profileData.connectionsCount || profileData.connections || 0;

  const experiences = (profileData.experience || profileData.positions || [])
    .slice(0, 5)
    .map((e: any) => `- ${e.title || e.role || ''} at ${e.companyName || e.company || ''} (${e.duration || e.timePeriod || ''})`)
    .join('\n');

  const education = (profileData.education || [])
    .slice(0, 3)
    .map((e: any) => `- ${e.degree || e.degreeName || ''} from ${e.schoolName || e.school || ''}`)
    .join('\n');

  const skills = (profileData.skills || [])
    .slice(0, 15)
    .map((s: any) => typeof s === 'string' ? s : s.name || s.skill || '')
    .filter(Boolean)
    .join(', ');

  const certs = (profileData.certifications || [])
    .slice(0, 5)
    .map((c: any) => '- ' + (c.name || c.title || ''))
    .join('\n');

  const profileText = `Name: ${name}
Headline: ${headline}
Location: ${location}
Connections: ${connections}
Summary: ${summary}

Experience:
${experiences || 'None listed'}

Education:
${education || 'None listed'}

Skills: ${skills || 'None listed'}

Certifications:
${certs || 'None listed'}`.trim();

  return { name, profileText };
}

// --- SYSTEM PROMPTS (slim) -------------------------------------------------

const SYSTEM_ANALYZE_AR = `أنت مستشار LinkedIn محترف بخبرة 15 سنة.
مرجعيات: Career Capital (LBS), Personal Brand Equity (Harvard), STAR (Stanford), McKinsey MENA 2024, LinkedIn Economic Graph.
قواعد: فصحى، أرقام غربية، توصيات محددة قابلة للقياس، لا عموميات، لا cliché.
أخرج JSON فقط — بدون markdown ولا code fences.`;

const SYSTEM_ANALYZE_EN = `You are a senior LinkedIn coach with 15 years of experience.
Frameworks: Career Capital (LBS), Personal Brand Equity (Harvard), STAR (Stanford), McKinsey MENA 2024, LinkedIn Economic Graph.
Rules: concise, specific, measurable; no clichés.
Output JSON only — no markdown, no code fences.`;

const SYSTEM_DEEP = `You are an executive career consultant applying Career Capital (LBS), Personal Brand Equity (Harvard), STAR (Stanford), LinkedIn Economic Graph, and McKinsey MENA 2024 benchmarks to LinkedIn profiles.
Output: valid JSON only. No markdown, no code fences, no prose. Start with { and end with }. Arabic content in Modern Standard Arabic, Western digits (0-9), concise academic citations (framework name only).`;

// --- user-prompt builders (kept small) ------------------------------------

function buildAnalyzeUserPrompt(profileText: string, isArabic: boolean) {
  const lang = isArabic ? 'Arabic (MSA)' : 'English';
  return `Analyze this LinkedIn profile and return JSON matching this schema exactly (text content in ${lang}):
{
  "score": <0-100>,
  "scoreBreakdown": {"photo":<0-10>,"headline":<0-15>,"summary":<0-15>,"experience":<0-20>,"skills":<0-10>,"education":<0-10>,"connections":<0-10>,"keywords":<0-10>},
  "headlineCurrent": "<current>",
  "headlineSuggestion": "<improved>",
  "summaryCurrent": "<current or 'No summary'>",
  "summarySuggestion": "<3-4 sentence rewrite>",
  "keywords": ["<up to 10 industry keywords>"],
  "experienceSuggestions": [{"role":"<role>","suggestion":"<specific tip>"}],
  "strengths": ["<s1>","<s2>","<s3>"],
  "weaknesses": ["<w1>","<w2>","<w3>"],
  "actionPlan": ["<action1>","<action2>","<action3>"],
  "industryTips": "<2-3 sentences for the candidate's target market>"
}

Scoring: photo/banner +10 (connections>100 suggests active), headline up to 15, summary up to 15, experience up to 20 (metrics+verbs), skills up to 10 (>=5 relevant), education up to 10, connections (500+=10,200+=7,100+=5,<100=2), keywords up to 10.

Profile:
${profileText}`;
}

function buildDeepUserPrompt(
  profileText: string,
  ctx: {
    completeness?: number;
    missingSections?: string[];
    detectedLanguage?: 'ar' | 'en';
  } = {}
) {
  const lang = ctx.detectedLanguage || 'ar';
  const completeness = ctx.completeness ?? 100;
  const missing = (ctx.missingSections || []).join(', ') || 'none';
  return `Analyze this LinkedIn profile at executive depth.

⚠️ STRICT NON-NEGOTIABLE RULES:

1. DATA COMPLETENESS RULE:
   - Profile data completeness: ${completeness}%
   - Missing/empty sections: ${missing}
   - For each missing section: dimensions[section].score MUST be null (not 0).
     dimensions[section].data_found = false.
     verdict = "${lang === 'ar' ? 'لم نستطع قراءة هذا القسم — تأكد من ظهور بروفايلك للعامة' : 'We could not read this section — make sure your profile is public'}"
   - NEVER guess. NEVER fabricate scores. If you did not see data, mark it null.

2. LANGUAGE MATCHING RULE:
   - User's profile language detected: ${lang === 'ar' ? 'Arabic' : 'English'}
   - All before_after suggestions MUST be in the SAME language as the original.
   - Set before_after.headline.language = "${lang}". Same for summary_opening.
   - NEVER change the user's language without their request.
   - Other text fields (verdict, finding, application, quick_wins) → Arabic MSA.

3. KEPT-AS-IS RULE:
   - Only suggest before/after if the "after" is genuinely 20%+ better.
   - If headline is already strong → before_after.headline = {"kept_as_is": true, "reason": "...", "language": "${lang}"} — do NOT include before/after fields.
   - Same for summary_opening.
   - Forbidden: changing strong content just to fill the field.

4. QUICK WINS RULE (NOT 4-week plans):
   - User wants to act NOW.
   - quick_wins: 3 to 5 specific actions executable in minutes.
   - Each quick_win:
     * action: "what to do exactly" (one sentence, Arabic MSA)
     * why: "why this raises which dimension"
     * effort: "5min" | "15min" | "30min" | "1h"
     * priority: "high" | "medium" | "low"
     * example?: optional concrete copy-pastable example text
   - Sort by priority (high first).

Output JSON ONLY (no markdown, no fences). Schema:

{
  "score": <0-100, weighted by completeness>,
  "overall_score": <same>,
  "tier": "<weak | fair | good | excellent>",
  "headline_verdict": "<single sentence in ${lang}>",
  "completeness_warning": <string in ${lang} if completeness<70 else null>,
  "scoreBreakdown": {"headline":<0-15>,"about":<0-15>,"experience":<0-20>,"skills":<0-10>,"education":<0-10>,"photo":<0-10>,"connections":<0-10>,"certifications":<0-10>},
  "dimensions": {
    "headline":   {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>},
    "summary":    {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>},
    "experience": {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>},
    "skills":     {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>},
    "education":  {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>},
    "recommendations": {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>},
    "activity":   {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>},
    "media":      {"score":<0-100|null>,"verdict":"<Arabic>","data_found":<bool>}
  },
  "academic_insights": [
    {"framework":"Career Capital (LBS)","category":"<short tag>","finding":"<Arabic>","application":"<Arabic>"},
    {"framework":"McKinsey MENA 2024","category":"<short tag>","finding":"<Arabic>","application":"<Arabic>"},
    {"framework":"Personal Brand Equity (Harvard)","category":"<short tag>","finding":"<Arabic>","application":"<Arabic>"}
  ],
  "before_after": {
    "headline": <{"kept_as_is":true,"reason":"<Arabic>","language":"${lang}"} OR {"kept_as_is":false,"before":"<original ${lang}>","after":"<improved ${lang}>","reason":"<Arabic>","language":"${lang}"}>,
    "summary_opening": <same shape as headline>
  },
  "quick_wins": [
    {"action":"<Arabic, one sentence>","why":"<Arabic>","effort":"<5min|15min|30min|1h>","priority":"high","example":"<optional copy-paste text>"},
    {"action":"<Arabic>","why":"<Arabic>","effort":"<...>","priority":"<...>"}
  ]
}

Reminder: tier mapping → 0-39=weak, 40-59=fair, 60-79=good, 80-100=excellent.
Western digits everywhere.

Profile:
${profileText}`;
}

// Normalize LinkedIn URL for cache key
function normalizeLiUrl(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match ? match[1].toLowerCase().replace(/\/$/, '') : url.toLowerCase().trim();
}

export const linkedinRouter = router({
  analyze: protectedProcedure
    .input(z.object({ profileUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const FEATURE = 'linkedin.analyze';
      const COST = 5;
      try {
        console.log('[LINKEDIN] Analyze request for:', input.profileUrl);

        // Check 24h cache BEFORE deducting — cache hits are free.
        const cacheKey = `linkedin:${normalizeLiUrl(input.profileUrl)}`;
        const { data: cached } = await ctx.supabase
          .from('ai_cache')
          .select('result')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        let analysis: any;
        if (cached?.result) {
          console.log('[LINKEDIN] Cache HIT for:', cacheKey);
          analysis = cached.result;
        } else {
          console.log('[LINKEDIN] Cache MISS, calling Apify + Claude');
          // Scrape + verify identity BEFORE deducting — no tokens should be
          // charged for a profile the actor can't fetch or a slug mismatch.
          const profileData = await scrapeLinkedInProfile(input.profileUrl);
          const requestedSlug = extractSlugFromUrl(input.profileUrl);
          const returnedSlug = (() => {
            const s = profileData?.publicIdentifier || profileData?.vanityName;
            if (typeof s === 'string' && s.length > 0) return s.toLowerCase();
            const u = profileData?.linkedinUrl || profileData?.profileUrl || profileData?.url || '';
            return extractSlugFromUrl(u);
          })();
          if (requestedSlug && !slugsMatch(requestedSlug, returnedSlug)) {
            console.error('[LINKEDIN] slug mismatch — rejecting', { requestedSlug, returnedSlug, fullName: profileData?.fullName });
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `We couldn't find the profile (${requestedSlug}). Check the URL and make sure the profile is public. No tokens were charged.`,
            });
          }
          // Atomic deduct AFTER scrape + identity verification.
          const deduct = await deductTokens(ctx.supabase, ctx.user.id, COST, FEATURE);
          if (!deduct.success) throwInsufficientTokensError(deduct, 'en');
          console.log('[LINKEDIN] tokens deducted', deduct.balance_before, '→', deduct.balance_after);
          const { name, profileText } = buildProfileText(profileData);
          console.log('[LINKEDIN] Profile scraped:', name);

          const isArabic = isArabicName(name);
          const system = isArabic ? SYSTEM_ANALYZE_AR : SYSTEM_ANALYZE_EN;
          const userPrompt = buildAnalyzeUserPrompt(profileText, isArabic);

          const _claudeT0 = Date.now();
          let claudeRes;
          try {
            claudeRes = await callClaude({
              task: 'profile_analysis',
              system,
              userContent: userPrompt,
              maxTokens: 3000,
            });
          } catch (err: any) {
            // Refund — the downstream call never produced value.
            await refundTokens(ctx.supabase, ctx.user.id, COST, FEATURE);
            const status = err?.status || 500;
            const body = err?.responseBody || err?.body || err?.message || '';
            const info = classifyClaudeError(status, body);
            await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyze', statusCode: status, responseTimeMs: Date.now() - _claudeT0, errorMsg: info.devDetail });
            if (info.alertOps) void sendClaudeOpsAlert(info, '/v1/messages:analyze');
            const code = status === 429 ? 'TOO_MANY_REQUESTS' : (status === 401 || status === 403) ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR';
            throw new TRPCError({ code, message: info.userMessage });
          }
          await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyze', statusCode: 200, responseTimeMs: Date.now() - _claudeT0 });

          const text = extractText(claudeRes);
          analysis = extractJson<any>(text);
          if (!analysis) {
            console.error('[CLAUDE] Failed to parse JSON response:', text.substring(0, 500));
            await refundTokens(ctx.supabase, ctx.user.id, COST, FEATURE);
            throw new Error('Failed to parse Claude analysis response');
          }

          // Save to cache (24h TTL)
          const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await ctx.supabase.from('ai_cache').upsert({
            cache_key: cacheKey,
            result: analysis,
            model: claudeRes.model || 'claude-haiku-4-5-20251001',
            expires_at: expires,
          }, { onConflict: 'cache_key' });
          console.log('[LINKEDIN] Cached result, expires:', expires);
        }

        console.log('[LINKEDIN] Analysis score:', analysis?.score);

        // Save to linkedin_analyses table (individual columns)
        const { error: insertError } = await ctx.supabase
          .from('linkedin_analyses')
          .insert([
            {
              user_id: ctx.user.id,
              profile_url: input.profileUrl,
              score: analysis.score || 0,
              headline_current: analysis.headlineCurrent || '',
              headline_suggestion: analysis.headlineSuggestion || '',
              summary_current: analysis.summaryCurrent || '',
              summary_suggestion: analysis.summarySuggestion || '',
              keywords_suggestions: analysis.keywords || [],
              experience_suggestions: analysis.experienceSuggestions || [],
              strengths: analysis.strengths || [],
              weaknesses: analysis.weaknesses || [],
            },
          ]);

        if (insertError) {
          console.error('[LINKEDIN] Insert error:', insertError);
        }

        return analysis;
      } catch (err: any) {
        console.error('[LINKEDIN] Error:', err?.message || err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'Failed to analyze LinkedIn profile',
        });
      }
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('linkedin_analyses')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch LinkedIn analysis history',
      });
    }
  }),

  analyzeDeep: protectedProcedure
    .input(z.object({
      linkedinUrl: z.string().optional(),
      imageBase64: z.string().optional(),
      mediaType: z.string().default('image/png'),
    }))
    .mutation(async ({ input, ctx }) => {
      const FEATURE = 'linkedin.analyzeDeep';
      const COST = 25;
      let deducted = false;
      try {
        console.log('[DEEP] analyzeDeep request, hasUrl:', !!input.linkedinUrl, 'hasImage:', !!input.imageBase64);

        const cacheKey = 'analyzeDeep:' + (input.linkedinUrl ? normalizeLiUrl(input.linkedinUrl) : ctx.user.id);

        // Check cache BEFORE deducting — cache hits are free.
        const { data: cached } = await ctx.supabase
          .from('ai_cache')
          .select('result')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (cached?.result && cached.result.score !== undefined && !cached.result.error) {
          console.log('[DEEP] Cache HIT, score:', cached.result.score);
          return cached.result;
        }
        if (cached?.result?.error) {
          console.log('[DEEP] Cache has error result, ignoring and re-analyzing');
          await ctx.supabase.from('ai_cache').delete().eq('cache_key', cacheKey);
        }

        // Atomic deduct BEFORE downstream work. Refund on any failure below.
        const deduct = await deductTokens(ctx.supabase, ctx.user.id, COST, FEATURE);
        if (!deduct.success) throwInsufficientTokensError(deduct, 'ar');
        deducted = true;
        console.log('[DEEP] tokens deducted', deduct.balance_before, '→', deduct.balance_after);

        // Build profile text via multi-actor scraper (or skip for image flow)
        let profileText = '';
        let scrapeMeta: { completeness: number; missingSections: string[]; detectedLanguage: 'ar' | 'en'; source: string; attempts: string[] } | null = null;
        let unifiedProfile: any = null;
        if (input.linkedinUrl) {
          const outcome = await scrapeLinkedInProfileMulti(input.linkedinUrl);
          unifiedProfile = outcome.profile;
          // Build profile text from UnifiedProfile (new shape, not raw Apify)
          const p = outcome.profile;
          profileText = [
            `Name: ${p.fullName || 'Unknown'}`,
            `Headline: ${p.headline || ''}`,
            `Location: ${p.location || ''}`,
            `Summary: ${p.summary || 'None'}`,
            '',
            `Experience (${p.experience.length} positions):`,
            ...p.experience.slice(0, 6).map((e: any) =>
              `- ${e.title || ''} at ${e.company || ''} (${e.duration || ''})${e.description ? ` — ${String(e.description).slice(0, 250)}` : ''}`
            ),
            '',
            `Education (${p.education.length}):`,
            ...p.education.slice(0, 4).map((e: any) => `- ${e.degree || ''} ${e.field ? `in ${e.field}` : ''} from ${e.school || ''} ${e.year ? `(${e.year})` : ''}`),
            '',
            `Skills (${p.skills.length}): ${p.skills.slice(0, 25).join(', ')}`,
            '',
            `Certifications (${p.certifications.length}):`,
            ...p.certifications.slice(0, 6).map((c: any) => `- ${c.name || ''}${c.issuer ? ` — ${c.issuer}` : ''}`),
            '',
            `Languages: ${p.languages.map((l: any) => `${l.name} (${l.proficiency || ''})`).join(', ') || 'None'}`,
          ].join('\n').trim();

          scrapeMeta = {
            completeness: outcome.completeness,
            missingSections: outcome.missingSections,
            detectedLanguage: detectLanguage(outcome.profile),
            source: outcome.source,
            attempts: outcome.attempts,
          };
          console.log('[DEEP] scrape ok via', outcome.source, 'completeness=', outcome.completeness, 'missing=', outcome.missingSections.join(','), 'lang=', scrapeMeta.detectedLanguage);
        }

        // Build Claude user content (image or text)
        const promptCtx = scrapeMeta
          ? { completeness: scrapeMeta.completeness, missingSections: scrapeMeta.missingSections, detectedLanguage: scrapeMeta.detectedLanguage }
          : { detectedLanguage: 'ar' as const };
        const userContent: any = input.imageBase64
          ? [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.mediaType || 'image/png',
                  data: input.imageBase64,
                },
              },
              { type: 'text', text: buildDeepUserPrompt('(see screenshot above)', promptCtx) },
            ]
          : buildDeepUserPrompt(profileText, promptCtx);

        console.log('[DEEP] Calling Claude for deep analysis');
        const _deepT0 = Date.now();
        let claudeRes;
        try {
          claudeRes = await callClaude({
            task: 'profile_analysis',
            system: SYSTEM_DEEP,
            userContent,
            maxTokens: 8000,
          });
        } catch (err: any) {
          // Refund — Claude call failed, user should not pay.
          if (deducted) { await refundTokens(ctx.supabase, ctx.user.id, COST, FEATURE); deducted = false; }
          const status = err?.status || 500;
          const body = err?.responseBody || err?.body || err?.message || '';
          const info = classifyClaudeError(status, body);
          console.error('[DEEP] Claude error:', status, info.kind, err?.message);
          await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyzeDeep', statusCode: status, responseTimeMs: Date.now() - _deepT0, errorMsg: info.devDetail, userId: ctx.user?.id });
          if (info.alertOps) void sendClaudeOpsAlert(info, '/v1/messages:analyzeDeep');
          const code = status === 429 ? 'TOO_MANY_REQUESTS' : (status === 401 || status === 403) ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR';
          throw new TRPCError({ code, message: info.userMessage });
        }
        await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyzeDeep', statusCode: 200, responseTimeMs: Date.now() - _deepT0, userId: ctx.user?.id });

        const text = extractText(claudeRes);
        const tokensUsed = (claudeRes.usage?.input_tokens || 0) + (claudeRes.usage?.output_tokens || 0);
        console.log('[DEEP] Raw Claude response (first 500 chars):', text.substring(0, 500));

        const result = extractJson<any>(text);
        if (!result) {
          console.error('[DEEP] All JSON parse attempts failed. Raw:', text.substring(0, 500));
          if (deducted) { await refundTokens(ctx.supabase, ctx.user.id, COST, FEATURE); deducted = false; }
          return { error: 'فشل تحليل الرد من الذكاء الاصطناعي', rawPreview: text.substring(0, 200) };
        }
        console.log('[DEEP] Parsed OK, has score:', !!result.score);

        // Attach scrape meta + profile so the UI / PDF can render real data
        if (scrapeMeta) {
          result._meta = {
            completeness: scrapeMeta.completeness,
            missing_sections: scrapeMeta.missingSections,
            detected_language: scrapeMeta.detectedLanguage,
            source: scrapeMeta.source,
            attempts: scrapeMeta.attempts,
          };
        }
        if (unifiedProfile) {
          result._profile = unifiedProfile;
        }

        // Cache result (24h)
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await ctx.supabase.from('ai_cache').upsert({
          cache_key: cacheKey,
          result,
          model: claudeRes.model || 'claude-sonnet-4-6',
          tokens_used: tokensUsed,
          expires_at: expires,
        }, { onConflict: 'cache_key' });

        console.log('[DEEP] Success, score:', result.score, 'tokens:', tokensUsed);
        return result;
      } catch (err: any) {
        // Defensive refund — if we deducted but hit an unknown exception path, roll back.
        if (deducted) { await refundTokens(ctx.supabase, ctx.user.id, COST, FEATURE); }
        console.error('[DEEP] Error:', err?.message || err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'فشل في التحليل العميق',
        });
      }
    }),

  // ── PROFILE RADAR v5 — evidence-based ───────────────────────────────────
  analyzeTargeted: protectedProcedure
    .input(z.object({
      linkedinUrl: z.string().optional(),
      imageBase64: z.string().optional(),
      mediaType: z.string().optional(),
      targetGoal: TARGET_GOAL,
      industry: INDUSTRY,
      // Free-text industry label, only used when industry === 'other'.
      customIndustryLabel: z.string().trim().min(2).max(60).optional(),
      targetRole: z.string().max(200).optional(),
      targetCompany: z.string().max(200).optional(),
      reportLanguage: REPORT_LANGUAGE.default('ar'),
    }))
    .mutation(async ({ input, ctx }) => {
      const TOKEN_COST = 25;
      const FEATURE = 'linkedin.analyzeTargeted';
      const lang = input.reportLanguage;
      const startedAt = Date.now();
      let deducted = false;
      let stage = 'init';
      // Stages that happen AFTER a successful atomic deduct — those must refund.
      // NOTE: identity verification + completeness guard now run BEFORE
      // deduction, so they are intentionally NOT in this set.
      const REFUNDABLE_STAGES = new Set([
        'building_payload',
        'calling_claude',
        'parsing_claude_response',
        'normalizing_response',
        'persisting_to_db',
      ]);

      try {
        // ── STAGE 1: validate URL format ───────────────────────────────────
        stage = 'validating_url';
        let normalizedUrl = input.linkedinUrl;
        if (input.linkedinUrl) {
          const validation = validateAndNormalizeLinkedInUrl(input.linkedinUrl);
          if (!validation.valid) {
            const msg = lang === 'ar'
              ? `${validation.errorMessageAr}. ${validation.suggestion || ''}`
              : `${validation.errorMessageEn}. ${validation.suggestion || ''}`;
            throw new TRPCError({ code: 'BAD_REQUEST', message: msg.trim() });
          }
          normalizedUrl = validation.normalizedUrl;
        }

        // Extract the slug of what the user ASKED for. This is compared
        // against what the actor RETURNS — catches search-actor silent wrong
        // matches (see linkedin-scraper.ts header).
        const requestedSlug = normalizedUrl ? extractSlugFromUrl(normalizedUrl) : '';
        if (normalizedUrl && !requestedSlug) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: lang === 'ar'
              ? 'رابط LinkedIn غير صالح. تأكد من أنه بصيغة https://linkedin.com/in/username'
              : 'Invalid LinkedIn URL. Use the format https://linkedin.com/in/username',
          });
        }

        // ── STAGE 2: scrape LinkedIn profile (BEFORE deducting) ────────────
        // Ordering matters: no tokens are charged for a non-existent profile
        // or a profile the actor fails to fetch. Scrape first, verify identity,
        // then deduct.
        stage = 'scraping_profile';
        let unifiedProfile: any = null;
        let completeness = 0;
        let missingSections: string[] = [];
        let returnedSlug = '';
        if (normalizedUrl) {
          try {
            // Hybrid scraper: LinkdAPI primary, Bright Data fallback on transport
            // errors. NOT_FOUND / URL_MISMATCH short-circuit without BD fallback.
            // See server/_core/services/profile-scraper.ts for the strategy rationale.
            const outcome = await scrapeLinkedInProfileHybrid(normalizedUrl);
            unifiedProfile = outcome.profile;
            completeness = outcome.completeness;
            missingSections = outcome.missingSections;
            returnedSlug = outcome.returnedSlug;
            console.log('[RADAR stage=scraping_profile ok]', {
              source: outcome.source,
              completeness,
              missing: missingSections.length,
              requestedSlug: outcome.requestedSlug,
              returnedSlug: outcome.returnedSlug,
              identityMatch: outcome.identityMatch,
            });
          } catch (e: any) {
            const kind = (e as any)?.kind;
            const isNotFound =
              e instanceof LinkdApiProfileNotFoundError ||
              e instanceof BrightDataProfileNotFoundError;
            console.error('[RADAR stage=scraping_profile fail]', { kind, notFound: isNotFound, message: e?.message });
            if (kind === 'URL_MISMATCH') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: lang === 'ar'
                  ? `لم نتمكن من العثور على بروفايل (${requestedSlug}). تأكد من الرابط وأن البروفايل عام وليس خاصاً. لم يتم خصم أي نقاط.`
                  : `We couldn't find the profile (${requestedSlug}). Check the URL and make sure the profile is public. No tokens were charged.`,
              });
            }
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: lang === 'ar'
                ? `لم نتمكن من قراءة البروفايل (${requestedSlug || 'الرابط'}). تأكد من أن البروفايل عام. لم يتم خصم أي نقاط.`
                : `Failed to read profile (${requestedSlug || 'the URL'}) — ensure it's public. No tokens were charged.`,
            });
          }
        }

        // ── STAGE 3: verify identity (BEFORE deducting) ────────────────────
        // Layer-2 defence on top of what linkedin-scraper already does internally.
        // Even if somehow a slug mismatch leaked through, this second check
        // will stop it from ever reaching the paid Claude call.
        stage = 'verifying_identity';
        if (unifiedProfile && requestedSlug) {
          const verifySlug = returnedSlug || extractSlugFromProfile(unifiedProfile);
          if (!slugsMatch(requestedSlug, verifySlug)) {
            console.error('[RADAR stage=verifying_identity fail]', {
              requested: requestedSlug, returned: verifySlug, fullName: unifiedProfile.fullName,
            });
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: lang === 'ar'
                ? `لم نتمكن من العثور على بروفايل (${requestedSlug}). تأكد من الرابط. لم يتم خصم أي نقاط.`
                : `We couldn't find the profile (${requestedSlug}). Check the URL. No tokens were charged.`,
            });
          }
        }

        // ── STAGE 4: completeness guard (BEFORE deducting) ─────────────────
        stage = 'checking_data_completeness';
        if (unifiedProfile && !input.imageBase64 && completeness < 25) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: lang === 'ar'
              ? `هذا البروفايل يحتاج إلى بيانات أكثر (${completeness}%). الأقسام الناقصة: ${missingSections.join('، ')}. أضف المزيد من المحتوى ثم جرّب مرة أخرى. لم يتم خصم أي نقاط.`
              : `This profile needs more content (${completeness}%). Missing: ${missingSections.join(', ')}. Add more content and retry. No tokens were charged.`,
          });
        }

        // ── STAGE 5: atomic token deduction ────────────────────────────────
        // We only deduct once we know the profile is real AND has enough data.
        stage = 'deducting_tokens';
        const deduct = await deductTokens(ctx.supabase, ctx.user.id, TOKEN_COST, FEATURE);
        if (!deduct.success) throwInsufficientTokensError(deduct, lang);
        deducted = true;
        console.log('[RADAR stage=deducting_tokens ok]', {
          userId: ctx.user.id, before: deduct.balance_before, after: deduct.balance_after,
        });

        // ── STAGE 6: build Claude payload ──────────────────────────────────
        stage = 'building_payload';
        // Defensive normalization — Apify responses occasionally return null
        // for array fields; `.slice` on null would 500 the handler.
        const asArray = (v: any): any[] => (Array.isArray(v) ? v : []);
        const p = unifiedProfile;
        const structuredProfile = p ? {
          fullName: p.fullName || null,
          headline: p.headline || null,
          summary: p.summary || null,
          location: p.location || null,
          has_profile_picture: !!p.profilePicture,
          has_banner_image: !!p.bannerImage,
          custom_url: !!p.customUrl,
          experience: asArray(p.experience).slice(0, 8).map((e: any) => ({
            title: e?.title || null,
            company: e?.company || null,
            duration: e?.duration || null,
            location: e?.location || null,
            description: e?.description ? String(e.description).slice(0, 400) : null,
          })),
          education: asArray(p.education).slice(0, 5).map((e: any) => ({
            school: e?.school || null,
            degree: e?.degree || null,
            field: e?.field || null,
            year: e?.year || null,
          })),
          skills: asArray(p.skills).slice(0, 30),
          certifications: asArray(p.certifications).slice(0, 10).map((c: any) => ({
            name: c?.name || null,
            issuer: c?.issuer || null,
          })),
          languages: asArray(p.languages).map((l: any) => ({ name: l?.name || null, proficiency: l?.proficiency || null })),
          // LinkdAPI additions — all optional, undefined on Bright Data profiles.
          honors_and_awards: asArray(p.honorsAndAwards).slice(0, 5).map((h: any) => ({
            title: h?.title || null,
            issuer: h?.issuer || null,
            issued_on: h?.issuedOn || null,
          })),
          industry: p.industry?.name || null,
          // Only emit flags when we actually have data (LinkdAPI provides them;
          // Bright Data leaves the object undefined). Keeps Claude from
          // commenting on missing signals we don't actually know.
          flags: p.flags ? {
            is_open_to_work: p.flags.isOpenToWork,
            is_premium: p.flags.isPremium,
            is_creator: p.flags.isCreator,
            is_influencer: p.flags.isInfluencer,
            is_hiring: p.flags.isHiring,
          } : null,
          activity_count: asArray(p.activity).length,
        } : null;

        const effectiveIndustry = input.industry === 'other' && input.customIndustryLabel
          ? input.customIndustryLabel
          : input.industry;

        const userPayload = {
          target_goal: input.targetGoal,
          industry: effectiveIndustry,
          industry_is_custom: input.industry === 'other',
          target_role: input.targetRole || null,
          target_company: input.targetCompany || null,
          report_language: lang,
          profile_completeness: completeness,
          missing_sections: missingSections,
          profile_data: structuredProfile,
        };

        const userContent: any = input.imageBase64
          ? [
              { type: 'image', source: { type: 'base64', media_type: input.mediaType || 'image/png', data: input.imageBase64 } },
              { type: 'text', text: JSON.stringify(userPayload, null, 2) },
            ]
          : JSON.stringify(userPayload, null, 2);

        // ── STAGE: call Claude ─────────────────────────────────────────────
        stage = 'calling_claude';
        const _t0 = Date.now();
        let claudeRes: any;
        try {
          claudeRes = await callClaude({
            task: 'profile_analysis',
            system: PROFILE_RADAR_SYSTEM,
            userContent,
            // Full evidence-based Arabic report with 6 dimensions × observations +
            // recommendations + top_priorities + evidence_bundle routinely hits
            // 8-10k output tokens. 7000 was truncating responses mid-JSON → parse
            // failure → 500. Bumping to 16000 leaves ~2x headroom.
            maxTokens: 16000,
            temperature: 0.3,
          });
          await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyzeTargeted', statusCode: 200, responseTimeMs: Date.now() - _t0, userId: ctx.user?.id });
          console.log('[RADAR stage=calling_claude ok]', {
            durationMs: Date.now() - _t0,
            stop_reason: claudeRes?.stop_reason,
            output_tokens: claudeRes?.usage?.output_tokens,
          });
        } catch (err: any) {
          const status = err?.status || 500;
          const body = err?.responseBody || err?.body || err?.message || '';
          const info = classifyClaudeError(status, body);
          await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyzeTargeted', statusCode: status, responseTimeMs: Date.now() - _t0, errorMsg: info.devDetail, userId: ctx.user?.id });
          if (info.alertOps) void sendClaudeOpsAlert(info, '/v1/messages:analyzeTargeted');
          const code = status === 429 ? 'TOO_MANY_REQUESTS' : (status === 401 || status === 403) ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR';
          throw new TRPCError({ code, message: info.userMessage });
        }

        // ── STAGE: parse Claude response ───────────────────────────────────
        stage = 'parsing_claude_response';
        const text = extractText(claudeRes);
        // Guard against truncation BEFORE attempting parse — mid-JSON cutoff
        // is the cause of most parse failures here. A truncated response
        // deserves a distinct error + log so we notice if maxTokens needs bumping
        // again.
        if (claudeRes?.stop_reason === 'max_tokens') {
          console.error('[RADAR stage=parsing_claude_response truncated]', {
            output_tokens: claudeRes?.usage?.output_tokens,
            textLen: typeof text === 'string' ? text.length : 0,
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: lang === 'ar'
              ? 'انقطع تحليل الذكاء الاصطناعي قبل اكتماله — الرجاء المحاولة مرة أخرى'
              : 'AI analysis was cut off before completion — please retry',
          });
        }
        // Try the custom extractor first (already handles fences/balanced braces).
        // Fall back to the shared safeJsonParse if extractJson returns null.
        let result: any = extractJson<any>(text);
        if (!result) result = safeJsonParse<any>(text);
        if (!result || !Array.isArray(result.sections)) {
          console.error('[RADAR stage=parsing_claude_response fail]', {
            stop_reason: claudeRes?.stop_reason,
            output_tokens: claudeRes?.usage?.output_tokens,
            hasSections: Array.isArray(result?.sections),
            rawHead: typeof text === 'string' ? text.substring(0, 300) : typeof text,
            rawTail: typeof text === 'string' ? text.substring(Math.max(0, text.length - 300)) : '',
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: lang === 'ar' ? 'فشل تحليل الرد من الذكاء الاصطناعي' : 'Failed to parse analysis response',
          });
        }

        // ── STAGE: normalize response shape ────────────────────────────────
        stage = 'normalizing_response';
        // All post-hoc shape-guarantees the UI relies on. Never throws — every
        // field is defensively coerced. Loosened (not strict) because Claude
        // drift on optional fields must not 500 the user.
        if (!Array.isArray(result.sections)) result.sections = [];
        if (!Array.isArray(result.top_priorities)) result.top_priorities = [];
        if (typeof result.confidence !== 'string') {
          result.confidence = completeness >= 70 ? 'high' : completeness >= 40 ? 'medium' : 'low';
        }
        if (typeof result.data_completeness !== 'number') {
          result.data_completeness = completeness;
        }
        if (typeof result.verdict !== 'string') result.verdict = '';

        // Ensure every one of the 8 sections is present in the correct order.
        // Claude occasionally drops a section — we backfill with a null-scored
        // stub so the UI can still render all 8 cards.
        const claudeSectionsByKey: Record<string, any> = {};
        for (const s of result.sections) {
          if (s && typeof s.key === 'string') claudeSectionsByKey[s.key] = s;
        }
        const orderedSections = SECTION_KEYS.map((key) => {
          const s = claudeSectionsByKey[key] || {};
          const fw = ((s.framework as string) || '').toUpperCase();
          const labels = FRAMEWORK_LABELS[fw as 'A' | 'B' | 'C' | 'D' | 'E' | 'F'];
          const score = (typeof s.score === 'number' && s.score >= 0 && s.score <= 100) ? s.score : null;
          return {
            key,
            name_ar: SECTION_NAMES[key].ar,
            name_en: SECTION_NAMES[key].en,
            score,
            assessment: typeof s.assessment === 'string' ? s.assessment : '',
            current: typeof s.current === 'string' ? s.current : (score === null ? (lang === 'ar' ? 'فارغ' : 'Empty') : ''),
            suggested: typeof s.suggested === 'string' ? s.suggested : '',
            why: typeof s.why === 'string' ? s.why : '',
            framework: (['A','B','C','D','E','F'].includes(fw) ? fw : null) as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null,
            framework_label: labels ? (lang === 'ar' ? labels.ar : labels.en) : null,
            effort: ['quick','moderate','deep'].includes(s.effort) ? s.effort : 'moderate',
          };
        });
        result.sections = orderedSections;

        // Compute overall_score SERVER-SIDE from the weighted section table.
        // Trusting Claude's arithmetic drifts (saw 47 vs 58 for same input).
        result.overall_score = computeOverallFromSections(orderedSections, input.targetGoal);

        // Top priorities — keep max 3, attach framework_label + validate section_key
        result.top_priorities = result.top_priorities.slice(0, 3).map((pr: any, idx: number) => {
          const fw = (pr?.framework || '').toUpperCase();
          const labels = FRAMEWORK_LABELS[fw as 'A' | 'B' | 'C' | 'D' | 'E' | 'F'];
          const sectionKey = pr?.section_key || pr?.dimension || null;
          const validSectionKey = SECTION_KEYS.includes(sectionKey as SectionKey) ? sectionKey : null;
          return {
            rank: typeof pr.rank === 'number' ? pr.rank : idx + 1,
            action: typeof pr.action === 'string' ? pr.action : '',
            section_key: validSectionKey,
            framework: (['A','B','C','D','E','F'].includes(fw) ? fw : null),
            framework_label: labels ? (lang === 'ar' ? labels.ar : labels.en) : null,
            expected_impact: typeof pr.expected_impact === 'string' ? pr.expected_impact : '',
          };
        });

        if (!result.evidence_bundle || typeof result.evidence_bundle !== 'object') {
          result.evidence_bundle = {
            profile_quotes_used: [],
            frameworks_referenced: [],
            missing_data_flags: missingSections,
          };
        }
        if (!Array.isArray(result.evidence_bundle.profile_quotes_used)) result.evidence_bundle.profile_quotes_used = [];
        if (!Array.isArray(result.evidence_bundle.frameworks_referenced)) result.evidence_bundle.frameworks_referenced = [];
        if (!Array.isArray(result.evidence_bundle.missing_data_flags)) result.evidence_bundle.missing_data_flags = missingSections;

        if (input.industry === 'other' && input.customIndustryLabel) {
          result.custom_industry_label = input.customIndustryLabel;
        }

        // ── STAGE: persist to DB ───────────────────────────────────────────
        stage = 'persisting_to_db';
        const { data: saved, error: saveErr } = await ctx.supabase
          .from('profile_analyses')
          .insert({
            user_id: ctx.user.id,
            linkedin_url: normalizedUrl || null,
            analysis_data: result,
            target_goal: input.targetGoal,
            industry: input.industry,
            target_role: input.targetRole || null,
            target_company: input.targetCompany || null,
            report_language: lang,
            profile_data: unifiedProfile,
            tokens_used: TOKEN_COST,
          })
          .select()
          .single();

        if (saveErr) {
          console.error('[RADAR stage=persisting_to_db fail]', saveErr);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: saveErr.message });
        }

        // ── SUCCESS ────────────────────────────────────────────────────────
        console.log('[RADAR stage=success]', {
          userId: ctx.user.id,
          totalMs: Date.now() - startedAt,
          tokensRemaining: deduct.balance_after,
        });
        // Lightweight profile summary for the UI's side-panel sections +
        // the split-view main column (name/headline/about/experience/education).
        // We don't ship the full unifiedProfile — just the structured fields
        // the UI actually renders. Empty fields default to '' or [] so the
        // client doesn't need to null-check on every use.
        const profileSummary = unifiedProfile ? {
          // ── original fields (unchanged — do not reorder or alter) ──
          top_skills: Array.isArray(unifiedProfile.skills) ? unifiedProfile.skills.slice(0, 10) : [],
          certifications: Array.isArray(unifiedProfile.certifications)
            ? unifiedProfile.certifications.slice(0, 6).map((c: any) => ({ name: c?.name || '', issuer: c?.issuer || '' }))
            : [],
          languages: Array.isArray(unifiedProfile.languages)
            ? unifiedProfile.languages.map((l: any) => ({ name: l?.name || '', proficiency: l?.proficiency || '' }))
            : [],
          honors_and_awards: Array.isArray(unifiedProfile.honorsAndAwards)
            ? unifiedProfile.honorsAndAwards.slice(0, 5).map((h: any) => ({
                title: h?.title || '',
                issuer: h?.issuer || '',
                issued_on: h?.issuedOn || '',
              }))
            : [],
          flags: unifiedProfile.flags || null,
          // ── additive fields for the split-view main column (Option B) ──
          // All values default to '' or [] — never null/undefined — so the
          // client can render without guards. No AI output is touched; these
          // are pass-throughs from the LinkdAPI/BD scraper output.
          fullName: typeof unifiedProfile.fullName === 'string' ? unifiedProfile.fullName : '',
          headline: typeof unifiedProfile.headline === 'string' ? unifiedProfile.headline : '',
          about: typeof unifiedProfile.summary === 'string' ? unifiedProfile.summary : '',
          location: typeof unifiedProfile.location === 'string' ? unifiedProfile.location : '',
          profilePicture: typeof unifiedProfile.profilePicture === 'string' ? unifiedProfile.profilePicture : '',
          bannerImage: typeof unifiedProfile.bannerImage === 'string' ? unifiedProfile.bannerImage : '',
          industry: typeof unifiedProfile.industry === 'string' ? unifiedProfile.industry : '',
          experience: Array.isArray(unifiedProfile.experience)
            ? unifiedProfile.experience.map((e: any) => ({
                title: typeof e?.title === 'string' ? e.title : '',
                company: typeof e?.company === 'string' ? e.company : '',
                location: typeof e?.location === 'string' ? e.location : '',
                startDate: typeof e?.startDate === 'string' ? e.startDate : '',
                endDate: typeof e?.endDate === 'string' ? e.endDate : '',
                description: typeof e?.description === 'string' ? e.description : '',
              }))
            : [],
          education: Array.isArray(unifiedProfile.education)
            ? unifiedProfile.education.map((ed: any) => ({
                school: typeof ed?.school === 'string' ? ed.school : '',
                degree: typeof ed?.degree === 'string' ? ed.degree : '',
                field: typeof ed?.field === 'string' ? ed.field : '',
                startYear: typeof ed?.startYear === 'string' ? ed.startYear
                  : (typeof ed?.start_year === 'string' ? ed.start_year : ''),
                endYear: typeof ed?.endYear === 'string' ? ed.endYear
                  : (typeof ed?.end_year === 'string' ? ed.end_year
                  : (typeof ed?.year === 'string' ? ed.year : '')),
              }))
            : [],
        } : null;

        return {
          id: saved.id,
          analysis: result,
          linkedinUrl: normalizedUrl,
          tokensUsed: TOKEN_COST,
          tokensRemaining: deduct.balance_after,
          profileSummary,
        };
      } catch (err: any) {
        // Refund if the failure happened after the deduction but before success.
        if (deducted && REFUNDABLE_STAGES.has(stage)) {
          await refundTokens(ctx.supabase, ctx.user.id, TOKEN_COST, `${FEATURE}.refund:${stage}`).catch((e) => {
            console.error('[RADAR refund-on-error failed]', e?.message);
          });
        }
        console.error('[RADAR stage=' + stage + ' error]', {
          userId: ctx.user?.id,
          stage,
          totalMs: Date.now() - startedAt,
          message: err?.message,
          code: err?.code,
        });
        if (err instanceof TRPCError) throw err;

        // Attach stage diagnostic to the TRPCError cause so the UI / support
        // can see exactly where it failed.
        const causeErr = new Error(`analyzeTargeted failed at stage=${stage}: ${err?.message || 'unknown'}`);
        (causeErr as any).stage = stage;
        (causeErr as any).kind = 'ANALYSIS_FAILURE';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: lang === 'ar'
            ? `فشل التحليل (المرحلة: ${stage}). ${err?.message ? err.message : ''}`.trim()
            : `Analysis failed at stage: ${stage}. ${err?.message ? err.message : ''}`.trim(),
          cause: causeErr,
        });
      }
    }),

  exportReport: protectedProcedure
    .input(z.object({
      analysisId: z.string().uuid(),
      // 'pdf' kept in schema only so old clients fail with a clear error.
      // jsPDF cannot embed Arabic glyphs cleanly — DOCX is the only supported format.
      format: z.enum(['pdf', 'docx']),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.format === 'pdf') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PDF export is no longer available. Please use DOCX.',
        });
      }

      const { data: analysis } = await ctx.supabase
        .from('profile_analyses')
        .select('*')
        .eq('id', input.analysisId)
        .eq('user_id', ctx.user.id)
        .single();

      if (!analysis) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'التحليل غير موجود' });
      }

      const DOCX_COST = 5;
      const DOCX_FEATURE = 'linkedin.exportReport.docx';
      const lang = (analysis.report_language as 'ar' | 'en') || 'ar';
      if (!analysis.docx_generated) {
        // Atomic deduct. Marks docx_generated only after deduct succeeds, so
        // any subsequent failure lets the user retry without double-charge.
        const deduct = await deductTokens(ctx.supabase, ctx.user.id, DOCX_COST, DOCX_FEATURE);
        if (!deduct.success) throwInsufficientTokensError(deduct, lang);

        await ctx.supabase
          .from('profile_analyses')
          .update({ docx_generated: true })
          .eq('id', input.analysisId);
      }

      const userName = (analysis.profile_data as any)?.fullName
                    || (analysis.profile_data as any)?.name
                    || undefined;

      const reportOpts = {
        language: analysis.report_language as 'ar' | 'en',
        userName,
        targetGoal: analysis.target_goal,
        industry: analysis.industry,
        targetRole: analysis.target_role,
        targetCompany: analysis.target_company,
        analysisData: analysis.analysis_data as any,
      };

      const buffer = await generateDocxReport(reportOpts);
      const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const filename = `profile-analysis-${analysis.id.slice(0, 8)}.docx`;

      return {
        filename,
        mimeType,
        base64: buffer.toString('base64'),
      };
    }),

  listAnalyses: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('profile_analyses')
      .select('id, linkedin_url, target_goal, industry, report_language, analysis_data, created_at')
      .eq('user_id', ctx.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    return (data || []).map((a: any) => ({
      id: a.id,
      linkedin_url: a.linkedin_url,
      target_goal: a.target_goal,
      industry: a.industry,
      language: a.report_language,
      overall_score: a.analysis_data?.overall_score || 0,
      verdict: a.analysis_data?.verdict || '',
      created_at: a.created_at,
    }));
  }),

  compareAnalyses: protectedProcedure
    .input(z.object({
      olderId: z.string().uuid(),
      newerId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const { data: analyses } = await ctx.supabase
        .from('profile_analyses')
        .select('id, analysis_data, target_goal, industry, created_at')
        .in('id', [input.olderId, input.newerId])
        .eq('user_id', ctx.user.id);

      if (!analyses || analyses.length !== 2) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'التحليلات غير موجودة' });
      }

      const sorted = [...analyses].sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const older = sorted[0];
      const newer = sorted[1];

      const olderData = older.analysis_data as any;
      const newerData = newer.analysis_data as any;

      // Support both v5 (dimensions) and v6 (sections) rows during migration window.
      const olderItems: any[] = Array.isArray(olderData?.sections)
        ? olderData.sections
        : (Array.isArray(olderData?.dimensions) ? olderData.dimensions : []);
      const newerItems: any[] = Array.isArray(newerData?.sections)
        ? newerData.sections
        : (Array.isArray(newerData?.dimensions) ? newerData.dimensions : []);
      const keyOf = (item: any) => item.key || item.name;

      const dimensionChanges = olderItems.map((oldItem: any) => {
        const key = keyOf(oldItem);
        const newItem = newerItems.find((d: any) => keyOf(d) === key);
        const oldScore = typeof oldItem.score === 'number' ? oldItem.score : 0;
        const newScore = newItem && typeof newItem.score === 'number' ? newItem.score : oldScore;
        const delta = newScore - oldScore;
        return {
          name: key,
          before: oldScore,
          after: newScore,
          delta,
          status: delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'unchanged',
        };
      });

      const improvedCount = dimensionChanges.filter((c: any) => c.status === 'improved').length;
      const declinedCount = dimensionChanges.filter((c: any) => c.status === 'declined').length;
      const unchangedCount = dimensionChanges.filter((c: any) => c.status === 'unchanged').length;

      return {
        older: { id: older.id, score: olderData?.overall_score || 0, date: older.created_at },
        newer: { id: newer.id, score: newerData?.overall_score || 0, date: newer.created_at },
        overallDelta: (newerData?.overall_score || 0) - (olderData?.overall_score || 0),
        dimensionChanges,
        summary: { improved: improvedCount, declined: declinedCount, unchanged: unchangedCount },
        improvedAreas: dimensionChanges.filter((c: any) => c.status === 'improved').map((c: any) => ({ name: c.name, delta: c.delta })),
        stillNeedsWork: dimensionChanges.filter((c: any) => (c.after || 0) < 60).map((c: any) => c.name),
      };
    }),

  deleteAnalysis: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.supabase
        .from('profile_analyses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);
      return { success: true };
    }),

});
