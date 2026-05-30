import type { SupabaseClient } from '@supabase/supabase-js';
import { callClaude, extractText, extractJson } from './claude-client';
import { validateOutput } from './output-guard';
import { getCareerProfile, type Language } from './career-profile';
import { getWallets } from './wallets';
import { companionWelcomePrompt } from '../prompts/_generated';
import {
  COST_RADAR,
  COST_RESUME_FULL_BUILD,
  COST_CONTENT_POST,
  type AiSuggestionRow,
} from './dashboard-engine';

/**
 * Companion Engine — the in-app "career companion" (Phase 1, post-login).
 *
 * Responsibilities:
 *   - Read/seed the per-user companion_state (welcome + tour lifecycle).
 *   - Mark the welcome moment / tour as done (so they each fire exactly once).
 *   - Generate the ONE smart welcome line (Haiku, free — no token deduction).
 *   - Record lightweight behavioural signals (storage only, adaptation seed).
 *   - Compose the companion's contextual message by REUSING the dashboard's
 *     Next Task (zero new Claude burn) and layering step-by-step purchase
 *     guidance when the user's wallet can't cover the suggested action.
 *
 * Writes only to: companion_state, companion_signals.
 * Reads from: career_profile, profiles, ai_suggestions (via getNextTask),
 *   wallet_* (via getWallets). Touches no other engine's tables.
 *
 * The companion NEVER reveals it is AI-backed. There is no "regenerate" verb,
 * no model name, no vendor. The welcome line is generated once and cached.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type CompanionState = {
  user_id: string;
  welcomed_at: string | null;
  tour_done_at: string | null;
  welcome_message: string | null;
  welcome_message_lang: Language | null;
  visit_count: number;
  created_at: string;
  updated_at: string;
};

export type CompanionSignalType = 'page_view' | 'action' | 'visit';

/**
 * The cost of the action a Next Task points at, so the companion can guide a
 * top-up "step by step" when the wallet falls short. Mirrors the pillar→action
 * mapping the dashboard already uses. Profile/wallet pillars cost nothing
 * (adjusting your target role is free), so they never trigger guidance.
 */
const COST_BY_PILLAR: Record<string, number> = {
  radar: COST_RADAR,
  resume: COST_RESUME_FULL_BUILD,
  content: COST_CONTENT_POST,
};

export type PurchaseGuidance = {
  /** the action the next task implies needs tokens the user doesn't have */
  needed: number;
  /** the user's current total balance across the three wallets */
  balance: number;
  /** how many more tokens are required (needed - balance, floored at 1) */
  shortfall: number;
  /** which pillar's action triggered this (for the client copy) */
  pillar: 'radar' | 'resume' | 'content';
  /** where to send the user to resolve it */
  cta_url: '/v2/pricing';
};

export type CompanionMessage = {
  /** the reused Next Task suggestion (null if none / dashboard empty state) */
  task: AiSuggestionRow | null;
  /** present only when the wallet can't cover the task's action */
  guidance: PurchaseGuidance | null;
};

// ─────────────────────────────────────────────
// State: read + seed
// ─────────────────────────────────────────────

/**
 * Read the companion_state row for a user, creating an empty one on first
 * access. Never throws — on any error returns a synthetic "fresh" state so the
 * client still renders (welcome will show, which is the safe default for a new
 * user). The synthetic state is NOT persisted; the next successful call seeds it.
 */
