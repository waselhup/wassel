import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { callClaude, extractText, extractJson } from './claude-client';
import { validateOutput } from './output-guard';
import {
  getCareerProfileWithOverrides,
  listActiveSectionOverrides,
  type CareerProfile,
} from './career-profile';
import { deductTokens, refundTokens, type DeductedBreakdown } from './wallets';
import { scrapeLinkedInProfileHybrid } from '../services/profile-scraper';
import {
  resumeFullBuildPrompt,
  resumePerSectionRefinementPrompt,
} from '../prompts/_generated';
import { withBrain } from '../prompts/brain';

/**
 * Resume v2 engine — Career Copilot's targeted ATS resume builder.
 *
 * Flow (Bowling-Lane Rules per R03):
 *   1. Read career_profile + radar override (R02 — never re-ask the user)
 *   2. Scrape LinkedIn (NOT_FOUND short-circuits before any deduction)
 *   3. Compute profile_hash; check resume_cache (R09 cache hit = 0 tokens)
 *   4. On miss: deduct tokens FIRST → run build → on failure, refund
 *   5. Compute deterministic ATS Score V1 (K40/S25/F20/Q15)
 *   6. Write resume_cache, resume_versions; bump profile.last_resume_*
 *
 * Two write operations:
 *   - Full build  : 179 tokens, generates resume from scratch
 *   - New version : 49 tokens, reuses normalized experience for a different
 *                   target role (parent_resume_id links to the source build)
 *
 * Refinement (per-section iteration):
 *   - First 5 per version are FREE (R12)
 *   - Subsequent refinements cost 5 tokens each
 *
 * Archive First Policy:
 *   - Versions never delete — `status` moves active → archived → restored
 *   - Legacy rows from pre-Copilot cv_versions land with status='legacy' and
 *     are read-only inside the new editor.
 */

// ─────────────────────────────────────────────
// Output schema (matches resumeFullBuildPrompt.schema, with computed meta)
// ─────────────────────────────────────────────

export const ResumeSchema = z.object({
  header: z.object({
    name: z.string(),
    title: z.string(),
    location: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    linkedin_url: z.string().nullable(),
  }),
  summary: z.string(),
  experience: z.array(z.object({
    role: z.string(),
    company: z.string(),
    location: z.string().nullable(),
    start: z.string(),
    end: z.string(),
    bullets: z.array(z.string()),
  })),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    graduated: z.string(),
    honors: z.string().nullable(),
  })),
  skills: z.object({
    hard: z.array(z.string()),
    soft: z.array(z.string()),
  }),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string(),
    year: z.string(),
  })).default([]),
  languages: z.array(z.object({
    name: z.string(),
    proficiency: z.string(),
  })).default([]),
  meta: z.object({
    target_role: z.string(),
    template_id: z.string(),
    profile_hash: z.string(),
    language: z.enum(['ar', 'en']),
    version_label: z.string(),
    generated_at: z.string(),
  }),
});

export type Resume = z.infer<typeof ResumeSchema>;

export type AtsBreakdown = {
  keywords: number;
  sections: number;
  format: number;
  quantified: number;
  matched_keywords: string[];
  missing_keywords: string[];
  issues: string[];
};

export type AtsScoreResult = {
  total: number;
  breakdown: AtsBreakdown;
};

export type ResumeTemplate = {
  id: string;
  display_name_ar: string;
  display_name_en: string;
  description_ar: string | null;
  description_en: string | null;
  layout_type: 'classic' | 'modern' | 'creative' | 'executive';
  region_fit: string[];
  language_fit: string[];
  level_fit: string[];
  industry_boost: string[] | null;
  is_active: boolean;
  preview_url: string | null;
};

// ─────────────────────────────────────────────
// Costs (kept inline so callers don't drift; PRD says 179/49/5)
// ─────────────────────────────────────────────

export const RESUME_FULL_BUILD_COST = 179;
export const RESUME_NEW_VERSION_COST = 49;
export const RESUME_PAID_REFINEMENT_COST = 5;
export const RESUME_FREE_REFINEMENTS_PER_VERSION = 5;

// ─────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────

