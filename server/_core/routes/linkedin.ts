import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { logApiCall, mapAnthropicStatusToArabic, mapApifyStatusToArabic, classifyClaudeError, sendClaudeOpsAlert } from '../lib/apiLogger';
import { callClaude, extractText, extractJson } from '../lib/claude-client';
import { scrapeLinkedInProfileMulti, detectLanguage } from '../lib/linkedin-scraper';
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

const DIMENSION_NAMES = [
  'stranger_legibility',
  'discoverability',
  'ats_readiness',
  'skills_architecture',
  'social_proof',
  'narrative_coherence',
] as const;
type DimensionName = (typeof DIMENSION_NAMES)[number];

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
SCORING DIMENSIONS (each ties to a specific framework)
═══════════════════════════════════════

1. stranger_legibility (Frameworks A, F)
   Would a stranger in the user's target industry understand this profile
   in under 30 seconds? Sub-metrics: headline clarity, about-section
   opening, jargon ratio.

2. discoverability (Framework B)
   Does the profile hit LinkedIn's algorithmic thresholds? Sub-metrics:
   skills count (≥5), photo presence, custom URL, location specificity,
   open-to-work status, banner image presence.

3. ats_readiness (Framework C)
   Would an ATS parser score this profile highly? Sub-metrics: action
   verbs, quantified outcomes, keyword match rate, inverse-pyramid
   structure.

4. skills_architecture (Framework D)
   Are skills specific enough to signal expertise to a 2026 skills-based
   employer? Sub-metrics: micro-skill specificity, stack coherence,
   market-demand alignment.

5. social_proof (Framework E)
   Does the profile carry trust signals weighted heavily in GCC hiring?
   Sub-metrics: recommendation count, recommendation recency, endorsement
   distribution, bilingual presence.

