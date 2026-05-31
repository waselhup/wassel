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
import { deductTokens, refundTokens } from './wallets';
import { scrapeLinkedInProfileHybrid } from '../services/profile-scraper';
import { radarPass1DiscoveryPrompt, radarPass2GapAnalysisPrompt } from '../prompts/_generated';
import { withBrain } from '../prompts/brain';

/**
 * Radar v2 engine — the Career Copilot's gap-analysis brain.
 *
 * Flow (Bowling-Lane Rules per A03 / R03):
 *   1. Read career_profile + overrides (R02 — never re-ask the user)
 *   2. Scrape LinkedIn (NOT_FOUND short-circuits before any deduction)
 *   3. Compute profile_hash; check radar_cache (R09 cache hit = 0 tokens)
 *   4. On miss: deduct tokens FIRST → run analysis → on failure, refund
 *   5. Compute Target Score (A03: current + ΣImprovements × 0.85, CAP 95)
 *   6. Compute Quick Wins (A04: Impact/Effort, diversity rule, drop Lows)
 *   7. Write radar_cache, radar_analyses; bump profile.last_radar_*
 */

// ─────────────────────────────────────────────
// Output schema (must match what the prompt emits + computed fields)
// ─────────────────────────────────────────────

/**
 * The 8 diagnostic dimensions the Radar UI renders as cards. Used both as the
 * key on per-dimension sub-scores (computeDimensionScores) AND as the optional
 * narrative tag the model may attach to each strength / gap / fix so the UI can
 * dissolve them into the right card (Pass-2 prompt sets it; absence is fine).
 */
export const DIMENSION_KEYS = [
  'headline', 'about', 'experience', 'skills',
  'keywords', 'activity', 'education', 'completeness',
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];
const DimensionKeyEnum = z.enum(DIMENSION_KEYS);

export const RadarResultSchema = z.object({
  strengths: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    // Optional narrative tag → which of the 8 cards this belongs to (#26: the
    // model only TAGS the narrative; it never authors a number).
    dimension: DimensionKeyEnum.optional(),
  })),
  gaps: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    dimension: DimensionKeyEnum.optional(),
  })),
  included_fixes: z.array(z.object({
    title: z.string(),
    field: z.enum(['headline', 'about', 'experience', 'skills']),
    suggestion: z.string(),
    rationale: z.string(),
    impact_weight: z.number().min(0).max(1).default(0.5),
    dimension: DimensionKeyEnum.optional(),
    // Set true by gateFixes() when the user hasn't unlocked the ready-made
    // rewrites yet. When locked, suggestion/rationale are blanked in the
    // response but title/field/impact_weight survive (Quick Wins need them).
    locked: z.boolean().optional(),
  })),
  suggested_actions: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    pillar: z.enum(['resume', 'content', 'profile']),
    deeplink: z.string(),
  })),
  quick_wins: z.array(z.object({
    title: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    effort: z.enum(['very_low', 'low', 'medium', 'high']),
    area: z.string(),
    score: z.number(),
  })),
  // Deterministic per-dimension sub-scores (#26). Optional so pre-M2 cached
  // rows (which lack it) still parse; the UI falls back to legacy lists then.
  dimensions: z.array(z.object({
    key: DimensionKeyEnum,
    current: z.number().min(0).max(100),
    target: z.number().min(0).max(100),
    gap: z.number(),
    found: z.array(z.string()),
    missing: z.array(z.string()),
    unmeasured: z.boolean().optional(),
  })).optional(),
  meta: z.object({
    current_score: z.number().min(0).max(100),
    target_score: z.number().min(0).max(100),
    target_role: z.string(),
    profile_hash: z.string(),
    language: z.enum(['ar', 'en']),
    generated_at: z.string(),
  }),
});

export type RadarResult = z.infer<typeof RadarResultSchema>;
export type DimensionResult = NonNullable<RadarResult['dimensions']>[number];

// ─────────────────────────────────────────────
// Helpers — exported for testability
// ─────────────────────────────────────────────

export function computeProfileHash(linkedinData: unknown): string {
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
    skills: Array.isArray(p.skills) ? p.skills : [],
  });
  return createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

/**
 * Sprint-3 Target Score formula:
 *   target = current + ROUND(Σ(impact_weight × point_gain) × 0.85)
 * where point_gain depends on the weight bucket:
 *   weight ≥ 0.8 → 8 points (high-impact fix)
 *   weight ≥ 0.5 → 5 points (medium-impact fix)
 *   else         → 3 points (low-impact fix)
 * Capped at 95 (R10: never claim "100" — every profile has headroom).
 */
export function computeTargetScore(
  currentScore: number,
  fixes: Array<{ impact_weight?: number }>
): number {
  const sumImprovements = fixes.reduce((acc, fix) => {
    const w = typeof fix.impact_weight === 'number' ? fix.impact_weight : 0.5;
    const points = w >= 0.8 ? 8 : w >= 0.5 ? 5 : 3;
    return acc + points * w;
  }, 0);
  const target = Math.round(currentScore + sumImprovements * 0.85);
  return Math.max(currentScore, Math.min(target, 95));
}

/**
 * Sprint-3 Quick Wins algorithm:
 *   - Candidates = included_fixes (very-low effort, impact from weight)
 *                + suggested_actions (effort from pillar)
 *   - Score = impactValue / effortValue
 *   - Exclude Low Impact
 *   - Diversity rule: top 3 must each come from a different `area`
 */
