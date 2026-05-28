import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { callClaude, extractText, extractJson } from './claude-client';
import {
  getCareerProfileWithOverrides,
  type CareerProfile,
} from './career-profile';
import { deductTokens, refundTokens, type DeductedBreakdown } from './wallets';
import {
  contentPostPrompt,
  contentCarouselPrompt,
  contentRepurposePrompt,
} from '../prompts/_generated';
import { validateTone, flattenForValidation } from './content-tone-validator';

/**
 * Content v2 engine — Career Copilot's targeted content brain.
 *
 * Flow (Bowling-Lane Rules per R03):
 *   1. Read career_profile + overrides (R02 — never re-ask the user)
 *   2. Compute topic_hash; check content_cache (R09 cache hit = 0 tokens)
 *   3. On miss: deduct tokens FIRST → call Claude → tone-validate (A11) →
 *      on failure, refund. On tone failure, retry once with stricter prompt.
 *   4. Write content_cache, content_versions; bump profile counters
 *
 * Three operations:
 *   - Post                  : 5 tokens  (Haiku ~10s)
 *   - Carousel              : 25 tokens (Sonnet ~30s)
 *   - Repurpose Bundle      : 15 tokens (Haiku ~20s, needs source post)
 *
 * Refinement (per-piece iteration):
 *   - First 5 per version are FREE (A12 / R12)
 *   - Subsequent refinements cost 5 tokens each
 *
 * Archive First Policy:
 *   - Versions never delete — `status` moves active → archived → restored
 *   - Legacy rows from pre-Copilot `posts` land with status='legacy' and
 *     are read-only inside the new editor.
 */

// ─────────────────────────────────────────────
// Costs
// ─────────────────────────────────────────────

export const CONTENT_POST_COST = 5;
export const CONTENT_CAROUSEL_COST = 25;
export const CONTENT_REPURPOSE_COST = 15;
export const CONTENT_PAID_REFINEMENT_COST = 5;
export const CONTENT_FREE_REFINEMENTS_PER_VERSION = 5;
export const CACHE_TTL_POST_DAYS = 7;
export const CACHE_TTL_CAROUSEL_DAYS = 7;
export const CACHE_TTL_REPURPOSE_DAYS = 30;
export const SUGGESTIONS_TTL_HOURS = 24;

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

export const PostSchema = z.object({
  body: z.string(),
  hashtags: z.array(z.string()).default([]),
  language: z.enum(['ar', 'en']),
  topic: z.string(),
  meta: z.object({
    generated_at: z.string(),
    content_type: z.literal('post').default('post'),
  }).default({ generated_at: new Date().toISOString(), content_type: 'post' }),
});
export type Post = z.infer<typeof PostSchema>;

export const CarouselSchema = z.object({
  slides: z.array(z.object({
    title: z.string(),
    body: z.string(),
    image_prompt: z.string().nullable().default(null),
  })),
  caption: z.string(),
  hashtags: z.array(z.string()).default([]),
  language: z.enum(['ar', 'en']),
  topic: z.string(),
  meta: z.object({
    generated_at: z.string(),
    content_type: z.literal('carousel').default('carousel'),
  }).default({ generated_at: new Date().toISOString(), content_type: 'carousel' }),
});
export type Carousel = z.infer<typeof CarouselSchema>;

export const RepurposeBundleSchema = z.object({
  source_post_id: z.string(),
  carousel: z.object({
    slides: z.array(z.object({
      title: z.string(),
      body: z.string(),
      image_prompt: z.string().nullable().default(null),
    })),
    caption: z.string(),
    hashtags: z.array(z.string()).default([]),
  }),
  short_video_script: z.object({
    hook: z.string(),
    beats: z.array(z.string()),
    cta: z.string(),
  }),
  follow_up_post: z.object({
    body: z.string(),
    hashtags: z.array(z.string()).default([]),
  }),
  language: z.enum(['ar', 'en']),
  meta: z.object({
    generated_at: z.string(),
    content_type: z.literal('repurpose_bundle').default('repurpose_bundle'),
  }).default({ generated_at: new Date().toISOString(), content_type: 'repurpose_bundle' }),
});
export type RepurposeBundle = z.infer<typeof RepurposeBundleSchema>;

export type ContentType = 'post' | 'carousel' | 'repurpose_bundle';
export type ContentResult = Post | Carousel | RepurposeBundle;

export type TopicSuggestion = {
  topic: string;
  recommended_type: ContentType;
  reason: string;
};

// ─────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────

