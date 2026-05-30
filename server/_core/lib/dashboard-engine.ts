import type { SupabaseClient } from '@supabase/supabase-js';
import { callClaude, extractText, extractJson } from './claude-client';
import { getCareerProfile, type CareerProfile, type Language } from './career-profile';
import { getWallets } from './wallets';
import { getReadiness, projectedReadinessGain } from './readiness';
import { nextTaskPrompt } from '../prompts/_generated';

/**
 * Dashboard Engine — Sprint 6 brain of /v2/home.
 *
 * Responsibilities:
 *   - Read aggregates (pulse, drafts, activity feed)
 *   - Score active AI suggestions and surface the top one as Next Task
 *   - Generate fresh AI suggestions via the next-task prompt (nightly cron)
 *   - Compute the "Suffices For" wallet calculator
 *   - Emit activity_log rows for client-side UX events
 *
 * Reads from: activity_log, ai_suggestions, career_pulse_snapshots,
 *   wallet_suffices_for_cache, profiles, career_profile, radar_*, resume_*,
 *   content_*. Writes only to its own tables + activity_log + ai_suggestions.
 */

// ─────────────────────────────────────────────
// Canonical product costs (mirrored from the engines to avoid imports
// that would pull entire engine modules into the cron + dashboard router).
// ─────────────────────────────────────────────
export const COST_RADAR = 149;
export const COST_RESUME_FULL_BUILD = 179;
export const COST_RESUME_NEW_VERSION = 49;
export const COST_CONTENT_POST = 5;
export const COST_CONTENT_CAROUSEL = 25;
export const COST_CONTENT_REPURPOSE = 15;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type DashboardPillar = 'onboarding' | 'radar' | 'resume' | 'content' | 'profile' | 'wallet' | 'dashboard' | 'system';

export type AiSuggestionRow = {
  id: string;
  user_id: string;
  suggestion_type: 'next_task' | 'quick_win' | 'reminder' | 'opportunity' | null;
  pillar: 'radar' | 'resume' | 'content' | 'profile' | 'wallet' | null;
  headline: string;
  rationale: string;
  cta_label: string | null;
  cta_url: string;
  cta_payload: Record<string, unknown> | null;
  score: number;
  priority_score: number | null;
  language: 'ar' | 'en';
  status: 'active' | 'dismissed' | 'acted_upon' | 'expired';
  expires_at: string | null;
  acted_upon_at: string | null;
  dismissed_at: string | null;
  computed_for_date: string;
  created_at: string;
};

export type ActivityLogEntry = {
  id: number;
  user_id: string;
  action: string;
  pillar: DashboardPillar | null;
  target: string | null;
  payload: Record<string, unknown> | null;
  related_resource_type: string | null;
  related_resource_id: string | null;
  tokens_charged: number;
  language: 'ar' | 'en' | null;
  created_at: string;
};

export type CareerPulse = {
  radarScore: number | null;
  radarLastUpdated: string | null;
  radarScoreDelta30d: number | null;
  resumeCount: number;
  activeResumeAtsScore: number | null;
  resumeLastUpdated: string | null;
  contentCount30d: number;
  contentLastPostedAt: string | null;
  walletSummary: {
    bonus: number;
    subscription: number;
    topup: number;
    total: number;
    bonusExpiresAt: string | null;
  };
  streakDays: number;
  latestQuickWins: Array<{
    title: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'very_low' | 'low' | 'medium' | 'high';
    cacheId: string;
  }>;
};

export type DraftSummary = {
  resume: Array<{
    id: string;
    target_role: string;
    display_name: string;
    ats_score: number | null;
    updated_at: string;
    cache_id: string | null;
  }>;
  content: Array<{
    id: string;
    content_type: 'post' | 'carousel' | 'repurpose_bundle';
    display_title: string;
    topic: string;
    updated_at: string;
  }>;
  radar: Array<{
    id: string;
    target_role: string;
    current_score: number;
    target_score: number;
    created_at: string;
  }>;
};

export type SufficesFor = {
  walletTotal: number;
  breakdown: {
    radar: number;
    resume: number;
    post: number;
    carousel: number;
    repurpose: number;
  };
  recommendedBundle: {
    labelKey: 'fullJourney' | 'contentPush' | 'roleRefresh' | 'topUpFirst';
    items: Array<{ type: string; count: number; totalCost: number }>;
    totalCost: number;
    remainingAfter: number;
  };
};

