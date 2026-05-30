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

export const RadarResultSchema = z.object({
  strengths: z.array(z.object({
    title: z.string(),
    detail: z.string(),
  })),
  gaps: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  included_fixes: z.array(z.object({
    title: z.string(),
    field: z.enum(['headline', 'about', 'experience', 'skills']),
    suggestion: z.string(),
    rationale: z.string(),
    impact_weight: z.number().min(0).max(1).default(0.5),
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
  let score = 0;
  if (p.headline && String(p.headline).length > 10) score += 12;
  if (p.about && String(p.about).length > 60) score += 18;
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

const RADAR_TOKEN_COST = 149;

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

  // 3. Cache check (R09)
  if (!opts.forceRefresh) {
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
        result: cached.result as RadarResult,
        isCacheHit: true,
        tokensCharged: 0,
        walletUsed: null,
        cacheId: cached.id,
        analysisId: hitAnalysis?.id ?? '',
      };
    }
  }

  // 4. Cache miss — deduct first (atomic), refund on any failure below
  const deductRes = await deductTokens(supabase, opts.userId, RADAR_TOKEN_COST, 'radar.v2', {
    target_role: targetRole,
    profile_hash: profileHash,
    language,
  });
  if (!deductRes.success) {
    if (deductRes.error === 'INSUFFICIENT_TOKENS') {
      throw new RadarError(
        'INSUFFICIENT_TOKENS',
        language === 'ar'
          ? 'رصيدك غير كافٍ لإجراء تحليل جديد'
          : 'Not enough tokens to run a new analysis.',
        { available: deductRes.available, cost: RADAR_TOKEN_COST },
      );
    }
    throw new RadarError('INTERNAL', `Deduction failed: ${deductRes.error}`);
  }

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

    result = RadarResultSchema.parse({
      strengths: parsed.strengths ?? [],
      gaps: parsed.gaps ?? [],
      included_fixes: fixes.map((f) => ({
        ...f,
        impact_weight: typeof f.impact_weight === 'number' ? f.impact_weight : 0.5,
      })),
      suggested_actions: suggested,
      quick_wins: quickWins,
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
    // Bowling-Lane refund: undo the exact deduction we just performed.
    await refundTokens(supabase, opts.userId, deductRes.debited, 'radar.v2.refund', {
      reason: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof RadarError) throw err;
    throw new RadarError(
      'MODEL_FAILED',
      language === 'ar'
        ? 'فشل التحليل. تم استرداد توكناتك'
        : 'Analysis failed. Your tokens were refunded.',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  // 8. Persist cache + analysis
  const debitedSummary = summarizeDebited(deductRes.debited);
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
      tokens_charged: RADAR_TOKEN_COST,
    })
    .select('id')
    .single();

  if (cacheErr || !cacheRow) {
    // Persistence failed AFTER a successful model call — give the user
    // their tokens back rather than leaving them with no artifact.
    await refundTokens(supabase, opts.userId, deductRes.debited, 'radar.v2.persist_failed', {
      reason: cacheErr?.message ?? 'cache_insert_failed',
    });
    throw new RadarError('INTERNAL', `Cache write failed: ${cacheErr?.message ?? 'unknown'}`);
  }

  const { data: analysisRow } = await supabase
    .from('radar_analyses')
    .insert({
      user_id: opts.userId,
      cache_id: cacheRow.id,
      target_role: targetRole,
      is_cache_hit: false,
      tokens_charged: RADAR_TOKEN_COST,
      wallet_used: debitedSummary,
      current_score: result.meta.current_score,
      target_score: result.meta.target_score,
      language,
      override_id: activeOverrideId,
      duration_ms: Date.now() - startTime,
    })
    .select('id')
    .single();

  // 9. Bookkeeping on profiles (best-effort)
  await supabase
    .from('profiles')
    .update({
      last_radar_at: new Date().toISOString(),
      last_radar_score: result.meta.current_score,
      posts_count_since_last_radar: 0,
    })
    .eq('id', opts.userId);

  return {
    result,
    isCacheHit: false,
    tokensCharged: RADAR_TOKEN_COST,
    walletUsed: debitedSummary,
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