export class ContentError extends Error {
  code:
    | 'NO_CAREER_PROFILE'
    | 'INSUFFICIENT_TOKENS'
    | 'MODEL_FAILED'
    | 'TONE_VIOLATION'
    | 'VERSION_NOT_FOUND'
    | 'CACHE_NOT_FOUND'
    | 'SOURCE_POST_NOT_FOUND'
    | 'LEGACY_READ_ONLY'
    | 'TOPIC_REQUIRED'
    | 'INTERNAL';
  details?: unknown;
  constructor(code: ContentError['code'], message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// ─────────────────────────────────────────────
// Hash + helpers
// ─────────────────────────────────────────────

export function computeTopicHash(topic: string, contentType: ContentType, sourcePostId?: string | null): string {
  const normalized = topic.trim().toLowerCase().replace(/\s+/g, ' ');
  const seed = JSON.stringify({ topic: normalized, contentType, sourcePostId: sourcePostId ?? null });
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

export function computeProfileHash(profile: CareerProfile): string {
  const stable = JSON.stringify({
    goal: profile.goal,
    level: profile.level,
    target_role: profile.target_role,
    industry: profile.industry,
    primary_language: profile.primary_language,
  });
  return createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

function expiryForType(contentType: ContentType): Date {
  const days = contentType === 'repurpose_bundle'
    ? CACHE_TTL_REPURPOSE_DAYS
    : (contentType === 'carousel' ? CACHE_TTL_CAROUSEL_DAYS : CACHE_TTL_POST_DAYS);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function costForType(contentType: ContentType): number {
  if (contentType === 'post') return CONTENT_POST_COST;
  if (contentType === 'carousel') return CONTENT_CAROUSEL_COST;
  return CONTENT_REPURPOSE_COST;
}

function summarizeDebited(debited: DeductedBreakdown): 'bonus' | 'subscription' | 'topup' | 'mixed' | null {
  if (!Array.isArray(debited) || debited.length === 0) return null;
  if (debited.length === 1) return debited[0].wallet;
  return 'mixed';
}

function truncateTopic(topic: string, max = 80): string {
  const t = topic.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

async function recentActivitySummary(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('activity_log')
      .select('action, target, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    if (!data || data.length === 0) return 'none';
    return data
      .map((row: { action: string; target: string | null; created_at: string }) => {
        const date = row.created_at.slice(0, 10);
        return `- ${date} · ${row.action}${row.target ? ' · ' + row.target : ''}`;
      })
      .join('\n');
  } catch {
    return 'none';
  }
}

// ─────────────────────────────────────────────
// Preflight — what /v2/posts/new/:type needs
// ─────────────────────────────────────────────

export type PreflightContentResult = {
  hasCareerProfile: boolean;
  profile: Pick<CareerProfile, 'goal' | 'level' | 'target_role' | 'industry' | 'primary_language'> | null;
  contentType: ContentType;
  estimatedCost: number;
  hasCacheHit: boolean;
  latestCacheId: string | null;
  latestVersionId: string | null;
  suggestions: TopicSuggestion[];
  activeContentCount: number;
  archivedCount: number;
  legacyCount: number;
};

export async function preflightContent(
  supabase: SupabaseClient,
  userId: string,
  opts: { contentType: ContentType; topic?: string; sourcePostId?: string; language?: 'ar' | 'en' },
): Promise<PreflightContentResult> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  const profile = await getCareerProfileWithOverrides(supabase, userId, 'content');

  const [{ count: activeCount }, { count: archivedCount }, { count: legacyCount }] = await Promise.all([
    supabase.from('content_versions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    supabase.from('content_versions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'archived'),
    supabase.from('content_versions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'legacy'),
  ]);

  if (!profile) {
    return {
      hasCareerProfile: false,
      profile: null,
      contentType: opts.contentType,
      estimatedCost: costForType(opts.contentType),
      hasCacheHit: false,
      latestCacheId: null,
      latestVersionId: null,
      suggestions: [],
      activeContentCount: activeCount ?? 0,
      archivedCount: archivedCount ?? 0,
      legacyCount: legacyCount ?? 0,
    };
  }

  let hasCacheHit = false;
  let latestCacheId: string | null = null;
  let latestVersionId: string | null = null;

  if (opts.topic && opts.topic.trim().length > 0) {
    const topicHash = computeTopicHash(opts.topic, opts.contentType, opts.sourcePostId);
    const { data: cached } = await supabase
      .from('content_cache')
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('content_type', opts.contentType)
      .eq('topic_hash', topicHash)
      .eq('language', language)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (cached) {
      hasCacheHit = true;
      latestCacheId = cached.id;
      const { data: ver } = await supabase
        .from('content_versions')
        .select('id')
        .eq('user_id', userId)
        .eq('cache_id', cached.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      latestVersionId = ver?.id ?? null;
    }
  }

  // Cached suggestions (24h TTL) — only fetched if the caller hasn't supplied a topic.
  let suggestions: TopicSuggestion[] = [];
  if (!opts.topic) {
    suggestions = await getCachedTopicSuggestions(supabase, userId, profile, language);
  }

  return {
    hasCareerProfile: true,
    profile: {
      goal: profile.goal,
      level: profile.level,
      target_role: profile.target_role,
      industry: profile.industry,
      primary_language: profile.primary_language,
    },
    contentType: opts.contentType,
    estimatedCost: hasCacheHit ? 0 : costForType(opts.contentType),
    hasCacheHit,
    latestCacheId,
    latestVersionId,
    suggestions,
    activeContentCount: activeCount ?? 0,
    archivedCount: archivedCount ?? 0,
    legacyCount: legacyCount ?? 0,
  };
}

// ─────────────────────────────────────────────
// Topic suggestions — Quick Start (24h cache)
// ─────────────────────────────────────────────

async function getCachedTopicSuggestions(
  supabase: SupabaseClient,
  userId: string,
  profile: CareerProfile,
  language: 'ar' | 'en',
): Promise<TopicSuggestion[]> {
  const profileHash = computeProfileHash(profile);
  const { data: row } = await supabase
    .from('content_topic_suggestions')
    .select('suggestions, expires_at')
    .eq('user_id', userId)
    .eq('profile_hash', profileHash)
    .eq('language', language)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (row && Array.isArray(row.suggestions)) {
    return row.suggestions as TopicSuggestion[];
  }
  return [];
}

/**
 * Generate three topic suggestions from career_profile + recent activity.
 * Cached 24h by (user, profile_hash, language). Free — no token deduction.
 */
export async function generateTopicSuggestions(
  supabase: SupabaseClient,
  userId: string,
  language: 'ar' | 'en' = 'ar',
): Promise<{ suggestions: TopicSuggestion[]; profileHash: string; isCacheHit: boolean }> {
  const profile = await getCareerProfileWithOverrides(supabase, userId, 'content');
  if (!profile) throw new ContentError('NO_CAREER_PROFILE', 'Career profile missing.');

  const profileHash = computeProfileHash(profile);

  const existing = await getCachedTopicSuggestions(supabase, userId, profile, language);
  if (existing.length > 0) {
    return { suggestions: existing, profileHash, isCacheHit: true };
  }

  // Deterministic templated suggestions — cheap and grounded in profile fields,
  // never invents stats. Three mode-balanced ideas (post / carousel / repurpose).
  const role = profile.target_role || (language === 'ar' ? 'دورك' : 'your role');
  const industry = profile.industry || (language === 'ar' ? 'مجالك' : 'your industry');
  const suggestions: TopicSuggestion[] = language === 'ar'
    ? [
        {
          topic: `درس تعلمته كـ${role} في ${industry}`,
          recommended_type: 'post',
          reason: `موضوع قصير من تجربتك في ${industry} — مناسب لمنشور سريع.`,
        },
        {
          topic: `5 خطوات تحوّل ${role} مبتدئ إلى محترف`,
          recommended_type: 'carousel',
          reason: 'محتوى تعليمي مفصّل يستحق كاروسيل.',
        },
        {
          topic: `أخطاء شائعة يقع فيها الجدد في ${industry}`,
          recommended_type: 'post',
          reason: `زاوية عملية تنبع من خبرتك كـ${role}.`,
        },
      ]
    : [
        {
          topic: `A lesson I learned as a ${role} in ${industry}`,
          recommended_type: 'post',
          reason: `A short reflective piece from your ${industry} experience — fits a single post.`,
        },
        {
          topic: `5 steps that turn a junior ${role} into a senior one`,
          recommended_type: 'carousel',
          reason: 'A teaching-shaped idea worth a carousel.',
        },
        {
          topic: `Common mistakes new ${industry} professionals make`,
          recommended_type: 'post',
          reason: `A practical angle drawn from your ${role} experience.`,
        },
      ];

  // Persist (24h TTL)
  await supabase
    .from('content_topic_suggestions')
    .upsert({
      user_id: userId,
      profile_hash: profileHash,
      language,
      suggestions,
      expires_at: new Date(Date.now() + SUGGESTIONS_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id,profile_hash,language' });

  return { suggestions, profileHash, isCacheHit: false };
}

// ─────────────────────────────────────────────
// Generate — Post / Carousel / Repurpose Bundle
// ─────────────────────────────────────────────

export type GenerateContentOpts = {
  userId: string;
  language?: 'ar' | 'en';
  contentType: ContentType;
  topic?: string;             // required for post + carousel
  sourcePostId?: string;      // required for repurpose_bundle
  forceRefresh?: boolean;
};

export type GenerateContentResult = {
  result: ContentResult;
  isCacheHit: boolean;
  tokensCharged: number;
  walletUsed: 'bonus' | 'subscription' | 'topup' | 'mixed' | null;
  cacheId: string;
  versionId: string;
  toneViolations: string[];   // empty on success; populated if served despite warnings
};

export async function generateContent(
  supabase: SupabaseClient,
  opts: GenerateContentOpts,
): Promise<GenerateContentResult> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  const profile = await getCareerProfileWithOverrides(supabase, opts.userId, 'content');
  if (!profile) throw new ContentError('NO_CAREER_PROFILE', 'Career profile missing.');

  // Topic / source validation
  let topic = opts.topic?.trim();
  let sourcePostBody: string | null = null;
  let sourcePostIdResolved: string | null = null;

  if (opts.contentType === 'repurpose_bundle') {
    if (!opts.sourcePostId) {
      throw new ContentError('SOURCE_POST_NOT_FOUND', 'sourcePostId required for repurpose.');
    }
    // Source can be either a content_versions row OR a legacy posts row.
    const source = await loadSourcePost(supabase, opts.userId, opts.sourcePostId);
    if (!source) throw new ContentError('SOURCE_POST_NOT_FOUND', 'Source post not found.');
    sourcePostBody = source.body;
    sourcePostIdResolved = opts.sourcePostId;
    if (!topic || topic.length === 0) {
      topic = source.topic || 'repurpose';
    }
  } else {
    if (!topic || topic.length < 3) {
      throw new ContentError('TOPIC_REQUIRED', language === 'ar' ? 'اكتب موضوعاً أولاً' : 'Topic required.');
    }
  }

  const topicHash = computeTopicHash(topic, opts.contentType, sourcePostIdResolved);

  // Cache check
  if (!opts.forceRefresh) {
    const { data: cached } = await supabase
      .from('content_cache')
      .select('*')
      .eq('user_id', opts.userId)
      .eq('content_type', opts.contentType)
      .eq('topic_hash', topicHash)
      .eq('language', language)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      await supabase
        .from('content_cache')
        .update({
          hit_count: (cached.hit_count ?? 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', cached.id);

      // Reuse or create a version row pointing at the cached result.
      const { data: existingVer } = await supabase
        .from('content_versions')
        .select('id')
        .eq('user_id', opts.userId)
        .eq('cache_id', cached.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let versionId = existingVer?.id ?? '';
      if (!versionId) {
        const { data: newVer } = await supabase
          .from('content_versions')
          .insert({
            user_id: opts.userId,
            cache_id: cached.id,
            content_type: opts.contentType,
            display_title: truncateTopic(topic),
            topic,
            status: 'active',
            tokens_charged: 0,
            language,
          })
          .select('id')
          .single();
        versionId = newVer?.id ?? '';
      }

      return {
        result: cached.result as ContentResult,
        isCacheHit: true,
        tokensCharged: 0,
        walletUsed: null,
        cacheId: cached.id,
        versionId,
        toneViolations: [],
      };
    }
  }

  // Deduct
  const cost = costForType(opts.contentType);
  const operation = `content.v2.${opts.contentType}`;
  const deductRes = await deductTokens(supabase, opts.userId, cost, operation, {
    topic_hash: topicHash,
    content_type: opts.contentType,
    language,
  });
  if (!deductRes.success) {
    if (deductRes.error === 'INSUFFICIENT_TOKENS') {
      throw new ContentError(
        'INSUFFICIENT_TOKENS',
        language === 'ar' ? 'رصيدك غير كافٍ' : 'Not enough tokens.',
        { available: deductRes.available, cost },
      );
    }
    throw new ContentError('INTERNAL', `Deduction failed: ${deductRes.error}`);
  }

  const recentActivity = await recentActivitySummary(supabase, opts.userId);

  let result: ContentResult;
  let toneViolations: string[] = [];
  try {
    const attempt = await runGenerationWithToneRetry({
      contentType: opts.contentType,
      profile,
      topic: topic!,
      sourcePostBody,
      sourcePostId: sourcePostIdResolved,
      recentActivity,
      language,
    });
    result = attempt.result;
    toneViolations = attempt.toneViolations;
  } catch (err: unknown) {
    await refundTokens(supabase, opts.userId, deductRes.debited, `${operation}.refund`, {
      reason: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof ContentError) throw err;
    throw new ContentError(
      'MODEL_FAILED',
      language === 'ar' ? 'فشل التوليد. تم استرداد توكناتك' : 'Generation failed. Your tokens were refunded.',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  // Persist cache
  const { data: cacheRow, error: cacheErr } = await supabase
    .from('content_cache')
    .insert({
      user_id: opts.userId,
      content_type: opts.contentType,
      topic_hash: topicHash,
      topic,
      source_post_id: sourcePostIdResolved,
      result,
      language,
      tokens_charged: cost,
      expires_at: expiryForType(opts.contentType).toISOString(),
    })
    .select('id')
    .single();

  if (cacheErr || !cacheRow) {
    await refundTokens(supabase, opts.userId, deductRes.debited, `${operation}.persist_failed`, {
      reason: cacheErr?.message ?? 'cache_insert_failed',
    });
    throw new ContentError('INTERNAL', `Cache write failed: ${cacheErr?.message ?? 'unknown'}`);
  }

  const walletUsed = summarizeDebited(deductRes.debited);

  const { data: versionRow } = await supabase
    .from('content_versions')
    .insert({
      user_id: opts.userId,
      cache_id: cacheRow.id,
      content_type: opts.contentType,
      display_title: truncateTopic(topic!),
      topic: topic!,
      status: 'active',
      tokens_charged: cost,
      wallet_used: walletUsed,
      language,
    })
    .select('id')
    .single();

  // Bookkeeping (best-effort)
  await supabase
    .from('profiles')
    .update({ last_content_at: new Date().toISOString() })
    .eq('id', opts.userId);
  await bumpActiveCount(supabase, opts.userId);
  await bumpPostsCountSinceRadar(supabase, opts.userId);

  return {
    result,
    isCacheHit: false,
    tokensCharged: cost,
    walletUsed,
    cacheId: cacheRow.id,
    versionId: versionRow?.id ?? '',
    toneViolations,
  };
}

async function loadSourcePost(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
): Promise<{ body: string; topic: string } | null> {
  // Try content_versions first (Sprint 5+ content)
  const { data: cv } = await supabase
    .from('content_versions')
    .select('id, cache_id, topic')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (cv?.cache_id) {
    const { data: cache } = await supabase
      .from('content_cache')
      .select('result')
      .eq('id', cv.cache_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (cache) {
      const r = cache.result as Record<string, unknown>;
      const body = typeof r.body === 'string' ? r.body
                 : typeof r.caption === 'string' ? r.caption
                 : JSON.stringify(r).slice(0, 4000);
      return { body, topic: cv.topic ?? 'repurpose' };
    }
  }
  // Fall back to legacy `posts` table
  const { data: legacy } = await supabase
    .from('posts')
    .select('id, content, topic')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (legacy?.content) {
    return { body: legacy.content as string, topic: (legacy.topic as string) || 'repurpose' };
  }
  return null;
}

type RunGenerationOpts = {
  contentType: ContentType;
  profile: CareerProfile;
  topic: string;
  sourcePostBody: string | null;
  sourcePostId: string | null;
  recentActivity: string;
  language: 'ar' | 'en';
};

async function runGenerationWithToneRetry(opts: RunGenerationOpts): Promise<{
  result: ContentResult;
  toneViolations: string[];
}> {
  const first = await runOneGeneration(opts, false);
  const flat = flattenForValidation(first);
  const validation = validateTone(flat, opts.language);
  if (validation.valid) {
    return { result: first, toneViolations: [] };
  }

  // Retry once with stricter system prompt — append the violations to the
  // system message so the model knows exactly what to avoid.
  try {
    const retry = await runOneGeneration(opts, true, validation.violations);
    const retryFlat = flattenForValidation(retry);
    const retryValidation = validateTone(retryFlat, opts.language);
    if (retryValidation.valid) {
      return { result: retry, toneViolations: [] };
    }
    // Serve the retry result with a warning marker — the engine succeeded,
    // the prompt design is the real fix (per A11 ops note).
    return { result: retry, toneViolations: retryValidation.violations };
  } catch {
    // Retry crashed — fall back to the first result with the original violations.
    return { result: first, toneViolations: validation.violations };
  }
}

const STRICT_GUARD_AR = '\n\nإضافة صارمة: تم رصد انتهاكات أسلوبية في المحاولة السابقة. لا تستخدم: "توقّف عن التمرير"، "لن تصدّق"، "رأي صادم"، رؤية 2030، أكثر من 3 هاشتاج، الإيموجي في الفقرة الافتتاحية، اسم أي منصة أو نموذج. ابدأ بملاحظة هادئة من تجربة المستخدم.';
const STRICT_GUARD_EN = '\n\nStrict addendum: tone violations were detected in the previous attempt. Do not use: "Stop scrolling", "I cannot believe", "Hot take", Vision 2030, more than 3 hashtags, emoji-heavy openers, any vendor or model name. Open with a calm observation drawn from the user\'s experience.';

async function runOneGeneration(
  opts: RunGenerationOpts,
  strict: boolean,
  _previousViolations?: string[],
): Promise<ContentResult> {
  const guard = opts.language === 'ar' ? STRICT_GUARD_AR : STRICT_GUARD_EN;

  if (opts.contentType === 'post') {
    // Sprint 8 hotfix pattern: schema + JSON-only directive precede the
    // strict guard so the strict addendum (when present) wraps the JSON rules.
    const system =
      contentPostPrompt.system +
      '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
      contentPostPrompt.schema +
      (strict ? guard : '');
    const userMsg = contentPostPrompt.user({
      goal: opts.profile.goal,
      level: opts.profile.level,
      target_role: opts.profile.target_role,
      industry: opts.profile.industry,
      recent_activity: opts.recentActivity,
      topic: opts.topic,
      language: opts.language,
    });
    const resp = await callClaude({
      task: 'post_generate',
      modelOverride: 'claude-haiku-4-5-20251001',
      system,
      userContent: userMsg,
      maxTokens: 1800,
      temperature: 0.5,
    });
    const txt = extractText(resp);
    const parsed = extractJson<Record<string, unknown>>(txt);
    if (!parsed) throw new ContentError('MODEL_FAILED', 'Could not parse Post JSON.');
    return PostSchema.parse({
      body: parsed.body ?? '',
      hashtags: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]).slice(0, 3) : [],
      language: opts.language,
      topic: opts.topic,
      meta: { generated_at: new Date().toISOString(), content_type: 'post' as const },
    });
  }

  if (opts.contentType === 'carousel') {
    // Sprint 8 hotfix pattern — see post branch above for rationale.
    const system =
      contentCarouselPrompt.system +
      '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
      contentCarouselPrompt.schema +
      (strict ? guard : '');
    const userMsg = contentCarouselPrompt.user({
      goal: opts.profile.goal,
      level: opts.profile.level,
      target_role: opts.profile.target_role,
      industry: opts.profile.industry,
      recent_activity: opts.recentActivity,
      topic: opts.topic,
      language: opts.language,
    });
    const resp = await callClaude({
      task: 'post_generate',
      modelOverride: 'claude-sonnet-4-6',
      system,
      userContent: userMsg,
      maxTokens: 4500,
      temperature: 0.5,
    });
    const txt = extractText(resp);
    const parsed = extractJson<Record<string, unknown>>(txt);
    if (!parsed) throw new ContentError('MODEL_FAILED', 'Could not parse Carousel JSON.');
    return CarouselSchema.parse({
      slides: Array.isArray(parsed.slides)
        ? (parsed.slides as Array<Record<string, unknown>>).map((s) => ({
            title: typeof s.title === 'string' ? s.title : '',
            body: typeof s.body === 'string' ? s.body : '',
            image_prompt: typeof s.image_prompt === 'string' ? s.image_prompt : null,
          }))
        : [],
      caption: typeof parsed.caption === 'string' ? parsed.caption : '',
      hashtags: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]).slice(0, 3) : [],
      language: opts.language,
      topic: opts.topic,
      meta: { generated_at: new Date().toISOString(), content_type: 'carousel' as const },
    });
  }

  // repurpose_bundle
  if (!opts.sourcePostBody) {
    throw new ContentError('SOURCE_POST_NOT_FOUND', 'Source post body required.');
  }
  // Sprint 8 hotfix pattern — see post branch above for rationale.
  const system =
    contentRepurposePrompt.system +
    '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
    contentRepurposePrompt.schema +
    (strict ? guard : '');
  const userMsg = contentRepurposePrompt.user({
    source_post_body: opts.sourcePostBody.slice(0, 6000),
    goal: opts.profile.goal,
    target_role: opts.profile.target_role,
    industry: opts.profile.industry,
    language: opts.language,
  });
  const resp = await callClaude({
    task: 'post_generate',
    modelOverride: 'claude-haiku-4-5-20251001',
    system,
    userContent: userMsg,
    maxTokens: 4000,
    temperature: 0.5,
  });
  const txt = extractText(resp);
  const parsed = extractJson<Record<string, unknown>>(txt);
  if (!parsed) throw new ContentError('MODEL_FAILED', 'Could not parse RepurposeBundle JSON.');

  const carousel = (parsed.carousel ?? {}) as Record<string, unknown>;
  const video = (parsed.short_video_script ?? {}) as Record<string, unknown>;
  const followUp = (parsed.follow_up_post ?? {}) as Record<string, unknown>;

  return RepurposeBundleSchema.parse({
    source_post_id: opts.sourcePostId ?? '',
    carousel: {
      slides: Array.isArray(carousel.slides)
        ? (carousel.slides as Array<Record<string, unknown>>).map((s) => ({
            title: typeof s.title === 'string' ? s.title : '',
            body: typeof s.body === 'string' ? s.body : '',
            image_prompt: typeof s.image_prompt === 'string' ? s.image_prompt : null,
          }))
        : [],
      caption: typeof carousel.caption === 'string' ? carousel.caption : '',
      hashtags: Array.isArray(carousel.hashtags) ? (carousel.hashtags as string[]).slice(0, 3) : [],
    },
    short_video_script: {
      hook: typeof video.hook === 'string' ? video.hook : '',
      beats: Array.isArray(video.beats) ? (video.beats as string[]) : [],
      cta: typeof video.cta === 'string' ? video.cta : '',
    },
    follow_up_post: {
      body: typeof followUp.body === 'string' ? followUp.body : '',
      hashtags: Array.isArray(followUp.hashtags) ? (followUp.hashtags as string[]).slice(0, 3) : [],
    },
    language: opts.language,
    meta: { generated_at: new Date().toISOString(), content_type: 'repurpose_bundle' as const },
  });
}

// ─────────────────────────────────────────────
// Refinement — first 5 free per version
// ─────────────────────────────────────────────

export type ApplyContentRefinementOpts = {
  userId: string;
  language?: 'ar' | 'en';
  versionId: string;
  chipType: string;
  customPrompt?: string;
};

export type ApplyContentRefinementResult = {
  result: ContentResult;
  tokensCharged: number;
  refinementIndex: number;
  isFreeWindow: boolean;
  remainingFree: number;
  cacheId: string;
};

export async function applyContentRefinement(
  supabase: SupabaseClient,
  opts: ApplyContentRefinementOpts,
): Promise<ApplyContentRefinementResult> {
  const language: 'ar' | 'en' = opts.language ?? 'ar';

  const { data: version } = await supabase
    .from('content_versions')
    .select('id, cache_id, content_type, topic, status, language, user_id')
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!version) throw new ContentError('VERSION_NOT_FOUND', 'Version not found.');
  if (version.status === 'legacy') {
    throw new ContentError(
      'LEGACY_READ_ONLY',
      language === 'ar'
        ? 'هذا المحتوى للقراءة فقط. أنشئ محتوى جديداً لتفعيل التحسينات'
        : 'Legacy content is read-only. Create new content to refine.',
    );
  }
  if (!version.cache_id) {
    throw new ContentError('CACHE_NOT_FOUND', 'This version has no cached content to refine.');
  }

  const { data: cache } = await supabase
    .from('content_cache')
    .select('*')
    .eq('id', version.cache_id)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!cache) throw new ContentError('CACHE_NOT_FOUND', 'Cached content missing.');

  // Count refinements so far
  const { count: existingCount } = await supabase
    .from('content_refinements')
    .select('id', { count: 'exact', head: true })
    .eq('version_id', opts.versionId);
  const refinementIndex = (existingCount ?? 0) + 1;
  const isFreeWindow = refinementIndex <= CONTENT_FREE_REFINEMENTS_PER_VERSION;

  let deducted: DeductedBreakdown = [];
  if (!isFreeWindow) {
    const deductRes = await deductTokens(supabase, opts.userId, CONTENT_PAID_REFINEMENT_COST, 'content.v2.refine', {
      version_id: opts.versionId,
      refinement_index: refinementIndex,
      chip_type: opts.chipType,
    });
    if (!deductRes.success) {
      if (deductRes.error === 'INSUFFICIENT_TOKENS') {
        throw new ContentError(
          'INSUFFICIENT_TOKENS',
          language === 'ar' ? 'رصيدك غير كافٍ للتحسين' : 'Not enough tokens for refinement.',
          { available: deductRes.available, cost: CONTENT_PAID_REFINEMENT_COST },
        );
      }
      throw new ContentError('INTERNAL', `Deduction failed: ${deductRes.error}`);
    }
    deducted = deductRes.debited;
  }

  const instruction = opts.customPrompt ?? chipTypeToInstruction(opts.chipType, language);
  const currentResult = cache.result as ContentResult;

  let updatedResult: ContentResult;
  try {
    updatedResult = await runRefinement({
      contentType: version.content_type as ContentType,
      currentResult,
      instruction,
      language,
      topic: version.topic,
      profile: await getCareerProfileWithOverrides(supabase, opts.userId, 'content'),
    });
  } catch (err: unknown) {
    if (deducted.length > 0) {
      await refundTokens(supabase, opts.userId, deducted, 'content.v2.refine.refund', {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
    if (err instanceof ContentError) throw err;
    throw new ContentError(
      'MODEL_FAILED',
      language === 'ar' ? 'فشل التحسين. لم نخصم أي توكن' : 'Refinement failed. No tokens charged.',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  // Persist updated cache
  await supabase
    .from('content_cache')
    .update({
      result: updatedResult,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', cache.id);

  await supabase
    .from('content_versions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', opts.versionId);

  await supabase.from('content_refinements').insert({
    user_id: opts.userId,
    version_id: opts.versionId,
    cache_id: cache.id,
    refinement_index: refinementIndex,
    chip_type: opts.chipType,
    prompt: instruction,
    result_diff: { chip_type: opts.chipType },
    tokens_charged: isFreeWindow ? 0 : CONTENT_PAID_REFINEMENT_COST,
  });

  return {
    result: updatedResult,
    tokensCharged: isFreeWindow ? 0 : CONTENT_PAID_REFINEMENT_COST,
    refinementIndex,
    isFreeWindow,
    remainingFree: Math.max(0, CONTENT_FREE_REFINEMENTS_PER_VERSION - refinementIndex),
    cacheId: cache.id,
  };
}

type RunRefinementOpts = {
  contentType: ContentType;
  currentResult: ContentResult;
  instruction: string;
  language: 'ar' | 'en';
  topic: string;
  profile: CareerProfile | null;
};

async function runRefinement(opts: RunRefinementOpts): Promise<ContentResult> {
  const system = opts.language === 'ar'
    ? 'أنت محرر محتوى محترف لوصل. تستلم محتوى موجوداً مع تعليمات تحسين واضحة. تعيد كتابة المحتوى مع الحفاظ على معناه الأساسي وحقوله الأصلية. التزم بقواعد A11 (لا "توقف عن التمرير"، لا رؤية 2030، حد أقصى 3 هاشتاج). أعد JSON بنفس الشكل المُدخَل.'
    : "You are Wassel's professional content editor. You receive existing content with a clear refinement instruction. You rewrite it preserving its core meaning and structure. Follow A11 tone rules (no 'Stop scrolling', no Vision 2030, max 3 hashtags). Return JSON in the same shape as the input.";

  const userMsg = [
    `Content type: ${opts.contentType}`,
    `Current content (JSON):`,
    JSON.stringify(opts.currentResult).slice(0, 8000),
    ``,
    `Refinement instruction: ${opts.instruction}`,
    ``,
    `Language: ${opts.language}`,
    `Topic: ${opts.topic}`,
    `Target role: ${opts.profile?.target_role ?? 'n/a'}`,
    ``,
    `Return the refined JSON only — same shape as input.`,
  ].join('\n');

  const resp = await callClaude({
    task: 'post_generate',
    modelOverride: 'claude-haiku-4-5-20251001',
    system,
    userContent: userMsg,
    maxTokens: 4000,
    temperature: 0.4,
  });
  const txt = extractText(resp);
  const parsed = extractJson<Record<string, unknown>>(txt);
  if (!parsed) throw new ContentError('MODEL_FAILED', 'Could not parse refined content.');

  // Validate against the right schema
  if (opts.contentType === 'post') {
    return PostSchema.parse({
      body: parsed.body ?? (opts.currentResult as Post).body,
      hashtags: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]).slice(0, 3) : (opts.currentResult as Post).hashtags,
      language: opts.language,
      topic: opts.topic,
      meta: { generated_at: new Date().toISOString(), content_type: 'post' as const },
    });
  }
  if (opts.contentType === 'carousel') {
    const slides = Array.isArray(parsed.slides) ? (parsed.slides as Array<Record<string, unknown>>) : [];
    return CarouselSchema.parse({
      slides: slides.length > 0
        ? slides.map((s) => ({
            title: typeof s.title === 'string' ? s.title : '',
            body: typeof s.body === 'string' ? s.body : '',
            image_prompt: typeof s.image_prompt === 'string' ? s.image_prompt : null,
          }))
        : (opts.currentResult as Carousel).slides,
      caption: typeof parsed.caption === 'string' ? parsed.caption : (opts.currentResult as Carousel).caption,
      hashtags: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]).slice(0, 3) : (opts.currentResult as Carousel).hashtags,
      language: opts.language,
      topic: opts.topic,
      meta: { generated_at: new Date().toISOString(), content_type: 'carousel' as const },
    });
  }
  // repurpose_bundle
  const cur = opts.currentResult as RepurposeBundle;
  const car = (parsed.carousel ?? {}) as Record<string, unknown>;
  const vid = (parsed.short_video_script ?? {}) as Record<string, unknown>;
  const fup = (parsed.follow_up_post ?? {}) as Record<string, unknown>;
  return RepurposeBundleSchema.parse({
    source_post_id: cur.source_post_id,
    carousel: {
      slides: Array.isArray(car.slides) && (car.slides as unknown[]).length > 0
        ? (car.slides as Array<Record<string, unknown>>).map((s) => ({
            title: typeof s.title === 'string' ? s.title : '',
            body: typeof s.body === 'string' ? s.body : '',
            image_prompt: typeof s.image_prompt === 'string' ? s.image_prompt : null,
          }))
        : cur.carousel.slides,
      caption: typeof car.caption === 'string' ? car.caption : cur.carousel.caption,
      hashtags: Array.isArray(car.hashtags) ? (car.hashtags as string[]).slice(0, 3) : cur.carousel.hashtags,
    },
    short_video_script: {
      hook: typeof vid.hook === 'string' ? vid.hook : cur.short_video_script.hook,
      beats: Array.isArray(vid.beats) ? (vid.beats as string[]) : cur.short_video_script.beats,
      cta: typeof vid.cta === 'string' ? vid.cta : cur.short_video_script.cta,
    },
    follow_up_post: {
      body: typeof fup.body === 'string' ? fup.body : cur.follow_up_post.body,
      hashtags: Array.isArray(fup.hashtags) ? (fup.hashtags as string[]).slice(0, 3) : cur.follow_up_post.hashtags,
    },
    language: opts.language,
    meta: { generated_at: new Date().toISOString(), content_type: 'repurpose_bundle' as const },
  });
}

function chipTypeToInstruction(chip: string, lang: 'ar' | 'en'): string {
  const map: Record<string, [string, string]> = {
    shorter: ['اجعله أقصر مع الحفاظ على الفكرة الأساسية', 'Make it shorter while preserving the main idea.'],
    longer: ['اجعله أطول قليلاً مع تفاصيل أعمق', 'Make it slightly longer with deeper detail.'],
    more_professional: ['اجعل النبرة أكثر احترافية وأقل عاطفية', 'Make the tone more professional and less casual.'],
    more_personal: ['أضف لمسة شخصية من تجربة المستخدم', "Add a personal touch from the user's experience."],
    different_hook: ['غيّر الافتتاحية إلى ملاحظة هادئة جديدة', 'Replace the opener with a calm fresh observation.'],
    different_cta: ['غيّر الخاتمة إلى دعوة مختلفة للنقاش', 'Replace the closing call with a different conversational invite.'],
    rephrase: ['أعد صياغة المحتوى بكلمات مختلفة', 'Rephrase using different wording.'],
  };
  const v = map[chip];
  if (!v) return lang === 'ar' ? 'حسّن هذا المحتوى' : 'Refine this content.';
  return lang === 'ar' ? v[0] : v[1];
}

// ─────────────────────────────────────────────
// Archive / Restore / Publish
// ─────────────────────────────────────────────

export async function archiveContent(
  supabase: SupabaseClient,
  opts: { userId: string; versionId: string },
): Promise<{ success: boolean }> {
  const { data: existing } = await supabase
    .from('content_versions')
    .select('id, status')
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!existing) throw new ContentError('VERSION_NOT_FOUND', 'Version not found.');
  if (existing.status === 'legacy') {
    throw new ContentError('LEGACY_READ_ONLY', 'Legacy versions cannot be archived.');
  }

  const { error } = await supabase
    .from('content_versions')
    .update({ status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId);
  if (error) throw new ContentError('INTERNAL', error.message);
  await bumpActiveCount(supabase, opts.userId);
  return { success: true };
}

export async function restoreContent(
  supabase: SupabaseClient,
  opts: { userId: string; versionId: string },
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('content_versions')
    .update({ status: 'active', archived_at: null, updated_at: new Date().toISOString() })
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId);
  if (error) throw new ContentError('INTERNAL', error.message);
  await bumpActiveCount(supabase, opts.userId);
  return { success: true };
}

export async function markPublishedExternally(
  supabase: SupabaseClient,
  opts: { userId: string; versionId: string; externalUrl?: string },
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('content_versions')
    .update({
      status: 'published_externally',
      external_url: opts.externalUrl ?? null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId);
  if (error) throw new ContentError('INTERNAL', error.message);
  await bumpActiveCount(supabase, opts.userId);
  return { success: true };
}

// ─────────────────────────────────────────────
// Reminder — smart nudge (A12 V1, NOT scheduled publishing)
// ─────────────────────────────────────────────

export async function setReminder(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    versionId: string;
    remindAt: string; // ISO timestamp
    channels?: Array<'in_app' | 'email'>;
  },
): Promise<{ reminderId: string }> {
  const { data: version } = await supabase
    .from('content_versions')
    .select('id, status')
    .eq('id', opts.versionId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  if (!version) throw new ContentError('VERSION_NOT_FOUND', 'Version not found.');

  const { data: row, error } = await supabase
    .from('content_reminders')
    .insert({
      user_id: opts.userId,
      version_id: opts.versionId,
      remind_at: opts.remindAt,
      notification_channel: opts.channels ?? ['in_app'],
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !row) throw new ContentError('INTERNAL', error?.message ?? 'reminder insert failed');
  return { reminderId: row.id };
}

export async function dismissReminder(
  supabase: SupabaseClient,
  opts: { userId: string; reminderId: string },
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('content_reminders')
    .update({ status: 'dismissed' })
    .eq('id', opts.reminderId)
    .eq('user_id', opts.userId);
  if (error) throw new ContentError('INTERNAL', error.message);
  return { success: true };
}

// ─────────────────────────────────────────────
// Bookkeeping helpers
// ─────────────────────────────────────────────

async function bumpActiveCount(supabase: SupabaseClient, userId: string): Promise<void> {
  const { count } = await supabase
    .from('content_versions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  await supabase
    .from('profiles')
    .update({ active_content_count: count ?? 0 })
    .eq('id', userId);
}

async function bumpPostsCountSinceRadar(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const { data: row } = await supabase
      .from('profiles')
      .select('posts_count_since_last_radar')
      .eq('id', userId)
      .maybeSingle();
    const current = Number((row as { posts_count_since_last_radar?: number } | null)?.posts_count_since_last_radar ?? 0);
    await supabase
      .from('profiles')
      .update({ posts_count_since_last_radar: current + 1 })
      .eq('id', userId);
  } catch {
    // best-effort
  }
}