// ─────────────────────────────────────────────
// Activity log emitter
// ─────────────────────────────────────────────

export async function logActivity(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    action: string;
    pillar?: DashboardPillar;
    target?: string;
    payload?: Record<string, unknown>;
    relatedResourceType?: string;
    relatedResourceId?: string;
    tokensCharged?: number;
    language?: 'ar' | 'en';
  }
): Promise<void> {
  try {
    await supabase.from('activity_log').insert({
      user_id: opts.userId,
      action: opts.action,
      pillar: opts.pillar ?? null,
      target: opts.target ?? null,
      payload: opts.payload ?? null,
      related_resource_type: opts.relatedResourceType ?? null,
      related_resource_id: opts.relatedResourceId ?? null,
      tokens_charged: opts.tokensCharged ?? 0,
      language: opts.language ?? null,
    });
  } catch (e) {
    console.warn('[dashboard-engine] logActivity insert failed:', e);
  }
}

// ─────────────────────────────────────────────
// Career Pulse
// ─────────────────────────────────────────────

export async function getCareerPulse(
  supabase: SupabaseClient,
  userId: string,
  _language: 'ar' | 'en' = 'ar'
): Promise<CareerPulse> {
  // Radar: latest analysis (or cache)
  const { data: radarLatest } = await supabase
    .from('radar_analyses')
    .select('current_score, created_at, cache_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const latest = (radarLatest ?? [])[0] as
    | { current_score: number | null; created_at: string; cache_id: string | null }
    | undefined;

  // Find the previous (30+ days ago) analysis for delta
  let radarScoreDelta30d: number | null = null;
  if (latest?.current_score != null) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: prev } = await supabase
      .from('radar_analyses')
      .select('current_score, created_at')
      .eq('user_id', userId)
      .lte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    const prevRow = (prev ?? [])[0] as { current_score: number | null } | undefined;
    if (prevRow?.current_score != null) {
      radarScoreDelta30d = latest.current_score - prevRow.current_score;
    }
  }

  // Quick wins from the latest radar_cache
  let latestQuickWins: CareerPulse['latestQuickWins'] = [];
  if (latest?.cache_id) {
    const { data: cache } = await supabase
      .from('radar_cache')
      .select('id, result')
      .eq('id', latest.cache_id)
      .maybeSingle();
    const wins = ((cache as { result?: { quick_wins?: Array<Record<string, unknown>> } } | null)?.result?.quick_wins ?? []).slice(0, 3);
    latestQuickWins = wins.map((w) => ({
      title: String(w.title ?? ''),
      impact: (w.impact as 'high' | 'medium' | 'low') ?? 'medium',
      effort: (w.effort as 'very_low' | 'low' | 'medium' | 'high') ?? 'medium',
      cacheId: (cache as { id: string } | null)?.id ?? '',
    }));
  }

  // Resume: count + latest active ATS score
  const { count: resumeCount } = await supabase
    .from('resume_versions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  const { data: resumeLatest } = await supabase
    .from('resume_versions')
    .select('ats_score, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1);
  const rLatest = (resumeLatest ?? [])[0] as { ats_score: number | null; updated_at: string } | undefined;

  // Content: count in last 30 days + latest
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: contentCount30d } = await supabase
    .from('content_versions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'legacy')
    .gte('created_at', thirtyDaysAgoIso);

  const { data: contentLatest } = await supabase
    .from('content_versions')
    .select('created_at')
    .eq('user_id', userId)
    .neq('status', 'legacy')
    .order('created_at', { ascending: false })
    .limit(1);
  const cLatest = (contentLatest ?? [])[0] as { created_at: string } | undefined;

  // Wallets
  const wallets = await getWallets(supabase, userId);

  // Streak
  const { data: profile } = await supabase
    .from('profiles')
    .select('dashboard_streak_days')
    .eq('id', userId)
    .maybeSingle();
  const streakDays = Number((profile as { dashboard_streak_days?: number } | null)?.dashboard_streak_days ?? 0);

  return {
    radarScore: latest?.current_score ?? null,
    radarLastUpdated: latest?.created_at ?? null,
    radarScoreDelta30d,
    resumeCount: resumeCount ?? 0,
    activeResumeAtsScore: rLatest?.ats_score ?? null,
    resumeLastUpdated: rLatest?.updated_at ?? null,
    contentCount30d: contentCount30d ?? 0,
    contentLastPostedAt: cLatest?.created_at ?? null,
    walletSummary: {
      bonus: wallets.bonus.balance,
      subscription: wallets.subscription.balance,
      topup: wallets.topup.balance,
      total: wallets.total,
      bonusExpiresAt: wallets.bonus.expires_at,
    },
    streakDays,
    latestQuickWins,
  };
}

// ─────────────────────────────────────────────
// Next Task — top scored active suggestion
// ─────────────────────────────────────────────

export async function getNextTask(
  supabase: SupabaseClient,
  userId: string,
  language: 'ar' | 'en' = 'ar'
): Promise<AiSuggestionRow | null> {
  // Expire suggestions whose expires_at has passed (best-effort)
  await supabase
    .from('ai_suggestions')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());

  // Surface only suggestions that match the user's CURRENT language. A
  // suggestion authored in a different language (e.g. the user switched
  // ar↔en after a nightly generation) is hidden — never shown, never
  // deleted. We don't translate stored rows; the right task is the one
  // written in the language the user reads now.
  const { data, error } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('language', language)
    .order('priority_score', { ascending: false, nullsFirst: false })
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0) {
    return data[0] as AiSuggestionRow;
  }

  // No active suggestion in the requested language. Generate one fresh,
  // in the correct language, in this same call. Throttle: exactly one
  // generation attempt per load (generateSuggestions makes a single Claude
  // call). On any failure we return null and the dashboard renders its
  // safe empty state — we never surface the mismatched-language row.
  try {
    const { suggestions } = await generateSuggestions(supabase, userId, language);
    return suggestions[0] ?? null;
  } catch (e) {
    console.warn('[dashboard-engine] getNextTask regenerate failed:', e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Next Best Action — impact ÷ effort, scored by projected Readiness gain
// ─────────────────────────────────────────────

/**
 * Map a radar quick-win's qualitative impact to an estimated number of RADAR
 * points it would add. Quick wins improve the LinkedIn/Radar side, so the gain
 * flows through the 0.6 radar weight when projected onto unified Readiness.
 */
const IMPACT_RADAR_POINTS: Record<'high' | 'medium' | 'low', number> = {
  high: 12,
  medium: 7,
  low: 3,
};

/** Effort label + a rough minutes estimate, for the "دقيقتان" chip. */
const EFFORT_MINUTES: Record<'very_low' | 'low' | 'medium' | 'high', number> = {
  very_low: 2,
  low: 5,
  medium: 15,
  high: 45,
};

export type NextBestAction = {
  /** The underlying AI suggestion (same row the Next Task card shows). */
  task: AiSuggestionRow | null;
  /** Projected unified-Readiness points this action would add (≥ 0). */
  pointGain: number | null;
  /** Coarse effort bucket, from the radar quick win when available. */
  effort: 'very_low' | 'low' | 'medium' | 'high' | null;
  /** Rough minutes estimate derived from effort (for the UI chip). */
  effortMinutes: number | null;
  /** Where the point-gain estimate came from. */
  source: 'radar_quick_win' | 'pillar_estimate' | null;
};

/**
 * The single most valuable next move, annotated with its projected Readiness
 * point-gain and effort. Layers on top of the existing getNextTask plumbing —
 * it does NOT replace it. We reuse the top radar quick win (which carries real
 * impact/effort values) to estimate the gain; if the task isn't radar-derived
 * we fall back to a conservative pillar estimate so the number is never blank
 * when an action exists.
 *
 * Read-only + cheap. Never throws.
 */
export async function getNextBestAction(
  supabase: SupabaseClient,
  userId: string,
  language: 'ar' | 'en' = 'ar'
): Promise<NextBestAction> {
  const task = await getNextTask(supabase, userId, language);
  if (!task) {
    return { task: null, pointGain: null, effort: null, effortMinutes: null, source: null };
  }

  // Readiness inputs — needed to project the gain against the live baseline.
  let radarCurrent: number | null = null;
  let atsCurrent: number | null = null;
  try {
    const r = await getReadiness(supabase, userId);
    radarCurrent = r.breakdown.radar;
    atsCurrent = r.breakdown.ats;
  } catch {
    /* leave nulls — projectedReadinessGain treats them safely */
  }

  // Prefer the top radar quick win's impact/effort when the task is radar-side.
  let impact: 'high' | 'medium' | 'low' | null = null;
  let effort: 'very_low' | 'low' | 'medium' | 'high' | null = null;
  let source: NextBestAction['source'] = null;

  if (task.pillar === 'radar') {
    try {
      const { data: cacheRows } = await supabase
        .from('radar_cache')
        .select('result, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      const result = (cacheRows ?? [])[0] as
        | { result?: { quick_wins?: Array<{ impact?: string; effort?: string }> } }
        | undefined;
      const top = result?.result?.quick_wins?.[0];
      if (top) {
        impact = (top.impact as 'high' | 'medium' | 'low') ?? 'medium';
        effort = (top.effort as 'very_low' | 'low' | 'medium' | 'high') ?? 'low';
        source = 'radar_quick_win';
      }
    } catch {
      /* fall through to estimate */
    }
  }

  // Project the gain. Each pillar maps to which side of the score it moves:
  //   radar/profile → radar side (×0.6)   |   resume → ATS side (×0.4)
  let pointGain: number;
  if (source === 'radar_quick_win' && impact) {
    pointGain = projectedReadinessGain({
      radarCurrent,
      atsCurrent,
      deltaRadar: IMPACT_RADAR_POINTS[impact],
    });
  } else {
    // Conservative pillar estimate (no quick-win data). A medium-impact move.
    source = 'pillar_estimate';
    effort = effort ?? 'medium';
    if (task.pillar === 'resume') {
      // Building/improving a resume moves the ATS side. If there's no resume
      // yet, model creating one at a solid starting ATS (~70).
      pointGain = projectedReadinessGain({
        radarCurrent,
        atsCurrent,
        deltaAts: atsCurrent == null ? 70 : IMPACT_RADAR_POINTS.medium,
      });
    } else {
      // radar / profile / content / wallet → radar-side estimate.
      pointGain = projectedReadinessGain({
        radarCurrent,
        atsCurrent,
        deltaRadar: atsCurrent == null && radarCurrent == null && task.pillar === 'radar' ? 60 : IMPACT_RADAR_POINTS.medium,
      });
    }
  }

  return {
    task,
    pointGain,
    effort,
    effortMinutes: effort ? EFFORT_MINUTES[effort] : null,
    source,
  };
}

export async function listSuggestions(
  supabase: SupabaseClient,
  userId: string,
  opts?: { status?: 'active' | 'dismissed' | 'acted_upon' | 'expired' | 'all'; limit?: number }
): Promise<AiSuggestionRow[]> {
  let query = supabase
    .from('ai_suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('priority_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 10);

  if (opts?.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  } else if (!opts?.status) {
    query = query.eq('status', 'active');
  }

  const { data } = await query;
  return (data ?? []) as AiSuggestionRow[];
}

// ─────────────────────────────────────────────
// Generate suggestions (called by cron + manual regenerate)
// ─────────────────────────────────────────────

const PILLAR_BY_CTA: Record<string, 'radar' | 'resume' | 'content' | 'profile'> = {
  '/v2/analyze': 'radar',
  '/v2/cvs/new': 'resume',
  '/v2/posts/new': 'content',
  '/v2/settings/career': 'profile',
};

const PILLAR_WEIGHT: Record<'profile' | 'radar' | 'resume' | 'content' | 'wallet', number> = {
  profile: 1.0,
  radar: 0.9,
  resume: 0.85,
  content: 0.7,
  wallet: 0.5,
};

function recencyMultiplier(lastActionDaysAgo: number | null): number {
  if (lastActionDaysAgo == null) return 1.0;
  if (lastActionDaysAgo < 1) return 0.3;
  if (lastActionDaysAgo < 7) return 0.6;
  if (lastActionDaysAgo < 30) return 1.0;
  return 0.8;
}

async function computePriorityScore(
  supabase: SupabaseClient,
  userId: string,
  pillar: 'profile' | 'radar' | 'resume' | 'content' | 'wallet',
  confidence: number /* 0..1 */
): Promise<number> {
  // Last action in the pillar
  const { data: lastAction } = await supabase
    .from('activity_log')
    .select('created_at')
    .eq('user_id', userId)
    .eq('pillar', pillar)
    .order('created_at', { ascending: false })
    .limit(1);
  const lastTs = (lastAction ?? [])[0] as { created_at: string } | undefined;
  const daysAgo = lastTs ? (Date.now() - new Date(lastTs.created_at).getTime()) / (24 * 60 * 60 * 1000) : null;

  // Dismissed similar pillar suggestions in last 30d
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: dismissed30d } = await supabase
    .from('ai_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('pillar', pillar)
    .eq('status', 'dismissed')
    .gte('dismissed_at', thirtyDaysAgoIso);

  const dismissCount = dismissed30d ?? 0;
  let userPreference = 1.0;
  if (dismissCount >= 3) userPreference = 0.1;
  else if (dismissCount === 2) userPreference = 0.4;
  else if (dismissCount === 1) userPreference = 0.7;

  const base = PILLAR_WEIGHT[pillar];
  const recency = recencyMultiplier(daysAgo);
  return Math.round(base * confidence * recency * userPreference * 100) / 100;
}

async function buildActivityDigest(supabase: SupabaseClient, userId: string): Promise<string> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('activity_log')
    .select('action, pillar, created_at, payload')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true })
    .limit(50);

  const rows = (data ?? []) as Array<{
    action: string;
    pillar: string | null;
    created_at: string;
    payload: Record<string, unknown> | null;
  }>;

  if (rows.length === 0) return '(no recent activity)';
  return rows
    .map((r) => {
      const date = r.created_at.slice(0, 10);
      const targetRole = (r.payload as { target_role?: string } | null)?.target_role;
      return `${date}  ${r.action}${targetRole ? ` [${targetRole}]` : ''}`;
    })
    .join('\n');
}