export async function getCompanionState(
  supabase: SupabaseClient,
  userId: string
): Promise<CompanionState> {
  const { data, error } = await supabase
    .from('companion_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && data) {
    return data as CompanionState;
  }

  // No row yet — seed one. Best-effort; if the insert races or fails we still
  // return a fresh in-memory state.
  if (!error && !data) {
    const { data: inserted } = await supabase
      .from('companion_state')
      .insert({ user_id: userId })
      .select('*')
      .single();
    if (inserted) return inserted as CompanionState;
  }

  const nowIso = new Date().toISOString();
  return {
    user_id: userId,
    welcomed_at: null,
    tour_done_at: null,
    welcome_message: null,
    welcome_message_lang: null,
    visit_count: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export async function markWelcomed(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean }> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('companion_state')
    .upsert(
      { user_id: userId, welcomed_at: nowIso, updated_at: nowIso },
      { onConflict: 'user_id' }
    );
  return { success: !error };
}

export async function markTourDone(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean }> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('companion_state')
    .upsert(
      { user_id: userId, tour_done_at: nowIso, updated_at: nowIso },
      { onConflict: 'user_id' }
    );
  return { success: !error };
}

// ─────────────────────────────────────────────
// Adaptation seed: record a signal (STORAGE ONLY)
// ─────────────────────────────────────────────

/**
 * Append one behavioural signal. For 'visit' signals we also bump the visit
 * counter on companion_state. Pure storage — nothing reads these to make a
 * decision this sprint. Never throws.
 */
export async function recordSignal(
  supabase: SupabaseClient,
  userId: string,
  opts: { signalType: CompanionSignalType; route?: string; payload?: Record<string, unknown> }
): Promise<{ success: boolean }> {
  try {
    await supabase.from('companion_signals').insert({
      user_id: userId,
      signal_type: opts.signalType,
      route: opts.route ?? null,
      payload: opts.payload ?? null,
    });

    if (opts.signalType === 'visit') {
      // Ensure a state row exists, then increment its visit counter. We read
      // then write (no RPC) — exact precision isn't important for a seed.
      const state = await getCompanionState(supabase, userId);
      const nowIso = new Date().toISOString();
      await supabase
        .from('companion_state')
        .upsert(
          { user_id: userId, visit_count: (state.visit_count ?? 0) + 1, updated_at: nowIso },
          { onConflict: 'user_id' }
        );
    }
    return { success: true };
  } catch (e) {
    console.warn('[companion-engine] recordSignal failed (non-fatal):', e);
    return { success: false };
  }
}

// ─────────────────────────────────────────────
// Welcome line — generated once, free (no token deduction)
// ─────────────────────────────────────────────

/**
 * Generate (or return the cached) one-line welcome for the user.
 *
 * Cost model: the welcome is a courtesy — it is FREE. We never deduct tokens
 * (so the Bowling Lane Rule is trivially satisfied: there is no charge to
 * refund). We DO run the Output Guard before persisting, and we DO append the
 * Sprint 8 JSON directive so Haiku returns parseable JSON.
 *
 * Caching: the line is cached in companion_state.welcome_message. If the user
 * switches their primary language, welcome_message_lang won't match the
 * requested language and we regenerate once in the new language.
 *
 * Returns the message string, or null if generation failed (the client then
 * falls back to its template-only welcome — the welcome moment NEVER blocks on
 * this call).
 */