export function computeQuickWins(
  fixes: Array<{ title: string; field: string; impact_weight?: number }>,
  suggestedActions: Array<{ title: string; pillar: string }>
): RadarResult['quick_wins'] {
  type Candidate = {
    title: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'very_low' | 'low' | 'medium' | 'high';
    area: string;
  };

  const candidates: Candidate[] = [
    ...fixes.map((f) => {
      const w = typeof f.impact_weight === 'number' ? f.impact_weight : 0.5;
      const impact = w >= 0.8 ? 'high' as const : w >= 0.5 ? 'medium' as const : 'low' as const;
      return {
        title: f.title,
        impact,
        effort: 'very_low' as const,
        area: f.field,
      };
    }),
    ...suggestedActions.map((a) => ({
      title: a.title,
      impact: 'high' as const,
      effort: a.pillar === 'profile' ? ('low' as const) : ('medium' as const),
      area: a.pillar,
    })),
  ];

  const impactValues = { high: 1.0, medium: 0.7, low: 0.4 } as const;
  const effortValues = { very_low: 1, low: 2, medium: 3, high: 4 } as const;

  const scored = candidates
    .filter((c) => c.impact !== 'low')
    .map((c) => ({
      ...c,
      score: impactValues[c.impact] / effortValues[c.effort],
    }))
    .sort((a, b) => b.score - a.score);

  const top: typeof scored = [];
  const seenAreas = new Set<string>();
  for (const c of scored) {
    if (top.length >= 3) break;
    if (seenAreas.has(c.area)) continue;
    top.push(c);
    seenAreas.add(c.area);
  }
  // Diversity-relaxed fallback: if we couldn't fill 3 with distinct areas,
  // backfill from the next-highest-scored regardless of repetition. Keeps
  // the UI looking complete on sparse fix sets.
  if (top.length < 3) {
    for (const c of scored) {
      if (top.length >= 3) break;
      if (top.includes(c)) continue;
      top.push(c);
    }
  }

  return top.map((c) => ({
    title: c.title,
    impact: c.impact,
    effort: c.effort,
    area: c.area,
    score: Number(c.score.toFixed(3)),
  }));
}

/**
 * Fallback score when the model omits meta.current_score. Counts populated
 * fields on the UnifiedProfile shape, capped at 100. Conservative — leaves
 * room above for any AI estimate.
 */
export function estimateCurrentScore(linkedinData: unknown): number {
  const p = (linkedinData ?? {}) as Record<string, unknown>;
  // The raw UnifiedProfile carries `summary`; the discovery-normalized shape
  // carries `about`. Accept either so this fires regardless of which is passed
  // (previously read only `about`, so it never scored a raw profile's summary).
  const aboutText = String(p.about ?? p.summary ?? '');
  let score = 0;
  if (p.headline && String(p.headline).length > 10) score += 12;
  if (aboutText.length > 60) score += 18;
  if (Array.isArray(p.experience) && p.experience.length > 0) score += 20;
  if (Array.isArray(p.experience) && p.experience.length >= 3) score += 8;
  if (Array.isArray(p.skills) && p.skills.length > 0) score += 10;
  if (Array.isArray(p.skills) && p.skills.length >= 8) score += 6;
  if (Array.isArray(p.education) && p.education.length > 0) score += 10;
  if (Array.isArray(p.certifications) && p.certifications.length > 0) score += 6;
  if (Array.isArray(p.languages) && p.languages.length > 0) score += 4;
  if (p.profilePicture) score += 4;
  return Math.max(20, Math.min(score, 88));
}

// ─────────────────────────────────────────────
// M2 — Fix gating (free diagnostic / locked ready-made fixes)
// ─────────────────────────────────────────────

/**
 * Strip the ready-made fix rewrites from a result when the user hasn't paid to
 * unlock them. The DIAGNOSTIC (scores, dimensions, gaps, recommendations) is
 * always free; only `suggestion` + `rationale` — the actual rewritten text the
 * user would apply — are gated. We KEEP `title`, `field`, `impact_weight` and
 * `dimension` because Quick Wins, the Target Score, and the 8-card bucketing
 * all depend on them. Pure function — no DB, no mutation of the input.
 *
 * The same function runs on radar.run, radar.getCached, and radar.unlockFixes
 * so the gating logic lives in exactly one place (no drift between read paths).
 */
export function gateFixes(result: RadarResult, fixesUnlocked: boolean): RadarResult {
  if (fixesUnlocked) {
    // Make the unlocked state explicit so the client never shows a stale lock.
    return {
      ...result,
      included_fixes: result.included_fixes.map((f) => ({ ...f, locked: false })),
    };
  }
  return {
    ...result,
    included_fixes: result.included_fixes.map((f) => ({
      title: f.title,
      field: f.field,
      impact_weight: f.impact_weight,
      dimension: f.dimension,
      suggestion: '',
      rationale: '',
      locked: true,
    })),
  };
}

// ─────────────────────────────────────────────
// M2 — Per-dimension diagnostic sub-scores (#26: deterministic, never AI)
// ─────────────────────────────────────────────

/**
 * Score each of the 8 Radar dimensions from the RAW UnifiedProfile. Every score
 * is computed from field presence / length / counts — never from the model
 * (Gate #26). `found` / `missing` are derived from the SAME predicates as the
 * score, so a card's narrative can never contradict its number.
 *
 * Each dimension is scored on its own point budget, then normalized to 0–100
 * for display. `target = min(95, current + headroom)` where headroom is the
 * share of the budget the user is still missing (R10 — never claim 100).
 *
 * `keywords` is the only dimension that needs the target role: it reuses the
 * same idea as the ATS keyword check (matched / expected target tokens).
 * `activity` is marked `unmeasured` when the scrape source can't see posts —
 * we show an honest "we can't measure this" rather than a damning 0 (#24).
 */