export async function generateSuggestions(
  supabase: SupabaseClient,
  userId: string,
  language: 'ar' | 'en' = 'ar'
): Promise<{ suggestions: AiSuggestionRow[]; generated: number }> {
  const profile = await getCareerProfile(supabase, userId);
  if (!profile) return { suggestions: [], generated: 0 };

  const activityDigest = await buildActivityDigest(supabase, userId);
  const today = new Date().toISOString().slice(0, 10);

  let parsed: {
    headline?: string;
    rationale?: string;
    cta_url?: string;
    score?: number;
    language?: 'ar' | 'en';
  } | null = null;

  try {
    // Augment the system prompt with the schema and a strict JSON-only
    // directive. The compiled `nextTaskPrompt.system` describes voice and
    // content rules but never tells the model to OUTPUT JSON, so Claude
    // was returning prose and extractJson() returned null. We append the
    // schema + a one-line instruction here so the validator
    // (parsed.headline && parsed.cta_url && parsed.rationale) passes.
    const systemWithSchema =
      nextTaskPrompt.system +
      '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
      nextTaskPrompt.schema;

    const res = await callClaude({
      task: 'post_generate', // Haiku — same speed/cost tier
      modelOverride: 'claude-haiku-4-5-20251001',
      system: systemWithSchema,
      userContent: nextTaskPrompt.user({
        goal: profile.goal,
        level: profile.level,
        target_role: profile.target_role,
        industry: profile.industry,
        language,
        activity_log: activityDigest,
        today,
      }),
      maxTokens: 600,
      temperature: 0.5,
    });
    const text = extractText(res);
    parsed = extractJson(text);
  } catch (e) {
    console.warn('[dashboard-engine] generateSuggestions Claude call failed:', e);
    parsed = null;
  }

  if (!parsed || !parsed.headline || !parsed.cta_url || !parsed.rationale) {
    return { suggestions: [], generated: 0 };
  }

  const ctaUrl = parsed.cta_url;
  const pillar = PILLAR_BY_CTA[ctaUrl] ?? 'profile';
  const score = Math.min(10, Math.max(1, Math.round(parsed.score ?? 5)));
  const confidence = score / 10;
  const priorityScore = await computePriorityScore(supabase, userId, pillar, confidence);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const row = {
    user_id: userId,
    suggestion_type: 'next_task' as const,
    pillar,
    headline: parsed.headline,
    rationale: parsed.rationale,
    cta_url: ctaUrl,
    cta_label: language === 'ar' ? 'ابدأ الآن' : 'Start now',
    cta_payload: null as Record<string, unknown> | null,
    score,
    priority_score: priorityScore,
    language,
    status: 'active' as const,
    expires_at: expiresAt,
    computed_for_date: today,
  };

  const { data, error } = await supabase
    .from('ai_suggestions')
    .insert(row)
    .select('*')
    .single();

  if (error || !data) {
    console.warn('[dashboard-engine] suggestion insert failed:', error?.message);
    return { suggestions: [], generated: 0 };
  }

  return { suggestions: [data as AiSuggestionRow], generated: 1 };
}

