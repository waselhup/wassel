import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { logApiCall, mapAnthropicStatusToArabic, mapApifyStatusToArabic, classifyClaudeError, sendClaudeOpsAlert } from '../lib/apiLogger';
import { callClaude, extractText, extractJson } from '../lib/claude-client';
import { scrapeLinkedInProfileMulti, detectLanguage } from '../lib/linkedin-scraper';
import { validateAndNormalizeLinkedInUrl } from '../lib/linkedin-url-validator';
import { generateDocxReport, generatePdfReport } from '../lib/profile-report-generator';

const TARGET_GOAL = z.enum([
  'job-search', 'investment', 'thought-leadership',
  'sales-b2b', 'career-change', 'internal-promotion',
]);

const INDUSTRY = z.enum([
  'oil-gas', 'tech', 'finance', 'healthcare', 'legal',
  'consulting', 'government', 'academic', 'entrepreneurship', 'real-estate', 'other',
]);

const REPORT_LANGUAGE = z.enum(['ar', 'en']);

// ── Profile Radar v4 — anti-hallucination system prompt ────────────────────
//
// v3 hallucinated heavily. Root cause: prompt told Claude to "always reference
// the specific industry" + listed industry-specific buzzwords (Tadawul/SAMA/PCI-DSS).
// Claude obediently invented those references when the actual profile was sparse.
//
// v4 binds every claim to evidence in the input data and refuses to invent
// industries, geographies, certifications, or markets that are not in the
// profile verbatim.
const PROFILE_RADAR_SYSTEM = `You are a senior LinkedIn profile reviewer. You analyze profile data the user provides and produce strict, evidence-bound feedback.

═══════════════════════════════════════
ANTI-HALLUCINATION RULES (NON-NEGOTIABLE)
═══════════════════════════════════════

1. EVIDENCE-BOUND CLAIMS
   - You will receive structured profile data in JSON.
   - Every observation, score, recommendation, or example you produce MUST be traceable to a specific value present in that input.
   - If a fact is not in the input, you do not state it. Do not infer industries from job titles alone. Do not infer markets/countries from names. Do not infer certifications from roles.

2. NO INVENTED CONTEXT
   - DO NOT mention any country, city, market, or geography unless it appears verbatim in the profile data (location, experience.location, education).
   - DO NOT mention any company unless it appears in profile.experience[].company.
   - DO NOT mention any standard, regulation, certification, or framework (e.g. PCI-DSS, SAMA CSF, ISO 27001, HIPAA, GDPR, PMP) unless it appears in profile.certifications[] or profile.skills[] or profile.summary.
   - DO NOT mention any industry vertical (banking, fintech, oil & gas, etc.) as a fact about the candidate unless it is supported by their actual experience entries.
   - The user-supplied "industry" is their TARGET market — it is the lens for advice ("here is what THIS market expects"), NOT a description of the candidate's current background. Only describe the candidate's background using their actual data.

3. SPARSE-DATA HANDLING
   - The input includes profile_completeness (0-100). If completeness < 40, you MUST set "data_quality" to "insufficient" and produce a short verdict explaining what is missing. Do not score dimensions that have no underlying data.
   - For each dimension where the corresponding source field is missing/empty, set score to null (not 0) and feedback to a short note like "no data — section is empty or private".
   - Never invent a "sample" experience to score against. Never assume a default industry.

4. CONFIDENCE DECLARATION
   - Output a top-level "confidence" field: "high" | "medium" | "low".
     * high: completeness >= 70 AND >= 2 experience entries with descriptions
     * medium: completeness 40-69 OR experience present but thin
     * low: completeness < 40 OR fewer than 2 meaningful sections
   - When confidence is low, recommendations focus on "fill these missing fields" — not on advanced positioning advice.

5. TRACEABILITY EXAMPLES
   - GOOD: "Headline mentions 'Sales Lead' with no quantifiable result. Add a metric."
     (traceable: profile.headline contains "Sales Lead")
   - BAD: "As a fintech professional in Riyadh, you should reference SAMA CSF compliance."
     (untraceable: invents "fintech", "Riyadh", and "SAMA CSF")
   - BAD: "Your background in channel sales in Turkey suggests..."
     (untraceable: invents geography and a narrative)

═══════════════════════════════════════
TASK
═══════════════════════════════════════

Analyze the candidate's LinkedIn profile against:
- target_goal: what the candidate wants from this profile
- industry: the target market they want to be visible to (this informs ADVICE, not biography)
- target_role / target_company: optional aim points

Goal lenses (use these to frame advice, never to invent facts):
- job-search → recruiter scannability, ATS keywords, quick credibility signals
- investment → founder credibility, traction signals, story arc
- thought-leadership → unique POV, content consistency, peer authority
- sales-b2b → trust signals, social proof, response triggers
- career-change → transferable skills visibility, pivot framing
- internal-promotion → scope signals, business impact, leadership indicators

═══════════════════════════════════════
OUTPUT
═══════════════════════════════════════

Return valid JSON ONLY. No markdown, no code fences. Start with { end with }. Use the report_language ('ar' = Modern Standard Arabic, 'en' = Professional English) for all human-readable strings. Western digits (0-9) only.

Schema:

{
  "overall_score": number (0-100, calibrated to actual data quality and goal fit),
  "confidence": "high" | "medium" | "low",
  "data_quality": "rich" | "adequate" | "thin" | "insufficient",
  "data_completeness": number (0-100, copy from input),
  "verdict": string (one paragraph in target language — describes what the data SHOWS, not what you imagine),
  "target_alignment": {
    "goal_match_score": number (0-100),
    "notes": string (must reference actual profile content, not assumed background)
  },
  "dimensions": [
    {
      "name": string (in target language),
      "score": number (0-10) | null (null when no data for this dimension),
      "feedback": string (specific reference to what was found OR "no data — empty/private section")
    }
  ],
  "recommendations": string[] (5-7 actions; each action must reference an actual field to add/edit),
  "top_3_priorities": string[] (3 most impactful changes, ordered by impact),
  "vision_2030_alignment": string | null (only include if profile.summary, profile.experience.description, or profile.skills explicitly contain Vision 2030, NEOM, PIF, Aramco, SABIC, ROSHN, NHC, Monsha'at, KAUST, KFUPM, KSU, OR location includes Saudi Arabia / KSA / Riyadh / Jeddah / Dammam / Mecca / Medina. Otherwise return null.),
  "evidence_used": string[] (2-5 short bullets quoting/paraphrasing the EXACT profile content you based your analysis on. This is your traceability proof.)
}

Always include exactly 8 dimensions in this order: Headline, Summary, Experience, Skills, Education, Certifications, Profile Photo, Recommendations.

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

const SYSTEM_ANALYZE_AR = `أنت مستشار LinkedIn محترف للسوق السعودي/الخليجي بخبرة 15 سنة.
مرجعيات: Career Capital (LBS), Personal Brand Equity (Harvard), STAR (Stanford), Vision 2030 HCDP, McKinsey MENA 2024.
قواعد: فصحى، أرقام غربية، توصيات محددة قابلة للقياس، لا عموميات، لا cliché.
أخرج JSON فقط — بدون markdown ولا code fences.`;

const SYSTEM_ANALYZE_EN = `You are a senior LinkedIn coach for the Saudi/GCC market with 15 years of experience.
Frameworks: Career Capital (LBS), Personal Brand Equity (Harvard), STAR (Stanford), Vision 2030 HCDP, McKinsey MENA 2024.
Rules: concise, specific, measurable; no clichés.
Output JSON only — no markdown, no code fences.`;

const SYSTEM_DEEP = `You are an executive career consultant applying Career Capital (LBS), Personal Brand Equity (Harvard), STAR (Stanford), Vision 2030 HCDP, and McKinsey MENA 2024 benchmarks to LinkedIn profiles in the Saudi/GCC market.
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
  "industryTips": "<2-3 sentences for Saudi/GCC market>"
}