6. narrative_coherence (Frameworks A, F)
   Does the profile tell a consistent story from headline → about →
   experience → skills? Sub-metrics: thematic consistency, target-role
   alignment, gap explanations.

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

  "dimensions": [
    {
      "name": "stranger_legibility" | "discoverability" | "ats_readiness" | "skills_architecture" | "social_proof" | "narrative_coherence",
      "score": number (0-100) | null,
      "framework": "A" | "B" | "C" | "D" | "E" | "F",
      "observations": [
        {
          "what": string (exact or paraphrased profile quote, in target language),
          "why": string (how the cited framework interprets this, in target language),
          "citation": string (specific stat or finding from the framework, in target language),
          "impact": "high" | "medium" | "low"
        }
      ],
      "recommendations": [
        {
          "current": string (what they have now, in target language or original profile language),
          "suggested": string (exact rewrite, in target language or original profile language),
          "rationale": string (which framework and why, in target language),
          "effort": "quick" | "moderate" | "deep"
        }
      ]
    }
  ],

  "top_priorities": [
    {
      "rank": 1 | 2 | 3,
      "action": string (in target language),
      "dimension": "stranger_legibility" | "discoverability" | "ats_readiness" | "skills_architecture" | "social_proof" | "narrative_coherence",
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

RULES ON EMISSIONS:
- Always include exactly 6 dimensions in the exact order above.
- Each dimension MUST cite exactly ONE primary framework in "framework".
- frameworks_referenced in evidence_bundle must match what you actually used.
- Recommendations MUST always reference actual fields to add or edit.
- top_priorities: ALWAYS exactly 3 items, ordered by impact (rank 1 = highest).

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
          // Atomic deduct BEFORE downstream work; refund on failure.
          const deduct = await deductTokens(ctx.supabase, ctx.user.id, COST, FEATURE);
          if (!deduct.success) throwInsufficientTokensError(deduct, 'en');
          console.log('[LINKEDIN] tokens deducted', deduct.balance_before, '→', deduct.balance_after);
          const profileData = await scrapeLinkedInProfile(input.profileUrl);
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
      const REFUNDABLE_STAGES = new Set([
        'scraping_profile',
        'sparse_guard',
        'building_payload',
        'calling_claude',
        'parsing_claude_response',
        'normalizing_response',
        'persisting_to_db',
      ]);

      try {
        // ── STAGE: validate URL ────────────────────────────────────────────
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

        // ── STAGE: atomic token deduction ──────────────────────────────────
        stage = 'deducting_tokens';
        const deduct = await deductTokens(ctx.supabase, ctx.user.id, TOKEN_COST, FEATURE);
        if (!deduct.success) throwInsufficientTokensError(deduct, lang);
        deducted = true;
        console.log('[RADAR stage=deducting_tokens ok]', {
          userId: ctx.user.id, before: deduct.balance_before, after: deduct.balance_after,
        });

        // ── STAGE: scrape LinkedIn profile ─────────────────────────────────
        stage = 'scraping_profile';
        let unifiedProfile: any = null;
        let completeness = 0;
        let missingSections: string[] = [];
        if (normalizedUrl) {
          try {
            const outcome = await scrapeLinkedInProfileMulti(normalizedUrl);
            unifiedProfile = outcome.profile;
            completeness = outcome.completeness;
            missingSections = outcome.missingSections;
            console.log('[RADAR stage=scraping_profile ok]', {
              source: outcome.source, completeness, missing: missingSections.length,
            });
          } catch (e: any) {
            console.error('[RADAR stage=scraping_profile fail]', e?.message);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: lang === 'ar'
                ? 'فشل قراءة البروفايل — تأكد من أن البروفايل عام ومكتمل'
                : 'Failed to read profile — ensure the profile is public and has content',
            });
          }
        }

        // ── STAGE: sparse-profile guard ────────────────────────────────────
        stage = 'sparse_guard';
        if (unifiedProfile && !input.imageBase64 && completeness < 25) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: lang === 'ar'
              ? `بيانات البروفايل غير كافية للتحليل (${completeness}%). الأقسام الناقصة: ${missingSections.join('، ')}. اجعل البروفايل عاماً وأضف محتوى أساسياً ثم حاول مرة أخرى.`
              : `Profile data too sparse to analyze (${completeness}%). Missing: ${missingSections.join(', ')}. Make the profile public and add core content, then retry.`,
          });
        }

        // ── STAGE: build Claude payload ────────────────────────────────────
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
            maxTokens: 7000,
            temperature: 0.3,
          });
          await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyzeTargeted', statusCode: 200, responseTimeMs: Date.now() - _t0, userId: ctx.user?.id });
          console.log('[RADAR stage=calling_claude ok]', { durationMs: Date.now() - _t0 });
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
        // Try the custom extractor first (already handles fences/balanced braces).
        // Fall back to the shared safeJsonParse if extractJson returns null.
        let result: any = extractJson<any>(text);
        if (!result) result = safeJsonParse<any>(text);
        if (!result || typeof result.overall_score !== 'number') {
          console.error('[RADAR stage=parsing_claude_response fail] raw:', typeof text === 'string' ? text.substring(0, 500) : typeof text);
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
        if (!Array.isArray(result.dimensions)) result.dimensions = [];
        if (!Array.isArray(result.top_priorities)) result.top_priorities = [];
        if (typeof result.confidence !== 'string') {
          result.confidence = completeness >= 70 ? 'high' : completeness >= 40 ? 'medium' : 'low';
        }
        if (typeof result.data_completeness !== 'number') {
          result.data_completeness = completeness;
        }
        if (typeof result.verdict !== 'string') result.verdict = '';

        result.dimensions = result.dimensions.map((d: any) => {
          const fw = (d?.framework || '').toUpperCase();
          const labels = FRAMEWORK_LABELS[fw as 'A' | 'B' | 'C' | 'D' | 'E' | 'F'];
          return {
            ...d,
            framework_label: labels ? (lang === 'ar' ? labels.ar : labels.en) : null,
          };
        });
        result.top_priorities = result.top_priorities.map((pr: any) => {
          const fw = (pr?.framework || '').toUpperCase();
          const labels = FRAMEWORK_LABELS[fw as 'A' | 'B' | 'C' | 'D' | 'E' | 'F'];
          return {
            ...pr,
            framework_label: labels ? (lang === 'ar' ? labels.ar : labels.en) : null,
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
        return {
          id: saved.id,
          analysis: result,
          linkedinUrl: normalizedUrl,
          tokensUsed: TOKEN_COST,
          tokensRemaining: deduct.balance_after,
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

      const dimensionChanges = (olderData?.dimensions || []).map((oldDim: any) => {
        const newDim = (newerData?.dimensions || []).find((d: any) => d.name === oldDim.name);
        const oldScore = typeof oldDim.score === 'number' ? oldDim.score : 0;
        const newScore = newDim && typeof newDim.score === 'number' ? newDim.score : oldScore;
        const delta = newScore - oldScore;
        return {
          name: oldDim.name,
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