export function computeDimensionScores(
  linkedinData: unknown,
  targetRole: string,
  industry: string,
  language: 'ar' | 'en' = 'ar',
): DimensionResult[] {
  const p = (linkedinData ?? {}) as Record<string, unknown>;
  const ar = language === 'ar';
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  // Normalize raw points (0..max) into a 0–100 card with an honest target.
  const card = (
    key: DimensionKey,
    points: number,
    max: number,
    found: string[],
    missing: string[],
    unmeasured?: boolean,
  ): DimensionResult => {
    // Per-dimension current is capped at 95 (R10 — never claim a perfect 100;
    // every dimension keeps headroom, mirroring the overall-score cap). This
    // also guarantees target ≥ current with target ≤ 95.
    const current = Math.max(0, Math.min(95, Math.round((points / max) * 100)));
    const headroom = Math.round(((max - points) / max) * 100);
    const target = unmeasured ? current : Math.max(current, Math.min(95, current + headroom));
    return {
      key,
      current,
      target,
      gap: Math.max(0, target - current),
      found,
      missing,
      ...(unmeasured ? { unmeasured: true } : {}),
    };
  };

  const headline = str(p.headline).trim();
  const summary = str(p.about ?? p.summary).trim();
  const experience = arr<Record<string, unknown>>(p.experience);
  const skills = arr<unknown>(p.skills).map((s) => (typeof s === 'string' ? s : str((s as Record<string, unknown>)?.title ?? (s as Record<string, unknown>)?.name)));
  const education = arr<Record<string, unknown>>(p.education);
  const certifications = arr<Record<string, unknown>>(p.certifications);
  const languages = arr<unknown>(p.languages);
  const activity = arr<unknown>(p.activity);
  const hasPicture = Boolean(p.profilePicture);
  const customUrl = Boolean(p.customUrl);
  const location = str(p.location).trim();

  // ── 1. Headline (max 25) ──────────────────────────────────────────
  const hLen = headline.length;
  const hPoints = hLen === 0 ? 0 : hLen < 30 ? 10 : hLen <= 120 ? 25 : 20;
  const dHeadline = card('headline', hPoints, 25,
    hLen >= 30 ? [ar ? `عنوان واضح (${hLen} حرف)` : `Clear headline (${hLen} chars)`] : [],
    hLen === 0 ? [ar ? 'لا يوجد عنوان' : 'No headline']
      : hLen < 30 ? [ar ? 'العنوان قصير — أضف الدور والتخصص' : 'Headline is short — add role and specialization']
      : hLen > 120 ? [ar ? 'العنوان طويل جداً — اختصره' : 'Headline is too long — trim it'] : [],
  );

  // ── 2. About / summary (max 30) ───────────────────────────────────
  const sLen = summary.length;
  const sPoints = sLen === 0 ? 0 : sLen < 60 ? 8 : sLen <= 300 ? 22 : sLen <= 1500 ? 30 : 24;
  const dAbout = card('about', sPoints, 30,
    sLen >= 60 ? [ar ? 'ملخص مكتمل' : 'Complete summary'] : [],
    sLen === 0 ? [ar ? 'لا يوجد ملخص' : 'No summary']
      : sLen < 60 ? [ar ? 'الملخص مختصر جداً' : 'Summary is too short']
      : sLen > 1500 ? [ar ? 'الملخص مطوّل — ركّزه' : 'Summary is too long — focus it'] : [],
  );

  // ── 3. Experience (max 30) ────────────────────────────────────────
  const expCount = experience.length;
  const describedCount = experience.filter((e) => str(e.description).trim().length > 0).length;
  let expPoints = expCount === 0 ? 0 : 14;
  if (expCount >= 3) expPoints += 8;
  expPoints += Math.min(8, describedCount * 2);
  expPoints = Math.min(30, expPoints);
  const dExperience = card('experience', expPoints, 30,
    expCount > 0 ? [ar ? `${expCount} خبرات، ${describedCount} منها بوصف` : `${expCount} roles, ${describedCount} with a description`] : [],
    expCount === 0 ? [ar ? 'لا توجد خبرات مدرجة' : 'No experience listed']
      : describedCount < expCount ? [ar ? 'أضف وصفاً للأدوار بدون تفاصيل' : 'Add descriptions to roles that have none'] : [],
  );

  // ── 4. Skills (max 22) ────────────────────────────────────────────
  const skillCount = skills.filter((s) => s.trim().length > 0).length;
  const skPoints = skillCount === 0 ? 0 : skillCount < 5 ? 8 : skillCount < 10 ? 16 : 22;
  const dSkills = card('skills', skPoints, 22,
    skillCount > 0 ? [ar ? `${skillCount} مهارة` : `${skillCount} skills`] : [],
    skillCount < 10 ? [ar ? 'أضف مهارات للوصول إلى 10 أو أكثر' : 'Add skills to reach 10 or more'] : [],
  );

  // ── 5. Keywords (max 25) — matched vs target-role tokens ──────────
  const expectedKw = deriveDimensionKeywords(targetRole, industry);
  const haystack = [
    headline, summary,
    ...skills,
    ...experience.flatMap((e) => [str(e.title), str(e.description)]),
  ].join(' ').toLowerCase();
  const matchedKw = expectedKw.filter((k) => haystack.includes(k));
  const missingKw = expectedKw.filter((k) => !haystack.includes(k));
  const kwPoints = expectedKw.length > 0 ? Math.round((matchedKw.length / expectedKw.length) * 25) : 18;
  const dKeywords = card('keywords', kwPoints, 25,
    matchedKw.slice(0, 8),
    missingKw.slice(0, 8),
  );

  // ── 6. Activity (max 18) — unmeasured when the source can't see posts ─
  const activityMeasured = activity.length > 0;
  const actPoints = activity.length === 0 ? 0 : activity.length <= 2 ? 8 : activity.length <= 5 ? 14 : 18;
  const dActivity = activityMeasured
    ? card('activity', actPoints, 18,
        [ar ? `${activity.length} منشور حديث` : `${activity.length} recent posts`],
        activity.length < 3 ? [ar ? 'انشر بوتيرة أعلى لزيادة ظهورك' : 'Post more regularly to raise visibility'] : [])
    : card('activity', 0, 18, [], [ar ? 'لا يمكننا قياس نشاطك من هذا المصدر' : "We can't measure your activity from this source"], true);

  // ── 7. Education + certifications (max 20) ─────────────────────────
  const eduCount = education.length;
  const certCount = certifications.length;
  let edPoints = eduCount >= 1 ? 10 : 0;
  if (certCount >= 1) edPoints += 6;
  if (certCount >= 3) edPoints += 4;
  edPoints = Math.min(20, edPoints);
  const dEducation = card('education', edPoints, 20,
    (eduCount > 0 || certCount > 0) ? [ar ? `${eduCount} مؤهل، ${certCount} شهادة` : `${eduCount} qualifications, ${certCount} certifications`] : [],
    certCount === 0 ? [ar ? 'أضف شهادات مهنية' : 'Add professional certifications']
      : eduCount === 0 ? [ar ? 'أضف مؤهلك التعليمي' : 'Add your education'] : [],
  );

  // ── 8. Profile completeness (max 20) ──────────────────────────────
  const compFound: string[] = [];
  const compMissing: string[] = [];
  let compPoints = 0;
  const compSignal = (ok: boolean, pts: number, foundAr: string, foundEn: string, missAr: string, missEn: string) => {
    if (ok) { compPoints += pts; compFound.push(ar ? foundAr : foundEn); }
    else compMissing.push(ar ? missAr : missEn);
  };
  compSignal(hasPicture, 5, 'صورة احترافية', 'Profile picture', 'لا توجد صورة', 'No profile picture');
  compSignal(customUrl, 3, 'رابط مخصص', 'Custom URL', 'رابط لينكدإن غير مخصص', 'LinkedIn URL is not customized');
  compSignal(location.length > 0, 3, 'الموقع محدد', 'Location set', 'الموقع غير محدد', 'Location not set');
  compSignal(languages.length > 0, 3, 'لغات مدرجة', 'Languages listed', 'لا توجد لغات', 'No languages listed');
  compSignal(headline.length > 0, 3, 'عنوان موجود', 'Headline present', 'لا يوجد عنوان', 'No headline');
  compSignal(summary.length > 0, 3, 'ملخص موجود', 'Summary present', 'لا يوجد ملخص', 'No summary');
  const dCompleteness = card('completeness', compPoints, 20, compFound, compMissing);

  return [dHeadline, dAbout, dExperience, dSkills, dKeywords, dActivity, dEducation, dCompleteness];
}