Scoring: photo/banner +10 (connections>100 suggests active), headline up to 15, summary up to 15, experience up to 20 (metrics+verbs), skills up to 10 (>=5 relevant), education up to 10, connections (500+=10,200+=7,100+=5,<100=2), keywords up to 10.
Reference Vision 2030 where relevant.

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
  "vision_2030_alignment": {
    "thriving_economy": {"status":"<aligned|partial|missing>","note":"<Arabic short>"},
    "vibrant_society": {"status":"<aligned|partial|missing>","note":"<Arabic short>"},
    "ambitious_nation": {"status":"<aligned|partial|missing>","note":"<Arabic short>"}
  },
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
      try {
        console.log('[LINKEDIN] Analyze request for:', input.profileUrl);

        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        console.log('[LINKEDIN] User token balance:', profile?.token_balance);

        if (!profile || profile.token_balance < 5) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens. Need 5 tokens for analysis.',
          });
        }

        // Check 24h cache first
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

        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 5 })
          .eq('id', ctx.user.id);

        if (updateError) {
          console.error('[LINKEDIN] Token deduction error:', updateError);
          throw updateError;
        }

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
      try {
        console.log('[DEEP] analyzeDeep request, hasUrl:', !!input.linkedinUrl, 'hasImage:', !!input.imageBase64);

        // Check tokens (25 required)
        const { data: profile } = await ctx.supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        if (!profile || profile.token_balance < 25) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'رصيدك غير كافٍ. تحتاج 25 توكن للتحليل العميق.',
          });
        }

        const cacheKey = 'analyzeDeep:' + (input.linkedinUrl ? normalizeLiUrl(input.linkedinUrl) : ctx.user.id);

        // Check cache
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

        // Deduct 25 tokens
        await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - 25 })
          .eq('id', ctx.user.id);

        console.log('[DEEP] Success, score:', result.score, 'tokens:', tokensUsed);
        return result;
      } catch (err: any) {
        console.error('[DEEP] Error:', err?.message || err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'فشل في التحليل العميق',
        });
      }
    }),

  // ── PROFILE RADAR v4 — anti-hallucination ───────────────────────────────
  analyzeTargeted: protectedProcedure
    .input(z.object({
      linkedinUrl: z.string().optional(),
      imageBase64: z.string().optional(),
      mediaType: z.string().optional(),
      targetGoal: TARGET_GOAL,
      industry: INDUSTRY,
      targetRole: z.string().max(200).optional(),
      targetCompany: z.string().max(200).optional(),
      reportLanguage: REPORT_LANGUAGE.default('ar'),
    }))
    .mutation(async ({ input, ctx }) => {
      const TOKEN_COST = 25;
      const lang = input.reportLanguage;

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

      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('token_balance')
        .eq('id', ctx.user.id)
        .single();

      if (!profile || (profile.token_balance || 0) < TOKEN_COST) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: lang === 'ar'
            ? `رصيد التوكن غير كافٍ — تحتاج ${TOKEN_COST} توكن`
            : `Insufficient tokens - need ${TOKEN_COST} tokens`,
        });
      }

      let unifiedProfile: any = null;
      let completeness = 0;
      let missingSections: string[] = [];
      if (normalizedUrl) {
        try {
          const outcome = await scrapeLinkedInProfileMulti(normalizedUrl);
          unifiedProfile = outcome.profile;
          completeness = outcome.completeness;
          missingSections = outcome.missingSections;
        } catch (e: any) {
          console.error('[RADAR] scrape failed:', e?.message);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: lang === 'ar'
              ? 'فشل قراءة البروفايل — تأكد من أن البروفايل عام ومكتمل'
              : 'Failed to read profile — ensure the profile is public and has content',
          });
        }
      }

      // ── Sparse-profile guard ──
      // If completeness is extremely low (< 25%), refuse to analyze — we'd only hallucinate.
      // Image-only flows skip this (no completeness info available).
      if (unifiedProfile && !input.imageBase64 && completeness < 25) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: lang === 'ar'
            ? `بيانات البروفايل غير كافية للتحليل (${completeness}%). الأقسام الناقصة: ${missingSections.join('، ')}. اجعل البروفايل عاماً وأضف محتوى أساسياً ثم حاول مرة أخرى.`
            : `Profile data too sparse to analyze (${completeness}%). Missing: ${missingSections.join(', ')}. Make the profile public and add core content, then retry.`,
        });
      }

      // ── Build structured payload for Claude ──
      // We send actual fields, not a flat text blob — so Claude sees what's empty vs present.
      const p = unifiedProfile;
      const structuredProfile = p ? {
        fullName: p.fullName || null,
        headline: p.headline || null,
        summary: p.summary || null,
        location: p.location || null,
        has_profile_picture: !!p.profilePicture,
        experience: (p.experience || []).slice(0, 8).map((e: any) => ({
          title: e.title || null,
          company: e.company || null,
          duration: e.duration || null,
          location: e.location || null,
          description: e.description ? String(e.description).slice(0, 400) : null,
        })),
        education: (p.education || []).slice(0, 5).map((e: any) => ({
          school: e.school || null,
          degree: e.degree || null,
          field: e.field || null,
          year: e.year || null,
        })),
        skills: (p.skills || []).slice(0, 30),
        certifications: (p.certifications || []).slice(0, 10).map((c: any) => ({
          name: c.name || null,
          issuer: c.issuer || null,
        })),
        languages: (p.languages || []).map((l: any) => ({ name: l.name || null, proficiency: l.proficiency || null })),
        activity_count: (p.activity || []).length,
      } : null;

      const userPayload = {
        target_goal: input.targetGoal,
        industry: input.industry,
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

      let result: any;
      const _t0 = Date.now();
      try {
        const claudeRes = await callClaude({
          task: 'profile_analysis',
          system: PROFILE_RADAR_SYSTEM,
          userContent,
          maxTokens: 6000,
          temperature: 0.3, // lower temp = less invention
        });
        await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyzeTargeted', statusCode: 200, responseTimeMs: Date.now() - _t0, userId: ctx.user?.id });
        const text = extractText(claudeRes);
        result = extractJson<any>(text);
        if (!result || typeof result.overall_score !== 'number') {
          console.error('[RADAR] JSON parse failed. Raw:', text.substring(0, 500));
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: lang === 'ar' ? 'فشل تحليل الرد من الذكاء الاصطناعي' : 'Failed to parse analysis response' });
        }
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        const status = err?.status || 500;
        const body = err?.responseBody || err?.body || err?.message || '';
        const info = classifyClaudeError(status, body);
        await logApiCall({ service: 'anthropic', endpoint: '/v1/messages:analyzeTargeted', statusCode: status, responseTimeMs: Date.now() - _t0, errorMsg: info.devDetail, userId: ctx.user?.id });
        if (info.alertOps) void sendClaudeOpsAlert(info, '/v1/messages:analyzeTargeted');
        const code = status === 429 ? 'TOO_MANY_REQUESTS' : (status === 401 || status === 403) ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR';
        throw new TRPCError({ code, message: info.userMessage });
      }

      // ── Post-hoc response normalization ──
      // Guarantee the shape the UI relies on even if Claude drifts.
      if (!Array.isArray(result.dimensions)) result.dimensions = [];
      if (!Array.isArray(result.recommendations)) result.recommendations = [];
      if (!Array.isArray(result.top_3_priorities)) result.top_3_priorities = [];
      if (typeof result.confidence !== 'string') {
        result.confidence = completeness >= 70 ? 'high' : completeness >= 40 ? 'medium' : 'low';
      }
      if (typeof result.data_completeness !== 'number') {
        result.data_completeness = completeness;
      }

      // Clamp vision_2030_alignment: only allow it if the profile actually contains KSA/Vision-2030 markers.
      // If Claude wrote something but no markers exist, null it.
      if (result.vision_2030_alignment) {
        const hayEntries: string[] = [];
        if (p) {
          hayEntries.push(p.summary || '');
          hayEntries.push(p.headline || '');
          hayEntries.push(p.location || '');
          for (const e of (p.experience || [])) {
            hayEntries.push(e.description || '');
            hayEntries.push(e.company || '');
            hayEntries.push(e.location || '');
          }
          for (const s of (p.skills || [])) hayEntries.push(String(s));
          for (const c of (p.certifications || [])) { hayEntries.push(c.name || ''); hayEntries.push(c.issuer || ''); }
        }
        const hay = hayEntries.join(' ').toLowerCase();
        const hasKSA = /(saudi|ksa|riyadh|jeddah|dammam|mecca|makkah|medina|madinah|المملكة|الرياض|جدة|الدمام|السعودية|vision 2030|neom|pif|aramco|sabic|roshn|monsha'?at|kaust|kfupm|ksu|الرؤية ?2030)/i.test(hay);
        if (!hasKSA) {
          result.vision_2030_alignment = null;
        }
      }

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
        console.error('[RADAR] save error:', saveErr);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: saveErr.message });
      }

      await ctx.supabase
        .from('profiles')
        .update({ token_balance: (profile.token_balance || 0) - TOKEN_COST })
        .eq('id', ctx.user.id);

      return {
        id: saved.id,
        analysis: result,
        linkedinUrl: normalizedUrl,
        tokensUsed: TOKEN_COST,
      };
    }),

  exportReport: protectedProcedure
    .input(z.object({
      analysisId: z.string().uuid(),
      format: z.enum(['pdf', 'docx']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { data: analysis } = await ctx.supabase
        .from('profile_analyses')
        .select('*')
        .eq('id', input.analysisId)
        .eq('user_id', ctx.user.id)
        .single();

      if (!analysis) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'التحليل غير موجود' });
      }

      if (input.format === 'docx') {
        const DOCX_COST = 5;
        if (!analysis.docx_generated) {
          const { data: profile } = await ctx.supabase
            .from('profiles')
            .select('token_balance')
            .eq('id', ctx.user.id)
            .single();

          if (!profile || (profile.token_balance || 0) < DOCX_COST) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `رصيد غير كافٍ — DOCX يحتاج ${DOCX_COST} توكن إضافية`,
            });
          }

          await ctx.supabase
            .from('profiles')
            .update({ token_balance: (profile.token_balance || 0) - DOCX_COST })
            .eq('id', ctx.user.id);

          await ctx.supabase
            .from('profile_analyses')
            .update({ docx_generated: true })
            .eq('id', input.analysisId);
        }
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

      let buffer: Buffer;
      let mimeType: string;
      let filename: string;

      if (input.format === 'pdf') {
        buffer = generatePdfReport(reportOpts);
        mimeType = 'application/pdf';
        filename = `profile-analysis-${analysis.id.slice(0, 8)}.pdf`;
      } else {
        buffer = await generateDocxReport(reportOpts);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        filename = `profile-analysis-${analysis.id.slice(0, 8)}.docx`;
      }

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
        const delta = newDim ? newDim.score - oldDim.score : 0;
        return {
          name: oldDim.name,
          before: oldDim.score,
          after: newDim?.score ?? oldDim.score,
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
        stillNeedsWork: dimensionChanges.filter((c: any) => c.after < 7).map((c: any) => c.name),
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