export class ResumeError extends Error {
  code:
    | 'NO_CAREER_PROFILE'
    | 'NO_LINKEDIN_URL'
    | 'LINKEDIN_NOT_FOUND'
    | 'INSUFFICIENT_TOKENS'
    | 'MODEL_FAILED'
    | 'TEMPLATE_NOT_FOUND'
    | 'PARENT_NOT_FOUND'
    | 'VERSION_NOT_FOUND'
    | 'LEGACY_READ_ONLY'
    | 'INTERNAL';
  details?: unknown;
  constructor(code: ResumeError['code'], message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// ─────────────────────────────────────────────
// Hash + helpers
// ─────────────────────────────────────────────

export function computeProfileHash(linkedinData: unknown, careerProfile: CareerProfile, targetRole: string): string {
  const p = (linkedinData ?? {}) as Record<string, unknown>;
  const stable = JSON.stringify({
    headline: p.headline ?? null,
    about: p.about ?? p.summary ?? null,
    experience: Array.isArray(p.experience)
      ? (p.experience as Array<Record<string, unknown>>).map((e) => ({
          title: e.title ?? null,
          company: e.company ?? null,
          duration: e.duration ?? null,
        }))
      : [],
    education: Array.isArray(p.education) ? p.education : [],
    skills: Array.isArray(p.skills) ? p.skills : [],
    manual: {
      about: careerProfile.manual_about,
      top_skills: careerProfile.manual_top_skills,
      years: careerProfile.manual_years_experience,
      education: careerProfile.manual_education,
    },
    target: targetRole,
  });
  return createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

function summarizeDebited(debited: DeductedBreakdown): 'bonus' | 'subscription' | 'topup' | 'mixed' | null {
  if (!Array.isArray(debited) || debited.length === 0) return null;
  if (debited.length === 1) return debited[0].wallet;
  return 'mixed';
}

// ─────────────────────────────────────────────
// Template recommendation (Sprint 4 prompt — A06-style algorithm)
// ─────────────────────────────────────────────

/**
 * The deterministic reason codes recommendTemplate attaches to each scored
 * template. The UI maps these to localized copy ("اخترنا MIT لأن الدور تقني…").
 * #24/#26: the ranking is algorithmic; the words around it are localized in the
 * client, never authored by a model.
 */
export type TemplateReasonCode =
  | 'level-match'
  | 'region-match'
  | 'global-fallback'
  | 'language-match'
  | 'industry-boost';

export type ScoredTemplate = {
  template: ResumeTemplate;
  score: number;
  reasons: TemplateReasonCode[];
};

export function recommendTemplate(
  profile: Pick<CareerProfile, 'level' | 'industry' | 'primary_language'> & { region?: 'saudi' | 'gcc' | 'global' },
  templates: ResumeTemplate[],
  language: 'ar' | 'en',
): { primary: ResumeTemplate; alternatives: ResumeTemplate[]; scored: ScoredTemplate[] } {
  const region = profile.region ?? (profile.primary_language === 'ar' ? 'saudi' : 'global');
  const industry = (profile.industry ?? '').toLowerCase();

  const scored: ScoredTemplate[] = templates
    .filter((t) => t.is_active && t.language_fit.includes(language))
    .map((t) => {
      let score = 0;
      const reasons: TemplateReasonCode[] = [];

      if (t.level_fit.includes(profile.level)) {
        score += 40;
        reasons.push('level-match');
      }
      if (t.region_fit.includes(region)) {
        score += 25;
        reasons.push('region-match');
      } else if (t.region_fit.includes('global')) {
        score += 15;
        reasons.push('global-fallback');
      }
      if (t.language_fit.includes(language)) {
        score += 15;
        reasons.push('language-match');
      }
      if (t.industry_boost && t.industry_boost.some((b) => industry.includes(b.toLowerCase()))) {
        score += 20;
        reasons.push('industry-boost');
      }
      // Tiny tie-breaker so the order is stable when scores tie
      score += t.id.length * 0.01;

      return { template: t, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    throw new ResumeError('TEMPLATE_NOT_FOUND', 'No active templates match this user.');
  }

  return {
    primary: scored[0].template,
    alternatives: scored.slice(1, 4).map((s) => s.template),
    // Top-4 scored entries with reasons, so the UI can explain WHY the primary
    // was chosen and what each alternative offers (M3 — surface reasons[]).
    scored: scored.slice(0, 4),
  };
}

// ─────────────────────────────────────────────
// ATS Score V1 — deterministic, per Sprint 4 prompt
// Keywords 40% + Sections 25% + Format 20% + Quantified 15%
// ─────────────────────────────────────────────

export const ATS_REQUIRED_SECTIONS = ['summary', 'experience', 'education', 'skills'] as const;
const QUANTIFIED_RE = /(\d+(\.\d+)?\s*(%|٪)|\$\s*\d+|﷼\s*\d+|SAR\s*\d+|\d+x\s|\d+ years?|\d+ months?|\d+\+)/i;

export function derivedKeywords(targetRole: string, industry: string): string[] {
  const tokens = [
    ...targetRole.toLowerCase().split(/\s+/),
    ...industry.toLowerCase().split(/\s+/),
  ]
    .map((t) => t.replace(/[^a-z0-9؀-ۿ]+/g, ''))
    .filter((t) => t.length >= 3);

  const extras: Record<string, string[]> = {
    product: ['roadmap', 'metrics', 'okrs', 'stakeholders'],
    manager: ['leadership', 'mentored', 'led', 'cross-functional'],
    data: ['sql', 'python', 'dashboard', 'analytics'],
    engineer: ['design', 'shipped', 'system', 'architecture'],
    designer: ['figma', 'wireframes', 'prototyping', 'usability'],
    marketing: ['campaign', 'growth', 'funnel', 'positioning'],
    sales: ['pipeline', 'quota', 'crm', 'arr'],
    finance: ['budget', 'forecast', 'reporting', 'compliance'],
  };
  for (const [key, terms] of Object.entries(extras)) {
    if (targetRole.toLowerCase().includes(key)) tokens.push(...terms);
  }

  return Array.from(new Set(tokens));
}

function flattenResumeText(resume: Resume): string {
  const parts: string[] = [
    resume.header.title,
    resume.summary,
    ...resume.experience.flatMap((e) => [e.role, e.company, ...e.bullets]),
    ...resume.skills.hard,
    ...resume.skills.soft,
    ...resume.certifications.map((c) => `${c.name} ${c.issuer}`),
  ];
  return parts.join(' ').toLowerCase();
}

export function computeAtsScore(resume: Resume, targetRole: string, industry: string): AtsScoreResult {
  // 1. Keywords (40%)
  const keywords = derivedKeywords(targetRole, industry);
  const text = flattenResumeText(resume);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    if (!k) continue;
    if (text.includes(k)) matched.push(k);
    else missing.push(k);
  }
  const kwRatio = keywords.length > 0 ? matched.length / keywords.length : 0.7;
  const keywordsScore = Math.round(kwRatio * 40);

  // 2. Sections (25%)
  const hasSummary = (resume.summary ?? '').trim().length > 0;
  const hasExperience = (resume.experience ?? []).length > 0;
  const hasEducation = (resume.education ?? []).length > 0;
  const hasSkills = (resume.skills?.hard?.length ?? 0) + (resume.skills?.soft?.length ?? 0) > 0;
  const sectionsPresent = [hasSummary, hasExperience, hasEducation, hasSkills].filter(Boolean).length;
  const sectionsScore = Math.round((sectionsPresent / ATS_REQUIRED_SECTIONS.length) * 25);

  // 3. Format (20%) — bullet style, date format, no emoji-likes
  const issues: string[] = [];
  let formatScore = 20;
  const allBullets = resume.experience.flatMap((e) => e.bullets);
  if (allBullets.some((b) => b.length > 220)) {
    formatScore -= 5;
    issues.push('long_bullet');
  }
  if (allBullets.some((b) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(b))) {
    formatScore -= 5;
    issues.push('emoji_in_bullets');
  }
  if (resume.experience.some((e) => !/^\d{4}-\d{2}$|^present$/.test(e.start) || !/^\d{4}-\d{2}$|^present$/.test(e.end))) {
    formatScore -= 5;
    issues.push('non_iso_dates');
  }
  if ((resume.summary ?? '').length > 480) {
    formatScore -= 5;
    issues.push('long_summary');
  }
  formatScore = Math.max(0, formatScore);

  // 4. Quantified achievements (15%) — % of bullets with a number/percent/range
  const totalBullets = allBullets.length;
  const quantifiedBullets = allBullets.filter((b) => QUANTIFIED_RE.test(b)).length;
  const qRatio = totalBullets > 0 ? quantifiedBullets / totalBullets : 0;
  const quantifiedScore = Math.round(qRatio * 15);

  const total = Math.max(0, Math.min(100, keywordsScore + sectionsScore + formatScore + quantifiedScore));

  return {
    total,
    breakdown: {
      keywords: keywordsScore,
      sections: sectionsScore,
      format: formatScore,
      quantified: quantifiedScore,
      matched_keywords: matched,
      missing_keywords: missing,
      issues,
    },
  };
}

// ─────────────────────────────────────────────
// Target-profile benchmark (M3) — internal, honest, deterministic.
//
// Replaces the idea of a "market audit". We claim NO external market data
// (#24): the "ideal target for this role" is a deterministic reference score
// derived from what a complete, well-quantified resume for this seniority
// would achieve on Wassel's OWN 4-component ATS algorithm (K40/S25/F20/Q15).
//
// Construction (transparent, reproducible — #26):
//   - sections: a model resume has all 4 → full 25.
//   - format:   a model resume is clean → full 20.
//   - keywords: a model resume covers most expected role keywords. We use a
//     seniority-scaled coverage ceiling (executives are expected to cover more
//     of the role vocabulary than entry candidates), never 100% — even an
//     ideal resume leaves keyword headroom, mirroring R10 ("never claim 100").
//   - quantified: a model resume quantifies most but not all bullets.
// The target is capped at TARGET_PROFILE_CAP so it always sits below a perfect
// 100, and is ALWAYS ≥ the user's current score (a benchmark you've already
// passed isn't a benchmark — we lift it to current+1 in that rare case).
// ─────────────────────────────────────────────

export const TARGET_PROFILE_CAP = 92;

const LEVEL_KEYWORD_COVERAGE: Record<string, number> = {
  entry: 0.7,
  mid: 0.8,
  senior: 0.85,
  executive: 0.9,
};
const LEVEL_QUANTIFIED_COVERAGE: Record<string, number> = {
  entry: 0.55,
  mid: 0.65,
  senior: 0.75,
  executive: 0.8,
};

export type BenchmarkComponent = {
  key: 'keywords' | 'sections' | 'format' | 'quantified';
  you: number;
  ideal: number;
  max: number;
};

export type TargetProfileBenchmark = {
  /** The user's current ATS total (echoed from the supplied breakdown). */
  you: number;
  /** The deterministic ideal-resume reference total for this role+level. */
  ideal: number;
  /** ideal − you, never negative. */
  gap: number;
  level: string;
  /** Per-component you-vs-ideal so the UI can show where the gap sits. */
  components: BenchmarkComponent[];
};

/**
 * Compute the internal target-profile benchmark for a role at a seniority
 * level, given the user's current ATS breakdown. Pure + deterministic.
 */
export function computeTargetProfileBenchmark(
  currentBreakdown: AtsBreakdown,
  currentTotal: number,
  level: string,
): TargetProfileBenchmark {
  const kwCoverage = LEVEL_KEYWORD_COVERAGE[level] ?? 0.8;
  const qCoverage = LEVEL_QUANTIFIED_COVERAGE[level] ?? 0.65;

  const idealKeywords = Math.round(40 * kwCoverage);
  const idealSections = 25; // a model resume has all required sections
  const idealFormat = 20; // a model resume is ATS-clean
  const idealQuantified = Math.round(15 * qCoverage);
  const idealRaw = idealKeywords + idealSections + idealFormat + idealQuantified;
  const ideal = Math.max(currentTotal + 1, Math.min(TARGET_PROFILE_CAP, idealRaw));

  const components: BenchmarkComponent[] = [
    { key: 'keywords', you: currentBreakdown.keywords, ideal: idealKeywords, max: 40 },
    { key: 'sections', you: currentBreakdown.sections, ideal: idealSections, max: 25 },
    { key: 'format', you: currentBreakdown.format, ideal: idealFormat, max: 20 },
    { key: 'quantified', you: currentBreakdown.quantified, ideal: idealQuantified, max: 15 },
  ];

  return {
    you: currentTotal,
    ideal,
    gap: Math.max(0, ideal - currentTotal),
    level,
    components,
  };
}

// ─────────────────────────────────────────────
// Template loader
// ─────────────────────────────────────────────

export async function loadTemplates(supabase: SupabaseClient, language?: 'ar' | 'en'): Promise<ResumeTemplate[]> {
  const { data, error } = await supabase
    .from('resume_templates')
    .select('*')
    .eq('is_active', true);
  if (error || !data) {
    throw new ResumeError('INTERNAL', `Templates query failed: ${error?.message ?? 'unknown'}`);
  }
  const rows = data as ResumeTemplate[];
  if (language) {
    return rows.filter((t) => t.language_fit.includes(language));
  }
  return rows;
}

// ─────────────────────────────────────────────
// Preflight — what /v2/cvs/new needs
// ─────────────────────────────────────────────

export type PreflightResult = {
  ready: boolean;
  profile: Pick<CareerProfile, 'target_role' | 'industry' | 'level' | 'linkedin_url' | 'primary_language'> | null;
  recommendedTemplate: ResumeTemplate | null;
  alternativeTemplates: ResumeTemplate[];
  /**
   * Per-template reason codes (M3 — surface recommendTemplate's reasons[]).
   * Keyed by template id; the UI maps the codes to localized "why" copy.
   */
  templateReasons: Record<string, TemplateReasonCode[]>;
  hasCache: boolean;
  latestCacheId: string | null;
  latestVersionId: string | null;
  estimatedCost: number;
  activeVersionsCount: number;
  archivedCount: number;
  legacyCount: number;
};

export async function preflight(
  supabase: SupabaseClient,
  userId: string,
  language: 'ar' | 'en' = 'ar',
): Promise<PreflightResult> {
  const profile = await getCareerProfileWithOverrides(supabase, userId, 'resume');

  // Counts run regardless of profile presence
  const [{ count: activeCount }, { count: archivedCount }, { count: legacyCount }] = await Promise.all([
    supabase.from('resume_versions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    supabase.from('resume_versions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'archived'),
    supabase.from('resume_versions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'legacy'),
  ]);

  if (!profile) {
    return {
      ready: false,
      profile: null,
      recommendedTemplate: null,
      alternativeTemplates: [],
      templateReasons: {},
      hasCache: false,
      latestCacheId: null,
      latestVersionId: null,
      estimatedCost: RESUME_FULL_BUILD_COST,
      activeVersionsCount: activeCount ?? 0,
      archivedCount: archivedCount ?? 0,
      legacyCount: legacyCount ?? 0,
    };
  }

  const templates = await loadTemplates(supabase, language);
  const { primary, alternatives, scored } = recommendTemplate(profile, templates, language);
  const templateReasons: Record<string, TemplateReasonCode[]> = {};
  for (const s of scored) templateReasons[s.template.id] = s.reasons;

  const { data: latest } = await supabase
    .from('resume_cache')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('target_role', profile.target_role)
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestVersionId: string | null = null;
  if (latest) {
    const { data: ver } = await supabase
      .from('resume_versions')
      .select('id')
      .eq('user_id', userId)
      .eq('cache_id', latest.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    latestVersionId = ver?.id ?? null;
  }

  return {
    ready: Boolean(profile.linkedin_url),
    profile: {
      target_role: profile.target_role,
      industry: profile.industry,
      level: profile.level,
      linkedin_url: profile.linkedin_url,
      primary_language: profile.primary_language,
    },
    recommendedTemplate: primary,
    alternativeTemplates: alternatives,
    templateReasons,
    hasCache: Boolean(latest),
    latestCacheId: latest?.id ?? null,
    latestVersionId,
    estimatedCost: latest ? 0 : RESUME_FULL_BUILD_COST,
    activeVersionsCount: activeCount ?? 0,
    archivedCount: archivedCount ?? 0,
    legacyCount: legacyCount ?? 0,
  };
}

// ─────────────────────────────────────────────
// Full build
// ─────────────────────────────────────────────

export type RunResumeBuildOpts = {
  userId: string;
  language?: 'ar' | 'en';
  templateId: string;
  overrideTargetRole?: string;
  forceRefresh?: boolean;
};

export type RunResumeBuildResult = {
  result: Resume;
  isCacheHit: boolean;
  tokensCharged: number;
  walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
  cacheId: string;
  versionId: string;
  atsScore: number;
  atsBreakdown: AtsBreakdown;
};

export async function runResumeBuild(
  supabase: SupabaseClient,
  opts: RunResumeBuildOpts,
): Promise<RunResumeBuildResult> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  const profile = await getCareerProfileWithOverrides(supabase, opts.userId, 'resume');
  if (!profile) throw new ResumeError('NO_CAREER_PROFILE', 'Career profile missing.');
  const targetRole = opts.overrideTargetRole?.trim() || profile.target_role;
  if (!profile.linkedin_url) throw new ResumeError('NO_LINKEDIN_URL', 'LinkedIn URL missing in career profile.');

  // Validate template exists
  const { data: tmpl } = await supabase
    .from('resume_templates')
    .select('*')
    .eq('id', opts.templateId)
    .maybeSingle();
  if (!tmpl) throw new ResumeError('TEMPLATE_NOT_FOUND', `Template ${opts.templateId} not found.`);

  // Active override id (best-effort, for traceability)
  let activeOverrideId: string | null = null;
  if (opts.overrideTargetRole) {
    const list = await listActiveSectionOverrides(supabase, opts.userId);
    activeOverrideId = list.find((o) => o.section === 'resume')?.id ?? null;
  }

  // Scrape (NOT_FOUND BEFORE deduction)
  let unifiedProfile: unknown;
  try {
    const outcome = await scrapeLinkedInProfileHybrid(profile.linkedin_url);
    unifiedProfile = outcome.profile;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e?.code === 'NOT_FOUND' || e?.code === 'URL_MISMATCH') {
      throw new ResumeError(
        'LINKEDIN_NOT_FOUND',
        language === 'ar' ? 'تعذّر الوصول إلى بروفايل لينكد إن' : 'LinkedIn profile unreachable.',
        { reason: e.code },
      );
    }
    throw new ResumeError('INTERNAL', `LinkedIn scrape failed: ${e?.message ?? 'unknown'}`);
  }
  const profileHash = computeProfileHash(unifiedProfile, profile, targetRole);

  // Cache lookup (mirrors the radar forceRefresh fix). The lookup is keyed on
  // profile_hash, so it runs UNCONDITIONALLY — even under forceRefresh. Rationale
  // (#26 + Bowling-Lane: never spend AI with no value):
  //   • Same profile_hash → identical model input ⇒ identical resume. A forced
  //     re-build would burn the full-build cost regenerating the same document, so
  //     we serve the cached row (0 tokens) and REUSE the latest active version
  //     (the reuse-or-create block below is what makes this safe — resume_versions
  //     is append-only with no DB-level dedupe, so we must reuse, not blindly
  //     insert). This ALSO removes the duplicate-key crash: the bare INSERT below
  //     was colliding with the existing row on the
  //     (user_id, target_role, profile_hash, language) unique key whenever
  //     forceRefresh skipped this block on an already-built profile. (Resume has
  //     no paid unlock flag on the cache result, so there is none to preserve.)
  //   • Different profile_hash (profile actually changed) → this lookup misses (the
  //     hash is part of the key) ⇒ we fall through to the model and INSERT fresh.
  //     So forceRefresh still refreshes the only case where there is something new.
  // forceRefresh therefore means "reflect the latest profile", not "ignore cache".
  {
    const { data: cached } = await supabase
      .from('resume_cache')
      .select('*')
      .eq('user_id', opts.userId)
      .eq('target_role', targetRole)
      .eq('profile_hash', profileHash)
      .eq('language', language)
      .maybeSingle();

    if (cached) {
      await supabase
        .from('resume_cache')
        .update({
          hit_count: (cached.hit_count ?? 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', cached.id);

      // Reuse the latest active version for this cache, or create one if missing.
      const { data: existingVer } = await supabase
        .from('resume_versions')
        .select('id')
        .eq('cache_id', cached.id)
        .eq('user_id', opts.userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let versionId = existingVer?.id ?? '';
      if (!versionId) {
        const { data: newVer } = await supabase
          .from('resume_versions')
          .insert({
            user_id: opts.userId,
            cache_id: cached.id,
            target_role: targetRole,
            display_name: `${targetRole} — ${formatMonthLabel(language)}`,
            template_id: cached.template_id,
            status: 'active',
            ats_score: cached.ats_score,
            tokens_charged: 0,
            language,
          })
          .select('id')
          .single();
        versionId = newVer?.id ?? '';
      }

      return {
        result: cached.result as Resume,
        isCacheHit: true,
        tokensCharged: 0,
        walletUsed: null,
        cacheId: cached.id,
        versionId,
        atsScore: cached.ats_score,
        atsBreakdown: cached.ats_breakdown as AtsBreakdown,
      };
    }
  }

  // Deduct
  const cost = RESUME_FULL_BUILD_COST;
  const deductRes = await deductTokens(supabase, opts.userId, cost, 'resume.v2.build', {
    target_role: targetRole,
    template_id: opts.templateId,
    profile_hash: profileHash,
    language,
  });
  if (!deductRes.success) {
    if (deductRes.error === 'INSUFFICIENT_TOKENS') {
      throw new ResumeError(
        'INSUFFICIENT_TOKENS',
        language === 'ar' ? 'رصيدك غير كافٍ لبناء سيرة جديدة' : 'Not enough tokens to build a new resume.',
        { available: deductRes.available, cost },
      );
    }
    throw new ResumeError('INTERNAL', `Deduction failed: ${deductRes.error}`);
  }

  let resume: Resume;
  let ats: AtsScoreResult;
  try {
    const callResp = await callClaude({
      task: 'cv_generate',
      // Sprint 8 hotfix pattern: append schema + JSON-only directive so
      // Claude emits valid JSON instead of prose. The compiled prompt's
      // `.schema` field is metadata otherwise — never sent to the model.
      system: withBrain(
        resumeFullBuildPrompt.system +
        '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
        resumeFullBuildPrompt.schema,
      ),
      userContent: resumeFullBuildPrompt.user({
        target_role: targetRole,
        industry: profile.industry,
        level: profile.level,
        language,
        normalized_profile: JSON.stringify(unifiedProfile).slice(0, 60000),
        manual_additions: JSON.stringify({
          about: profile.manual_about,
          top_skills: profile.manual_top_skills,
          current_role: profile.manual_current_role,
          years: profile.manual_years_experience,
          education: profile.manual_education,
        }),
        ats_keyword_hints: derivedKeywords(targetRole, profile.industry).join(', '),
      }),
      maxTokens: 5500,
      temperature: 0.35,
    });
    const txt = extractText(callResp);

    // Output Guard: block banned vendor / model names + Eastern Arabic digits
    const validation = validateOutput(txt, 'resume.build');
    if (!validation.valid) {
      throw new ResumeError('MODEL_FAILED', `Output guard blocked: ${validation.reason}`);
    }

    const parsed = extractJson<Record<string, unknown>>(txt);
    if (!parsed) throw new ResumeError('MODEL_FAILED', 'Could not parse Resume JSON.');

    resume = ResumeSchema.parse({
      header: parsed.header ?? {
        name: '', title: targetRole, location: null, phone: null, email: null, linkedin_url: profile.linkedin_url,
      },
      summary: parsed.summary ?? '',
      experience: parsed.experience ?? [],
      education: parsed.education ?? [],
      skills: parsed.skills ?? { hard: [], soft: [] },
      certifications: parsed.certifications ?? [],
      languages: parsed.languages ?? [],
      meta: {
        target_role: targetRole,
        template_id: opts.templateId,
        profile_hash: profileHash,
        language,
        version_label: formatMonthLabel(language),
        generated_at: new Date().toISOString(),
      },
    });

    ats = computeAtsScore(resume, targetRole, profile.industry);
  } catch (err: unknown) {
    await refundTokens(supabase, opts.userId, deductRes.debited, 'resume.v2.build.refund', {
      reason: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof ResumeError) throw err;
    throw new ResumeError(
      'MODEL_FAILED',
      language === 'ar' ? 'فشل بناء السيرة. تم استرداد توكناتك' : 'Resume build failed. Your tokens were refunded.',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  // Persist cache
  const { data: cacheRow, error: cacheErr } = await supabase
    .from('resume_cache')
    .insert({
      user_id: opts.userId,
      target_role: targetRole,
      profile_hash: profileHash,
      template_id: opts.templateId,
      language,
      result: resume,
      ats_score: ats.total,
      ats_breakdown: ats.breakdown,
      tokens_charged: cost,
      is_full_build: true,
      source_linkedin_url: profile.linkedin_url,
    })
    .select('id')
    .single();

  if (cacheErr || !cacheRow) {
    await refundTokens(supabase, opts.userId, deductRes.debited, 'resume.v2.build.persist_failed', {
      reason: cacheErr?.message ?? 'cache_insert_failed',
    });
    throw new ResumeError('INTERNAL', `Cache write failed: ${cacheErr?.message ?? 'unknown'}`);
  }

  const walletUsed = summarizeDebited(deductRes.debited);

  // Persist version row
  const { data: versionRow } = await supabase
    .from('resume_versions')
    .insert({
      user_id: opts.userId,
      cache_id: cacheRow.id,
      target_role: targetRole,
      display_name: `${targetRole} — ${formatMonthLabel(language)}`,
      template_id: opts.templateId,
      status: 'active',
      ats_score: ats.total,
      tokens_charged: cost,
      wallet_used: walletUsed,
      language,
    })
    .select('id')
    .single();

  // Bookkeeping (best-effort) — bump count + last_resume_at
  await supabase
    .from('profiles')
    .update({ last_resume_at: new Date().toISOString() })
    .eq('id', opts.userId);
  await bumpActiveCount(supabase, opts.userId);
  void activeOverrideId; // currently captured only in traces

  return {
    result: resume,
    isCacheHit: false,
    tokensCharged: cost,
    walletUsed,
    cacheId: cacheRow.id,
    versionId: versionRow?.id ?? '',
    atsScore: ats.total,
    atsBreakdown: ats.breakdown,
  };
}

// ─────────────────────────────────────────────
// New version for a different role (49 tokens, reuses experience)
// ─────────────────────────────────────────────

export type CreateVersionForRoleOpts = {
  userId: string;
  language?: 'ar' | 'en';
  parentCacheId: string;
  newTargetRole: string;
  templateId: string;
};

export async function createVersionForRole(
  supabase: SupabaseClient,
  opts: CreateVersionForRoleOpts,
): Promise<RunResumeBuildResult> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  const { data: parent } = await supabase
    .from('resume_cache')
    .select('*')
    .eq('id', opts.parentCacheId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!parent) throw new ResumeError('PARENT_NOT_FOUND', 'Source resume not found.');

  const profile = await getCareerProfileWithOverrides(supabase, opts.userId, 'resume');
  if (!profile) throw new ResumeError('NO_CAREER_PROFILE', 'Career profile missing.');

  const newTarget = opts.newTargetRole.trim();
  if (!newTarget) throw new ResumeError('INTERNAL', 'newTargetRole is required.');

  // Validate template
  const { data: tmpl } = await supabase
    .from('resume_templates')
    .select('id')
    .eq('id', opts.templateId)
    .maybeSingle();
  if (!tmpl) throw new ResumeError('TEMPLATE_NOT_FOUND', `Template ${opts.templateId} not found.`);

  // Reuse parent's experience but re-hash so the cache key differs
  const newHash = createHash('sha256')
    .update(JSON.stringify({ parent: parent.profile_hash, newTarget }))
    .digest('hex')
    .slice(0, 16);

  // Cache check
  const { data: cached } = await supabase
    .from('resume_cache')
    .select('*')
    .eq('user_id', opts.userId)
    .eq('target_role', newTarget)
    .eq('profile_hash', newHash)
    .eq('language', language)
    .maybeSingle();

  if (cached) {
    return {
      result: cached.result as Resume,
      isCacheHit: true,
      tokensCharged: 0,
      walletUsed: null,
      cacheId: cached.id,
      versionId: '',
      atsScore: cached.ats_score,
      atsBreakdown: cached.ats_breakdown as AtsBreakdown,
    };
  }

  // Deduct 49
  const cost = RESUME_NEW_VERSION_COST;
  const deductRes = await deductTokens(supabase, opts.userId, cost, 'resume.v2.new_version', {
    parent_cache_id: opts.parentCacheId,
    new_target_role: newTarget,
    language,
  });
  if (!deductRes.success) {
    if (deductRes.error === 'INSUFFICIENT_TOKENS') {
      throw new ResumeError(
        'INSUFFICIENT_TOKENS',
        language === 'ar' ? 'رصيدك غير كافٍ لإنشاء نسخة جديدة' : 'Not enough tokens for a new version.',
        { available: deductRes.available, cost },
      );
    }
    throw new ResumeError('INTERNAL', `Deduction failed: ${deductRes.error}`);
  }

  let resume: Resume;
  let ats: AtsScoreResult;
  try {
    const parentResume = parent.result as Resume;
    // Re-tailor the language: feed parent's experience + new target, ask for the same shape.
    const callResp = await callClaude({
      task: 'cv_generate',
      // Sprint 8 hotfix pattern — see full build above for rationale.
      system: withBrain(
        resumeFullBuildPrompt.system +
        '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
        resumeFullBuildPrompt.schema,
      ),
      userContent: resumeFullBuildPrompt.user({
        target_role: newTarget,
        industry: profile.industry,
        level: profile.level,
        language,
        normalized_profile: JSON.stringify({
          full_name: parentResume.header.name,
          headline: parentResume.header.title,
          about: parentResume.summary,
          experience: parentResume.experience,
          education: parentResume.education,
          skills: [...parentResume.skills.hard, ...parentResume.skills.soft],
          certifications: parentResume.certifications,
          languages: parentResume.languages,
        }).slice(0, 30000),
        manual_additions: JSON.stringify({ existing_summary: parentResume.summary }),
        ats_keyword_hints: derivedKeywords(newTarget, profile.industry).join(', '),
      }),
      maxTokens: 5500,
      temperature: 0.35,
    });
    const txt = extractText(callResp);

    // Output Guard: block banned vendor / model names + Eastern Arabic digits
    const validation = validateOutput(txt, 'resume.variant');
    if (!validation.valid) {
      throw new ResumeError('MODEL_FAILED', `Output guard blocked: ${validation.reason}`);
    }

    const parsed = extractJson<Record<string, unknown>>(txt);
    if (!parsed) throw new ResumeError('MODEL_FAILED', 'Could not parse Resume JSON.');

    resume = ResumeSchema.parse({
      header: parsed.header ?? parentResume.header,
      summary: parsed.summary ?? parentResume.summary,
      experience: parsed.experience ?? parentResume.experience,
      education: parsed.education ?? parentResume.education,
      skills: parsed.skills ?? parentResume.skills,
      certifications: parsed.certifications ?? parentResume.certifications,
      languages: parsed.languages ?? parentResume.languages,
      meta: {
        target_role: newTarget,
        template_id: opts.templateId,
        profile_hash: newHash,
        language,
        version_label: formatMonthLabel(language),
        generated_at: new Date().toISOString(),
      },
    });
    ats = computeAtsScore(resume, newTarget, profile.industry);
  } catch (err: unknown) {
    await refundTokens(supabase, opts.userId, deductRes.debited, 'resume.v2.new_version.refund', {
      reason: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof ResumeError) throw err;
    throw new ResumeError(
      'MODEL_FAILED',
      language === 'ar' ? 'فشل إنشاء النسخة الجديدة. تم استرداد توكناتك' : 'New version failed. Tokens refunded.',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  const { data: cacheRow, error: cacheErr } = await supabase
    .from('resume_cache')
    .insert({
      user_id: opts.userId,
      target_role: newTarget,
      profile_hash: newHash,
      template_id: opts.templateId,
      language,
      result: resume,
      ats_score: ats.total,
      ats_breakdown: ats.breakdown,
      tokens_charged: cost,
      is_full_build: false,
      parent_resume_id: opts.parentCacheId,
      source_linkedin_url: profile.linkedin_url,
    })
    .select('id')
    .single();

  if (cacheErr || !cacheRow) {
    await refundTokens(supabase, opts.userId, deductRes.debited, 'resume.v2.new_version.persist_failed', {
      reason: cacheErr?.message ?? 'cache_insert_failed',
    });
    throw new ResumeError('INTERNAL', `Cache write failed: ${cacheErr?.message ?? 'unknown'}`);
  }

  const walletUsed = summarizeDebited(deductRes.debited);

  const { data: versionRow } = await supabase
    .from('resume_versions')
    .insert({
      user_id: opts.userId,
      cache_id: cacheRow.id,
      target_role: newTarget,
      display_name: `${newTarget} — ${formatMonthLabel(language)}`,
      template_id: opts.templateId,
      status: 'active',
      ats_score: ats.total,
      tokens_charged: cost,
      wallet_used: walletUsed,
      language,
    })
    .select('id')
    .single();

  await supabase
    .from('profiles')
    .update({ last_resume_at: new Date().toISOString() })
    .eq('id', opts.userId);
  await bumpActiveCount(supabase, opts.userId);

  return {
    result: resume,
    isCacheHit: false,
    tokensCharged: cost,
    walletUsed,
    cacheId: cacheRow.id,
    versionId: versionRow?.id ?? '',
    atsScore: ats.total,
    atsBreakdown: ats.breakdown,
  };
}

// ─────────────────────────────────────────────
// Refinement — per-section iteration (first 5 free, then 5t each)
// ─────────────────────────────────────────────

export type ApplyRefinementOpts = {
  userId: string;
  language?: 'ar' | 'en';
  versionId: string;
  chipType: string;
  customPrompt?: string;
  targetSection?: 'summary' | 'experience' | 'education' | 'skills' | string;
};

export type ApplyRefinementResult = {
  result: Resume;
  ats: AtsScoreResult;
  tokensCharged: number;
  refinementIndex: number;
  isFreeWindow: boolean;
  remainingFree: number;
  cacheId: string;
};

export async function applyRefinement(
  supabase: SupabaseClient,
  opts: ApplyRefinementOpts,
): Promise<ApplyRefinementResult> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  const { data: version } = await supabase
    .from('resume_versions')
    .select('id, cache_id, target_role, language, status, user_id')
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!version) throw new ResumeError('VERSION_NOT_FOUND', 'Resume version not found.');
  if (version.status === 'legacy') {
    throw new ResumeError(
      'LEGACY_READ_ONLY',
      language === 'ar'
        ? 'النسخة القديمة للقراءة فقط. ابدأ نسخة جديدة لتفعيل التحسينات'
        : 'Legacy versions are read-only. Start a new version to refine.',
    );
  }
  if (!version.cache_id) {
    throw new ResumeError('VERSION_NOT_FOUND', 'This version has no cached content to refine.');
  }

  const { data: cache } = await supabase
    .from('resume_cache')
    .select('*')
    .eq('id', version.cache_id)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!cache) throw new ResumeError('VERSION_NOT_FOUND', 'Cached resume missing.');

  // Count existing refinements on this version
  const { count: existingCount } = await supabase
    .from('resume_refinements')
    .select('id', { count: 'exact', head: true })
    .eq('version_id', opts.versionId);
  const refinementIndex = (existingCount ?? 0) + 1;
  const isFreeWindow = refinementIndex <= RESUME_FREE_REFINEMENTS_PER_VERSION;

  // Deduct if past the free window
  let deducted: DeductedBreakdown = [];
  if (!isFreeWindow) {
    const deductRes = await deductTokens(supabase, opts.userId, RESUME_PAID_REFINEMENT_COST, 'resume.v2.refine', {
      version_id: opts.versionId,
      refinement_index: refinementIndex,
      chip_type: opts.chipType,
    });
    if (!deductRes.success) {
      if (deductRes.error === 'INSUFFICIENT_TOKENS') {
        throw new ResumeError(
          'INSUFFICIENT_TOKENS',
          language === 'ar' ? 'رصيدك غير كافٍ للتحسين' : 'Not enough tokens for refinement.',
          { available: deductRes.available, cost: RESUME_PAID_REFINEMENT_COST },
        );
      }
      throw new ResumeError('INTERNAL', `Deduction failed: ${deductRes.error}`);
    }
    deducted = deductRes.debited;
  }

  const section = opts.targetSection ?? chipTypeToSection(opts.chipType);
  const instruction = opts.customPrompt ?? chipTypeToInstruction(opts.chipType, language);
  const currentResume = cache.result as Resume;
  const currentContent = sliceSection(currentResume, section);

  let updatedResume: Resume;
  try {
    const callResp = await callClaude({
      task: 'cv_generate',
      // Sprint 8 hotfix pattern — append schema + JSON-only directive.
      system: withBrain(
        resumePerSectionRefinementPrompt.system +
        '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
        resumePerSectionRefinementPrompt.schema,
      ),
      userContent: resumePerSectionRefinementPrompt.user({
        section_type: section,
        current_content: typeof currentContent === 'string' ? currentContent : JSON.stringify(currentContent),
        instruction,
        language,
        target_role: version.target_role,
      }),
      maxTokens: 2500,
      temperature: 0.4,
    });
    const txt = extractText(callResp);

    // Output Guard: block banned vendor / model names + Eastern Arabic digits
    const validation = validateOutput(txt, 'resume.refine');
    if (!validation.valid) {
      throw new ResumeError('MODEL_FAILED', `Output guard blocked: ${validation.reason}`);
    }

    const parsed = extractJson<{ content: string | string[]; note: string | null }>(txt);
    if (!parsed) throw new ResumeError('MODEL_FAILED', 'Could not parse refinement JSON.');

    updatedResume = applySectionResult(currentResume, section, parsed.content);
  } catch (err: unknown) {
    if (deducted.length > 0) {
      await refundTokens(supabase, opts.userId, deducted, 'resume.v2.refine.refund', {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
    if (err instanceof ResumeError) throw err;
    throw new ResumeError(
      'MODEL_FAILED',
      language === 'ar' ? 'فشل التحسين. لم نخصم أي توكن' : 'Refinement failed. No tokens charged.',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  // Re-score
  const profile = await getCareerProfileWithOverrides(supabase, opts.userId, 'resume');
  const ats = computeAtsScore(updatedResume, version.target_role, profile?.industry ?? '');

  // Persist updated cache
  await supabase
    .from('resume_cache')
    .update({
      result: updatedResume,
      ats_score: ats.total,
      ats_breakdown: ats.breakdown,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', cache.id);

  await supabase
    .from('resume_versions')
    .update({
      ats_score: ats.total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.versionId);

  await supabase.from('resume_refinements').insert({
    user_id: opts.userId,
    version_id: opts.versionId,
    cache_id: cache.id,
    refinement_index: refinementIndex,
    chip_type: opts.chipType,
    target_section: section,
    prompt: instruction,
    result_diff: { section },
    tokens_charged: isFreeWindow ? 0 : RESUME_PAID_REFINEMENT_COST,
  });

  return {
    result: updatedResume,
    ats,
    tokensCharged: isFreeWindow ? 0 : RESUME_PAID_REFINEMENT_COST,
    refinementIndex,
    isFreeWindow,
    remainingFree: Math.max(0, RESUME_FREE_REFINEMENTS_PER_VERSION - refinementIndex),
    cacheId: cache.id,
  };
}

// ─────────────────────────────────────────────
// Archive / restore (A08 — never delete)
// ─────────────────────────────────────────────

export async function archiveVersion(
  supabase: SupabaseClient,
  opts: { userId: string; versionId: string },
): Promise<{ success: boolean }> {
  const { data: existing } = await supabase
    .from('resume_versions')
    .select('id, status')
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!existing) throw new ResumeError('VERSION_NOT_FOUND', 'Resume version not found.');
  if (existing.status === 'legacy') {
    throw new ResumeError('LEGACY_READ_ONLY', 'Legacy versions cannot be archived.');
  }

  const { error } = await supabase
    .from('resume_versions')
    .update({ status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId);
  if (error) throw new ResumeError('INTERNAL', error.message);
  await bumpActiveCount(supabase, opts.userId);
  return { success: true };
}

export async function restoreVersion(
  supabase: SupabaseClient,
  opts: { userId: string; versionId: string },
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('resume_versions')
    .update({ status: 'active', archived_at: null, updated_at: new Date().toISOString() })
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId);
  if (error) throw new ResumeError('INTERNAL', error.message);
  await bumpActiveCount(supabase, opts.userId);
  return { success: true };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function bumpActiveCount(supabase: SupabaseClient, userId: string): Promise<void> {
  const { count } = await supabase
    .from('resume_versions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  await supabase
    .from('profiles')
    .update({ active_resume_count: count ?? 0 })
    .eq('id', userId);
}

function chipTypeToSection(chip: string): 'summary' | 'experience' | 'skills' | string {
  if (chip.includes('summary')) return 'summary';
  if (chip.includes('bullet') || chip.includes('experience') || chip.includes('verb') || chip.includes('quantified')) return 'experience';
  if (chip.includes('skill')) return 'skills';
  return 'summary';
}

function chipTypeToInstruction(chip: string, lang: 'ar' | 'en'): string {
  const map: Record<string, [string, string]> = {
    shorten_summary: ['اجعل الملخص أقصر مع الحفاظ على القيمة', 'Make the summary shorter while preserving impact.'],
    add_leadership_bullet: ['أضف نقطة عن قيادة الفرق أو المبادرات', 'Add a bullet about leading teams or initiatives.'],
    change_opening_verb: ['غيّر الفعل الافتتاحي في كل نقطة لفعل أقوى', 'Replace the opening verb of every bullet with a stronger action verb.'],
    add_quantified: ['أضف أرقاماً أو نسباً ملموسة للإنجازات', 'Add quantified achievements (numbers, percentages) where possible.'],
    more_professional: ['اجعل اللهجة أكثر احترافية وأقل عاطفية', 'Make the tone more professional and less casual.'],
  };
  const v = map[chip];
  if (!v) return lang === 'ar' ? 'حسّن هذا القسم' : 'Refine this section.';
  return lang === 'ar' ? v[0] : v[1];
}

function sliceSection(resume: Resume, section: string): unknown {
  if (section === 'summary') return resume.summary;
  if (section === 'experience') return resume.experience.flatMap((e) => e.bullets);
  if (section === 'skills') return [...resume.skills.hard, ...resume.skills.soft];
  return resume.summary;
}

function applySectionResult(resume: Resume, section: string, content: string | string[]): Resume {
  const copy: Resume = JSON.parse(JSON.stringify(resume));
  if (section === 'summary' && typeof content === 'string') {
    copy.summary = content;
    return copy;
  }
  if (section === 'experience' && Array.isArray(content) && content.length > 0) {
    // Distribute new bullets across experiences proportionally to their old bullet count.
    let cursor = 0;
    for (const exp of copy.experience) {
      const n = Math.max(1, exp.bullets.length);
      const slice = content.slice(cursor, cursor + n);
      if (slice.length > 0) exp.bullets = slice;
      cursor += n;
    }
    return copy;
  }
  if (section === 'skills' && Array.isArray(content) && content.length > 0) {
    // Split roughly in half between hard and soft to avoid losing categorization.
    const half = Math.ceil(content.length / 2);
    copy.skills.hard = content.slice(0, half);
    copy.skills.soft = content.slice(half);
    return copy;
  }
  return copy;
}

function formatMonthLabel(_lang: 'ar' | 'en'): string {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