/**
 * Keyword set for the `keywords` dimension. Mirrors the spirit of the resume
 * engine's derivedKeywords (role + industry tokens + a few role-specific
 * extras) so the two surfaces agree on what "target keywords" means.
 */
function deriveDimensionKeywords(targetRole: string, industry: string): string[] {
  const tokens = [
    ...targetRole.toLowerCase().split(/\s+/),
    ...industry.toLowerCase().split(/\s+/),
  ]
    .map((t) => t.replace(/[^a-z0-9؀-ۿ]+/g, ''))
    .filter((t) => t.length >= 3);

  const extras: Record<string, string[]> = {
    product: ['roadmap', 'metrics', 'stakeholders'],
    manager: ['leadership', 'led', 'cross-functional'],
    data: ['sql', 'python', 'analytics'],
    engineer: ['design', 'system', 'architecture'],
    designer: ['figma', 'prototyping', 'usability'],
    marketing: ['campaign', 'growth', 'funnel'],
    sales: ['pipeline', 'quota', 'crm'],
    finance: ['budget', 'forecast', 'reporting'],
  };
  const roleLower = targetRole.toLowerCase();
  for (const [key, terms] of Object.entries(extras)) {
    if (roleLower.includes(key)) tokens.push(...terms);
  }
  return Array.from(new Set(tokens));
}

// ─────────────────────────────────────────────
// Main engine
// ─────────────────────────────────────────────

export type RunRadarOpts = {
  userId: string;
  language?: 'ar' | 'en';
  /** If provided, layered over career_profile as a transient override row. */
  overrideTargetRole?: string;
  /** Force cache miss (e.g. "regenerate" button). Still respects R09 caching. */
  forceRefresh?: boolean;
};

export type RunRadarSuccess = {
  result: RadarResult;
  isCacheHit: boolean;
  tokensCharged: number;
  walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
  cacheId: string;
  analysisId: string;
};