// ─────────────────────────────────────────────
// Suggestion lifecycle
// ─────────────────────────────────────────────

export async function dismissSuggestion(
  supabase: SupabaseClient,
  userId: string,
  suggestionId: string
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({
      status: 'dismissed',
      dismissed: true,
      dismissed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .eq('user_id', userId);

  if (!error) {
    await logActivity(supabase, {
      userId,
      action: 'next_task.dismissed',
      pillar: 'dashboard',
      relatedResourceType: 'ai_suggestions',
      relatedResourceId: suggestionId,
    });
  }
  return { success: !error };
}

export async function acknowledgeSuggestion(
  supabase: SupabaseClient,
  userId: string,
  suggestionId: string
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({
      status: 'acted_upon',
      actioned: true,
      acted_upon_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .eq('user_id', userId);

  if (!error) {
    await logActivity(supabase, {
      userId,
      action: 'next_task.actioned',
      pillar: 'dashboard',
      relatedResourceType: 'ai_suggestions',
      relatedResourceId: suggestionId,
    });
  }
  return { success: !error };
}

// ─────────────────────────────────────────────
// Activity Feed
// ─────────────────────────────────────────────

export async function getActivityFeed(
  supabase: SupabaseClient,
  userId: string,
  opts?: { pillar?: DashboardPillar; days?: number; limit?: number }
): Promise<ActivityLogEntry[]> {
  const daysAgo = new Date(Date.now() - (opts?.days ?? 7) * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('activity_log')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', daysAgo)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 20);

  if (opts?.pillar) query = query.eq('pillar', opts.pillar);

  const { data } = await query;
  return (data ?? []) as ActivityLogEntry[];
}

// ─────────────────────────────────────────────
// Drafts library
// ─────────────────────────────────────────────

export async function getDrafts(supabase: SupabaseClient, userId: string): Promise<DraftSummary> {
  const [{ data: resumeRows }, { data: contentRows }, { data: radarRows }] = await Promise.all([
    supabase
      .from('resume_versions')
      .select('id, target_role, display_name, ats_score, updated_at, cache_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('content_versions')
      .select('id, content_type, display_title, topic, updated_at, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('radar_cache')
      .select('id, target_role, current_score, target_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    resume: ((resumeRows ?? []) as Array<DraftSummary['resume'][number]>),
    content: ((contentRows ?? []) as Array<DraftSummary['content'][number]>),
    radar: ((radarRows ?? []) as Array<DraftSummary['radar'][number]>),
  };
}

// ─────────────────────────────────────────────
// "Suffices For" — wallet smart calculator
// ─────────────────────────────────────────────

export async function getSufficesFor(supabase: SupabaseClient, userId: string): Promise<SufficesFor> {
  const wallets = await getWallets(supabase, userId);
  const total = wallets.total;

  const breakdown = {
    radar:     Math.floor(total / COST_RADAR),
    resume:    Math.floor(total / COST_RESUME_FULL_BUILD),
    post:      Math.floor(total / COST_CONTENT_POST),
    carousel:  Math.floor(total / COST_CONTENT_CAROUSEL),
    repurpose: Math.floor(total / COST_CONTENT_REPURPOSE),
  };

  // Read what the user has done to pick the most-useful recommended bundle
  const { data: latestRadar } = await supabase
    .from('radar_analyses')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  const { count: activeResumes } = await supabase
    .from('resume_versions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  let recommendedBundle: SufficesFor['recommendedBundle'];
  const FULL_JOURNEY_COST = COST_RADAR + COST_RESUME_FULL_BUILD + 5 * COST_CONTENT_POST; // 149+179+25 = 353

  if (total >= FULL_JOURNEY_COST && ((latestRadar ?? []).length === 0 || (activeResumes ?? 0) === 0)) {
    recommendedBundle = {
      labelKey: 'fullJourney',
      items: [
        { type: 'radar',  count: 1, totalCost: COST_RADAR },
        { type: 'resume', count: 1, totalCost: COST_RESUME_FULL_BUILD },
        { type: 'post',   count: 5, totalCost: 5 * COST_CONTENT_POST },
      ],
      totalCost: FULL_JOURNEY_COST,
      remainingAfter: total - FULL_JOURNEY_COST,
    };
  } else if (total >= 4 * COST_CONTENT_POST + COST_CONTENT_CAROUSEL) {
    const cost = 4 * COST_CONTENT_POST + COST_CONTENT_CAROUSEL;
    recommendedBundle = {
      labelKey: 'contentPush',
      items: [
        { type: 'post',     count: 4, totalCost: 4 * COST_CONTENT_POST },
        { type: 'carousel', count: 1, totalCost: COST_CONTENT_CAROUSEL },
      ],
      totalCost: cost,
      remainingAfter: total - cost,
    };
  } else if (total >= COST_RESUME_NEW_VERSION) {
    recommendedBundle = {
      labelKey: 'roleRefresh',
      items: [{ type: 'resume_new_version', count: 1, totalCost: COST_RESUME_NEW_VERSION }],
      totalCost: COST_RESUME_NEW_VERSION,
      remainingAfter: total - COST_RESUME_NEW_VERSION,
    };
  } else {
    recommendedBundle = {
      labelKey: 'topUpFirst',
      items: [],
      totalCost: 0,
      remainingAfter: total,
    };
  }

  // Cache it best-effort (the cache isn't authoritative; it's just a UI accelerator)
  try {
    const payload: SufficesFor = { walletTotal: total, breakdown, recommendedBundle };
    await supabase
      .from('wallet_suffices_for_cache')
      .upsert(
        {
          user_id: userId,
          wallet_total: total,
          suffices_for: payload,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
  } catch {
    /* swallow */
  }

  return { walletTotal: total, breakdown, recommendedBundle };
}

// ─────────────────────────────────────────────
// Streak / visit
// ─────────────────────────────────────────────

export async function markVisited(supabase: SupabaseClient, userId: string): Promise<{ streakDays: number }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_dashboard_visit, dashboard_streak_days')
    .eq('id', userId)
    .maybeSingle();

  const prev = profile as { last_dashboard_visit: string | null; dashboard_streak_days: number | null } | null;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let nextStreak = 1;
  const lastDate = prev?.last_dashboard_visit ? prev.last_dashboard_visit.slice(0, 10) : null;
  if (lastDate === today) {
    nextStreak = prev?.dashboard_streak_days ?? 1;
  } else if (lastDate === yesterday) {
    nextStreak = (prev?.dashboard_streak_days ?? 0) + 1;
  } else {
    nextStreak = 1;
  }

  await supabase
    .from('profiles')
    .update({
      last_dashboard_visit: now.toISOString(),
      dashboard_streak_days: nextStreak,
    })
    .eq('id', userId);

  return { streakDays: nextStreak };
}

// ─────────────────────────────────────────────
// Career Pulse snapshot — used by the nightly cron
// ─────────────────────────────────────────────

export async function snapshotPulse(supabase: SupabaseClient, userId: string): Promise<void> {
  const pulse = await getCareerPulse(supabase, userId);
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('career_pulse_snapshots')
    .upsert(
      {
        user_id: userId,
        snapshot_date: today,
        radar_score: pulse.radarScore,
        resume_count: pulse.resumeCount,
        active_resume_ats_score: pulse.activeResumeAtsScore,
        content_count_30d: pulse.contentCount30d,
        wallet_total: pulse.walletSummary.total,
        wallet_bonus: pulse.walletSummary.bonus,
        wallet_subscription: pulse.walletSummary.subscription,
        wallet_topup: pulse.walletSummary.topup,
        bonus_expires_at: pulse.walletSummary.bonusExpiresAt,
      },
      { onConflict: 'user_id,snapshot_date' }
    );
}

// Re-export for convenience (getReadiness is imported above and used by
// getNextBestAction; surface it + its type so the router imports one module).
export { getReadiness };
export type { Readiness } from './readiness';