export async function generateWelcome(
  supabase: SupabaseClient,
  userId: string,
  language: Language = 'ar'
): Promise<{ message: string | null }> {
  // Return cache if present and in the right language.
  const state = await getCompanionState(supabase, userId);
  if (state.welcome_message && state.welcome_message_lang === language) {
    return { message: state.welcome_message };
  }

  const profile = await getCareerProfile(supabase, userId);
  if (!profile) return { message: null };

  // First name from profiles.full_name (fallback handled client-side too).
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  const fullName = (profileRow as { full_name?: string | null } | null)?.full_name?.trim() ?? '';
  const firstName = fullName ? fullName.split(/\s+/)[0]! : (language === 'ar' ? 'صديقي' : 'there');

  let message: string | null = null;
  try {
    // Sprint 8 JSON directive — the compiled system prompt describes voice but
    // never tells the model to OUTPUT JSON; append the schema so extractJson works.
    const systemWithSchema =
      companionWelcomePrompt.system +
      '\n\n---\nReturn a single JSON object matching this exact TypeScript type, with no prose, no markdown fences, and no preamble:\n\n' +
      companionWelcomePrompt.schema;

    const resp = await callClaude({
      task: 'post_generate', // Haiku tier — same speed/cost as the next-task call
      modelOverride: 'claude-haiku-4-5-20251001',
      system: systemWithSchema,
      userContent: companionWelcomePrompt.user({
        first_name: firstName,
        goal: profile.goal,
        target_role: profile.target_role,
        level: profile.level,
        industry: profile.industry,
        language,
      }),
      maxTokens: 200,
      temperature: 0.6,
    });
    const txt = extractText(resp);

    // Output Guard: block banned vendor / model names + Eastern Arabic digits.
    const validation = validateOutput(txt, 'companion.welcome');
    if (!validation.valid) {
      console.warn('[companion-engine] welcome blocked by output guard:', validation.reason);
      return { message: null };
    }

    const parsed = extractJson<{ message?: string }>(txt);
    const candidate = parsed?.message?.trim();
    if (candidate) message = candidate;
  } catch (e) {
    console.warn('[companion-engine] generateWelcome Claude call failed (non-fatal):', e);
    return { message: null };
  }

  if (!message) return { message: null };

  // Cache it (best-effort).
  const nowIso = new Date().toISOString();
  await supabase
    .from('companion_state')
    .upsert(
      {
        user_id: userId,
        welcome_message: message,
        welcome_message_lang: language,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' }
    );

  return { message };
}

// ─────────────────────────────────────────────
// Contextual message — reuse Next Task + purchase guidance
// ─────────────────────────────────────────────

/**
 * The companion's standing message. We surface the SAME Next Task the dashboard
 * shows (consistent voice, zero extra model burn), then layer "step-by-step"
 * purchase guidance: if the action the task points at costs more tokens than the
 * user holds, we attach a `guidance` block the client renders as a calm nudge
 * toward the right plan.
 *
 * IMPORTANT — read-only by design: this is called by the floating bubble on
 * EVERY protected page, so it must be cheap. Unlike dashboard-engine's
 * getNextTask (which generates a fresh suggestion when none exists in the
 * language — appropriate for the once-per-load dashboard + the nightly cron),
 * the companion only READS the top active same-language suggestion. It never
 * triggers a Claude call. Generation stays owned by the dashboard/cron path; if
 * there's nothing to show, the bubble simply stays quiet (badge-less).
 *
 * Returns task=null with guidance=null when there's no active suggestion. Never
 * throws.
 */
export async function getCompanionMessage(
  supabase: SupabaseClient,
  userId: string,
  language: Language = 'ar'
): Promise<CompanionMessage> {
  let task: AiSuggestionRow | null = null;
  try {
    // Read-only: top active suggestion in the user's language. No generation.
    const { data } = await supabase
      .from('ai_suggestions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('language', language)
      .order('priority_score', { ascending: false, nullsFirst: false })
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);
    task = (data && data.length > 0 ? data[0] : null) as AiSuggestionRow | null;
  } catch (e) {
    console.warn('[companion-engine] getCompanionMessage read failed:', e);
    task = null;
  }

  if (!task) return { task: null, guidance: null };

  const pillar = task.pillar;
  const needed = pillar ? COST_BY_PILLAR[pillar] : undefined;
  if (!pillar || !needed) {
    // Profile/wallet tasks (or unknown) cost nothing → no purchase guidance.
    return { task, guidance: null };
  }

  let balance = 0;
  try {
    balance = (await getWallets(supabase, userId)).total;
  } catch {
    balance = 0;
  }

  if (balance >= needed) {
    return { task, guidance: null };
  }

  const guidance: PurchaseGuidance = {
    needed,
    balance,
    shortfall: Math.max(1, needed - balance),
    pillar: pillar as 'radar' | 'resume' | 'content',
    cta_url: '/v2/pricing',
  };
  return { task, guidance };
}