export class RadarError extends Error {
  code: 'NO_CAREER_PROFILE' | 'NO_LINKEDIN_URL' | 'LINKEDIN_NOT_FOUND' | 'INSUFFICIENT_TOKENS' | 'MODEL_FAILED' | 'INTERNAL';
  details?: unknown;
  constructor(code: RadarError['code'], message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// 149 tokens. Post-M2 this is the cost to UNLOCK the ready-made fixes — the
// diagnostic itself is free. preflight.cost surfaces it so the entry screen can
// say "the fixes cost 149", and the radar.unlockFixes flow charges it.
const RADAR_TOKEN_COST = 149;
export const RADAR_UNLOCK_COST = RADAR_TOKEN_COST;

export async function runRadar(
  supabase: SupabaseClient,
  opts: RunRadarOpts
): Promise<RunRadarSuccess> {
  const startTime = Date.now();
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  // 1. Career profile (with active radar override merged in)
  const profileMerged = await getCareerProfileWithOverrides(supabase, opts.userId, 'radar');
  if (!profileMerged) {
    throw new RadarError('NO_CAREER_PROFILE', 'Career profile not found — complete onboarding first.');
  }
  const targetRole = opts.overrideTargetRole?.trim() || profileMerged.target_role;
  if (!profileMerged.linkedin_url) {
    throw new RadarError('NO_LINKEDIN_URL', 'LinkedIn URL missing in career_profile.');
  }

  // Active override id for analytics (best-effort)
  let activeOverrideId: string | null = null;
  if (opts.overrideTargetRole) {
    const list = await listActiveSectionOverrides(supabase, opts.userId);
    activeOverrideId = list.find((o) => o.section === 'radar')?.id ?? null;
  }

  // 2. Scrape LinkedIn (BEFORE deducting — NOT_FOUND must not charge)
  let unifiedProfile: unknown;
  try {
    const outcome = await scrapeLinkedInProfileHybrid(profileMerged.linkedin_url);
    unifiedProfile = outcome.profile;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e?.code === 'NOT_FOUND' || e?.code === 'URL_MISMATCH') {
      throw new RadarError(
        'LINKEDIN_NOT_FOUND',
        language === 'ar'
          ? 'تعذّر الوصول إلى بروفايل لينكد إن المرتبط بحسابك'
          : 'We could not reach the LinkedIn profile linked to your account.',
        { reason: e.code },
      );
    }
    throw new RadarError('INTERNAL', `LinkedIn scrape failed: ${e?.message ?? 'unknown'}`);
  }
  const profileHash = computeProfileHash(unifiedProfile);

  // 3. Cache check (R09). The lookup is keyed on profile_hash, so it runs
  //    UNCONDITIONALLY — even under forceRefresh. Rationale (#26 + Bowling-Lane:
  //    never spend AI with no value):
  //      • Same profile_hash  → identical model input ⇒ identical output. A
  //        forced re-run would burn Claude tokens to regenerate the exact same
  //        diagnostic, so we serve the cached row instead (0 tokens, 0 model).
  //        This ALSO removes the duplicate-key crash: the bare INSERT below was
  //        colliding with the existing row on the
  //        (user_id, target_role, profile_hash, language) unique key whenever
  //        forceRefresh skipped this block on an already-analyzed profile.
  //      • Different profile_hash (the profile actually changed) → this lookup
  //        misses (the hash is part of the key) ⇒ we fall through to the model
  //        and INSERT a fresh, locked row. So forceRefresh still refreshes the
  //        only case where there is something to refresh.
  //    forceRefresh therefore means "reflect the latest profile", not "ignore
  //    the cache" — and an unchanged profile has nothing newer to reflect.
  {
    const { data: cached } = await supabase
      .from('radar_cache')
      .select('*')
      .eq('user_id', opts.userId)
      .eq('target_role', targetRole)
      .eq('profile_hash', profileHash)
      .eq('language', language)
      .maybeSingle();

    if (cached) {
      await supabase
        .from('radar_cache')
        .update({
          hit_count: (cached.hit_count ?? 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', cached.id);

      const { data: hitAnalysis } = await supabase
        .from('radar_analyses')
        .insert({
          user_id: opts.userId,
          cache_id: cached.id,
          target_role: targetRole,
          is_cache_hit: true,
          tokens_charged: 0,
          current_score: cached.current_score,
          target_score: cached.target_score,
          language,
          override_id: activeOverrideId,
          duration_ms: Date.now() - startTime,
        })
        .select('id')
        .single();

      return {
        // Gate the ready-made fixes by the row's unlock flag — a cache hit on a
        // not-yet-unlocked diagnostic must still hide the paid rewrites (M2).
        result: gateFixes(cached.result as RadarResult, Boolean(cached.fixes_unlocked)),
        isCacheHit: true,
        tokensCharged: 0,
        walletUsed: null,
        cacheId: cached.id,
        analysisId: hitAnalysis?.id ?? '',
      };
    }
  }

  // 4. Cache miss — M2 pricing inversion: the DIAGNOSTIC is FREE. We run the
  //    two AI passes at zero token cost; the ready-made fixes are gated later by
  //    gateFixes() until the user spends 149 via radar.unlockFixes. Nothing is
  //    deducted here, so a model failure simply throws (no refund needed).
  let result: RadarResult;
  try {
    // 5. Discovery pass (Haiku)
    const discoveryRes = await callClaude({
      task: 'profile_analysis',
      modelOverride: 'claude-haiku-4-5-20251001',
      system: withBrain(radarPass1DiscoveryPrompt.system),
      userContent: radarPass1DiscoveryPrompt.user({
        raw_scrape: JSON.stringify(unifiedProfile).slice(0, 60000),
      }),
      maxTokens: 3500,
      temperature: 0.2,
    });
    const discoveryText = extractText(discoveryRes);

    // Output Guard: block banned vendor / model names + Eastern Arabic digits.
    // This pass normally degrades silently to unifiedProfile on parse failure,
    // but a banned-word violation MUST abort upstream to prevent Pass 2 contamination.
    const discoveryValidation = validateOutput(discoveryText, 'radar.discovery');
    if (!discoveryValidation.valid) {
      throw new RadarError('MODEL_FAILED', `Output guard blocked: ${discoveryValidation.reason}`);
    }

    const normalized = extractJson<Record<string, unknown>>(discoveryText) ?? unifiedProfile;

    // 6. Gap-analysis pass (Sonnet)
    const analysisRes = await callClaude({
      task: 'profile_analysis',
      // Sprint 8 hotfix pattern: append schema + JSON-only directive so the
      // model emits valid JSON. Pass 1 (discovery) is already JSON-strict in
      // its source prompt; Pass 2 (gap analysis) was not, which caused the
      // 82% Quick Wins failure observed in production.
      system: withBrain(
        radarPass2GapAnalysisPrompt.system +
        '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
        radarPass2GapAnalysisPrompt.schema,
      ),
      userContent: radarPass2GapAnalysisPrompt.user({
        target_role: targetRole,
        industry: profileMerged.industry,
        level: profileMerged.level,
        goal: profileMerged.goal,
        language,
        normalized_profile: JSON.stringify(normalized).slice(0, 30000),
        overrides: opts.overrideTargetRole
          ? JSON.stringify({ target_role_override: opts.overrideTargetRole })
          : 'none',
      }),
      maxTokens: 4500,
      temperature: 0.4,
    });
    const analysisText = extractText(analysisRes);

    // Output Guard: block banned vendor / model names + Eastern Arabic digits
    const analysisValidation = validateOutput(analysisText, 'radar.analysis');
    if (!analysisValidation.valid) {
      throw new RadarError('MODEL_FAILED', `Output guard blocked: ${analysisValidation.reason}`);
    }

    const parsed = extractJson<Record<string, unknown>>(analysisText);
    if (!parsed) {
      throw new RadarError('MODEL_FAILED', 'Could not parse Radar analysis JSON.');
    }

    // 7. Derive scores + quick wins
    const fixes = Array.isArray(parsed.included_fixes)
      ? (parsed.included_fixes as Array<Record<string, unknown>>)
      : [];
    const suggested = Array.isArray(parsed.suggested_actions)
      ? (parsed.suggested_actions as Array<Record<string, unknown>>)
      : [];

    const metaIn = (parsed.meta ?? {}) as Record<string, unknown>;
    const modelScore = typeof metaIn.current_score === 'number'
      ? Math.max(0, Math.min(95, metaIn.current_score))
      : estimateCurrentScore(unifiedProfile);
    const targetScore = computeTargetScore(modelScore, fixes as Array<{ impact_weight?: number }>);
    const quickWins = computeQuickWins(
      fixes as Array<{ title: string; field: string; impact_weight?: number }>,
      suggested as Array<{ title: string; pillar: string }>,
    );
    // M2: deterministic per-dimension sub-scores from the RAW profile (#26).
    const dimensions = computeDimensionScores(unifiedProfile, targetRole, profileMerged.industry, language);

    result = RadarResultSchema.parse({
      strengths: parsed.strengths ?? [],
      gaps: parsed.gaps ?? [],
      included_fixes: fixes.map((f) => ({
        ...f,
        impact_weight: typeof f.impact_weight === 'number' ? f.impact_weight : 0.5,
      })),
      suggested_actions: suggested,
      quick_wins: quickWins,
      dimensions,
      meta: {
        current_score: modelScore,
        target_score: targetScore,
        target_role: targetRole,
        profile_hash: profileHash,
        language,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    // No tokens were deducted for the free diagnostic, so there is nothing to
    // refund — just surface the failure.
    if (err instanceof RadarError) throw err;
    throw new RadarError(
      'MODEL_FAILED',
      language === 'ar'
        ? 'تعذّر إكمال التحليل. حاول مرة أخرى'
        : 'The analysis could not be completed. Please try again.',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  // 8. Persist cache + analysis. We store the FULL result (with the real fix
  //    rewrites) so radar.unlockFixes can reveal them later without re-running
  //    the model. The row starts locked (fixes_unlocked=false) and free
  //    (tokens_charged=0); only the RETURNED copy is gated below.
  const { data: cacheRow, error: cacheErr } = await supabase
    .from('radar_cache')
    .insert({
      user_id: opts.userId,
      target_role: targetRole,
      profile_hash: profileHash,
      language,
      result,
      current_score: result.meta.current_score,
      target_score: result.meta.target_score,
      source_linkedin_url: profileMerged.linkedin_url,
      tokens_charged: 0,
      fixes_unlocked: false,
    })
    .select('id')
    .single();

  if (cacheErr || !cacheRow) {
    // Nothing was charged for the diagnostic, so there is nothing to refund.
    throw new RadarError('INTERNAL', `Cache write failed: ${cacheErr?.message ?? 'unknown'}`);
  }

  const { data: analysisRow } = await supabase
    .from('radar_analyses')
    .insert({
      user_id: opts.userId,
      cache_id: cacheRow.id,
      target_role: targetRole,
      is_cache_hit: false,
      tokens_charged: 0,
      wallet_used: null,
      current_score: result.meta.current_score,
      target_score: result.meta.target_score,
      language,
      override_id: activeOverrideId,
      duration_ms: Date.now() - startTime,
    })
    .select('id')
    .single();

  // 9. Bookkeeping on profiles (best-effort) — feeds M1 Readiness (compute-on-read).
  await supabase
    .from('profiles')
    .update({
      last_radar_at: new Date().toISOString(),
      last_radar_score: result.meta.current_score,
      posts_count_since_last_radar: 0,
    })
    .eq('id', opts.userId);

  return {
    // Fresh diagnostic → fixes always start locked in the response.
    result: gateFixes(result, false),
    isCacheHit: false,
    tokensCharged: 0,
    walletUsed: null,
    cacheId: cacheRow.id,
    analysisId: analysisRow?.id ?? '',
  };
}

function summarizeDebited(
  debited: Awaited<ReturnType<typeof deductTokens>> extends { debited: infer D } ? D : never
): 'bonus' | 'subscription' | 'topup' | 'mixed' | null {
  if (!Array.isArray(debited) || debited.length === 0) return null;
  if (debited.length === 1) return debited[0].wallet;
  return 'mixed';
}

// ─────────────────────────────────────────────
// M2 — Unlock the ready-made fixes (the paid half of the inverted pricing)
// ─────────────────────────────────────────────

export type UnlockFixesSuccess = {
  result: RadarResult;
  tokensCharged: number;
  walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
  alreadyUnlocked: boolean;
  cacheId: string;
};

/**
 * Spend RADAR_UNLOCK_COST (149) to reveal the ready-made fix rewrites on a
 * diagnostic the user already generated for free. Bowling-Lane Rules (R03):
 *   - If already unlocked → return the full result for 0 tokens (idempotent).
 *     This MUST short-circuit BEFORE deductTokens, because deduct_tokens_v2
 *     rejects amount <= 0 with INVALID_AMOUNT.
 *   - Else deduct 149 → flip fixes_unlocked via a conditional UPDATE that only
 *     wins if the row was still locked. If we lost the race (0 rows) or the
 *     write errored, refund the exact debit and recover gracefully.
 */
export async function unlockFixes(
  supabase: SupabaseClient,
  opts: { userId: string; cacheId: string; language?: 'ar' | 'en' },
): Promise<UnlockFixesSuccess> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  const { data: row, error: readErr } = await supabase
    .from('radar_cache')
    .select('id, result, fixes_unlocked')
    .eq('id', opts.cacheId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (readErr) throw new RadarError('INTERNAL', `Cache read failed: ${readErr.message}`);
  if (!row) throw new RadarError('INTERNAL', 'Cached result not found.');

  const fullResult = row.result as RadarResult;

  // Idempotent fast-path — already paid, reveal for free (no deduction).
  if (row.fixes_unlocked) {
    return {
      result: gateFixes(fullResult, true),
      tokensCharged: 0,
      walletUsed: null,
      alreadyUnlocked: true,
      cacheId: row.id,
    };
  }

  // Deduct first (R03), then unlock; refund on any failure after the debit.
  const deductRes = await deductTokens(supabase, opts.userId, RADAR_UNLOCK_COST, 'radar.v2.unlock_fixes', {
    cache_id: opts.cacheId,
  });
  if (!deductRes.success) {
    if (deductRes.error === 'INSUFFICIENT_TOKENS') {
      throw new RadarError(
        'INSUFFICIENT_TOKENS',
        language === 'ar'
          ? 'رصيدك غير كافٍ لفتح الإصلاحات الجاهزة'
          : 'Not enough tokens to unlock the ready-made fixes.',
        { available: deductRes.available, cost: RADAR_UNLOCK_COST },
      );
    }
    throw new RadarError('INTERNAL', `Deduction failed: ${deductRes.error}`);
  }

  // Conditional flip — only succeeds if the row was still locked (race-safe).
  const { data: flipped, error: flipErr } = await supabase
    .from('radar_cache')
    .update({ fixes_unlocked: true })
    .eq('id', opts.cacheId)
    .eq('user_id', opts.userId)
    .eq('fixes_unlocked', false)
    .select('id');

  if (flipErr) {
    await refundTokens(supabase, opts.userId, deductRes.debited, 'radar.v2.unlock_fixes.refund', {
      reason: flipErr.message,
    });
    throw new RadarError('INTERNAL', `Unlock write failed: ${flipErr.message}`);
  }

  // Lost the race: a concurrent unlock already flipped the flag. We were
  // charged but shouldn't double-charge — refund this debit and reveal anyway.
  if (!flipped || flipped.length === 0) {
    await refundTokens(supabase, opts.userId, deductRes.debited, 'radar.v2.unlock_fixes.refund', {
      reason: 'already_unlocked_concurrently',
    });
    return {
      result: gateFixes(fullResult, true),
      tokensCharged: 0,
      walletUsed: null,
      alreadyUnlocked: true,
      cacheId: row.id,
    };
  }

  return {
    result: gateFixes(fullResult, true),
    tokensCharged: RADAR_UNLOCK_COST,
    walletUsed: summarizeDebited(deductRes.debited),
    alreadyUnlocked: false,
    cacheId: row.id,
  };
}

// ─────────────────────────────────────────────
// Apply Included Fix — Sprint 3 records the choice; Sprint 4 pushes
// the change to LinkedIn where the API permits.
// ─────────────────────────────────────────────

export async function applyIncludedFix(
  supabase: SupabaseClient,
  opts: { userId: string; cacheId: string; fixIndex: number }
): Promise<{ success: boolean; appliedFixId: string }> {
  const { data: cache } = await supabase
    .from('radar_cache')
    .select('id, result, user_id')
    .eq('id', opts.cacheId)
    .eq('user_id', opts.userId)
    .maybeSingle();

  if (!cache) throw new RadarError('INTERNAL', 'Cached result not found.');
  const result = cache.result as RadarResult;
  const fix = result.included_fixes?.[opts.fixIndex];
  if (!fix) throw new RadarError('INTERNAL', 'Fix index out of range.');

  const { data: applied, error } = await supabase
    .from('radar_applied_fixes')
    .insert({
      user_id: opts.userId,
      cache_id: opts.cacheId,
      field: fix.field,
      fix_index: opts.fixIndex,
      original_value: null,
      applied_value: fix.suggestion,
      status: 'applied',
    })
    .select('id')
    .single();

  if (error || !applied) throw new RadarError('INTERNAL', error?.message ?? 'apply failed');
  return { success: true, appliedFixId: applied.id };
}

export async function revertAppliedFix(
  supabase: SupabaseClient,
  opts: { userId: string; appliedFixId: string }
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('radar_applied_fixes')
    .update({ status: 'reverted', reverted_at: new Date().toISOString() })
    .eq('id', opts.appliedFixId)
    .eq('user_id', opts.userId);
  if (error) throw new RadarError('INTERNAL', error.message);
  return { success: true };
}

// ─────────────────────────────────────────────
// Refresh triggers — A02 / A09
// ─────────────────────────────────────────────

export type RadarTrigger = {
  type: string;
  metadata?: Record<string, unknown>;
};

export async function checkRefreshTriggers(
  supabase: SupabaseClient,
  userId: string
): Promise<{ hasTriggered: boolean; triggers: RadarTrigger[] }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_radar_at, posts_count_since_last_radar')
    .eq('id', userId)
    .maybeSingle();

  const triggers: RadarTrigger[] = [];

  if ((profile?.posts_count_since_last_radar ?? 0) >= 5) {
    triggers.push({
      type: '5_new_posts',
      metadata: { count: profile?.posts_count_since_last_radar },
    });
  }

  if (profile?.last_radar_at) {
    const daysSince = (Date.now() - new Date(profile.last_radar_at).getTime()) / 86_400_000;
    if (daysSince >= 30) {
      triggers.push({
        type: '30_days_passed',
        metadata: { days: Math.floor(daysSince) },
      });
    }
  } else {
    // Never ran the Radar — that's itself an implicit trigger.
    triggers.push({ type: 'manual', metadata: { reason: 'never_ran' } });
  }

  // Surface persisted triggers detected by other surfaces (target_role_changed,
  // new_resume, linkedin_first_link) that haven't been acted on yet.
  const { data: persisted } = await supabase
    .from('radar_refresh_triggers')
    .select('id, trigger_type, metadata, detected_at')
    .eq('user_id', userId)
    .is('acted_upon_at', null)
    .order('detected_at', { ascending: false })
    .limit(5);

  for (const row of persisted ?? []) {
    triggers.push({
      type: (row as { trigger_type: string }).trigger_type,
      metadata: (row as { metadata?: Record<string, unknown> }).metadata ?? undefined,
    });
  }

  return { hasTriggered: triggers.length > 0, triggers };
}

export async function markTriggerActedUpon(
  supabase: SupabaseClient,
  opts: { userId: string; triggerId: string }
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('radar_refresh_triggers')
    .update({ acted_upon_at: new Date().toISOString() })
    .eq('id', opts.triggerId)
    .eq('user_id', opts.userId);
  if (error) throw new RadarError('INTERNAL', error.message);
  return { success: true };
}

// ─────────────────────────────────────────────
// Preflight — what the /v2/analyze page needs to render the entry CTA
// ─────────────────────────────────────────────

export type PreflightResult = {
  ready: boolean;
  profile: Pick<CareerProfile, 'target_role' | 'industry' | 'linkedin_url' | 'primary_language'> | null;
  cost: number;
  hasCache: boolean;
  latestCacheId: string | null;
  latestCachedAt: string | null;
  triggers: RadarTrigger[];
};

export async function preflight(
  supabase: SupabaseClient,
  userId: string
): Promise<PreflightResult> {
  const profile = await getCareerProfileWithOverrides(supabase, userId, 'radar');
  if (!profile) {
    return {
      ready: false,
      profile: null,
      cost: RADAR_TOKEN_COST,
      hasCache: false,
      latestCacheId: null,
      latestCachedAt: null,
      triggers: [],
    };
  }

  const { data: latest } = await supabase
    .from('radar_cache')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('target_role', profile.target_role)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { triggers } = await checkRefreshTriggers(supabase, userId);

  return {
    ready: Boolean(profile.linkedin_url),
    profile: {
      target_role: profile.target_role,
      industry: profile.industry,
      linkedin_url: profile.linkedin_url,
      primary_language: profile.primary_language,
    },
    cost: RADAR_TOKEN_COST,
    hasCache: Boolean(latest),
    latestCacheId: latest?.id ?? null,
    latestCachedAt: latest?.created_at ?? null,
    triggers,
  };
}

export const RADAR_COST = RADAR_TOKEN_COST;
