import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Career Readiness — the unified "how ready am I?" number (P1 Foundation).
 *
 * One honest score that fuses the two signals the user already has:
 *
 *   Readiness = ROUND( radarCurrent × 0.6 + atsCurrent × 0.4 )
 *
 * Inputs (all already persisted — this module reads, never writes):
 *   - radarCurrent = profiles.last_radar_score        (the live Radar score)
 *   - atsCurrent   = the user's ACTIVE resume's ats_score (latest active)
 *   - radarTarget  = radar_cache.target_score          (latest cached target)
 *   - atsTarget    = ATS-target PROXY (see ATS_TARGET_HEADROOM below)
 *
 * Compute-on-read by design: it's two cheap selects, the cron path is fenced
 * (api/cron is off-limits in P1), and a persisted column would drift from the
 * source rows the moment a new radar/resume lands. No new table, no migration.
 *
 * Golden Rule #24 (no fake zeros): when the user hasn't generated a signal we
 * return `null` for that part and a `state` the UI maps to honest copy — never
 * a black "0 / 100".
 */

// ─────────────────────────────────────────────
// Weights + proxy — single source of truth, reused by the point-gain math.
// ─────────────────────────────────────────────

export const RADAR_WEIGHT = 0.6;
export const ATS_WEIGHT = 0.4;

/**
 * ATS target proxy. resume_versions has no stored "target/projected ATS"
 * column (only the achieved `ats_score`), so we project a fixed, honest
 * headroom over the current score and cap at 95 — matching the convention the
 * Radar prompt and the resume engine already use ("projected Target Score,
 * capped 95"). Documented here as the single proxy; change it in one place.
 */
export const ATS_TARGET_HEADROOM = 15;
export const ATS_TARGET_CAP = 95;

function atsTargetProxy(atsCurrent: number): number {
  return Math.min(ATS_TARGET_CAP, atsCurrent + ATS_TARGET_HEADROOM);
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * Which signals the user has. Drives the UI copy:
 *   none        → "لم نقيّم جاهزيتك بعد" + [ابدأ تحليلك الأول]
 *   radar_only  → readiness from radar + "أنشئ سيرتك لإكمال جاهزيتك"
 *   resume_only → readiness from ATS   + "حلّل LinkedIn لإكمال جاهزيتك"
 *   both        → full readiness + target + delta
 */
export type ReadinessState = 'none' | 'radar_only' | 'resume_only' | 'both';

export type ReadinessBreakdown = {
  /** profiles.last_radar_score, or null if no radar yet */
  radar: number | null;
  /** active resume ats_score, or null if no resume yet */
  ats: number | null;
};

export type Readiness = {
  /** The unified current readiness (0..100), or null when no signal exists. */
  readiness: number | null;
  /** The unified target readiness (0..100), or null when no signal exists. */
  target: number | null;
  /** The two components, each null when that signal is missing. */
  breakdown: ReadinessBreakdown;
  /** Which signals are present. */
  state: ReadinessState;
};

// ─────────────────────────────────────────────
// Pure math (exported so the engine + tests can reuse without DB)
// ─────────────────────────────────────────────

/**
 * Fuse a radar score and an ATS score into the unified readiness, honestly
 * handling the cases where one is missing.
 *
 *   both present → ROUND(radar×0.6 + ats×0.4)
 *   radar only   → the radar score (the resume half hasn't been earned yet)
 *   ats only     → the ATS score
 *   neither      → null
 *
 * We deliberately do NOT treat a missing half as 0 — that would punish a user
 * for not having done a step yet (a fake zero). Instead the present signal
 * stands alone and the `state` tells the UI to nudge for the missing half.
 */
export function computeReadiness(
  radar: number | null,
  ats: number | null
): { value: number | null; state: ReadinessState } {
  const hasRadar = radar != null;
  const hasAts = ats != null;

  if (hasRadar && hasAts) {
    return { value: Math.round(radar * RADAR_WEIGHT + ats * ATS_WEIGHT), state: 'both' };
  }
  if (hasRadar) return { value: Math.round(radar), state: 'radar_only' };
  if (hasAts) return { value: Math.round(ats), state: 'resume_only' };
  return { value: null, state: 'none' };
}

/**
 * Fuse the two TARGET signals the same way the current score is fused, so the
 * delta (target − current) is apples-to-apples. Missing halves fall back to
 * the current value's logic via computeReadiness.
 */
export function computeReadinessTarget(
  radarTarget: number | null,
  atsTarget: number | null
): number | null {
  return computeReadiness(radarTarget, atsTarget).value;
}

/**
 * How many unified-readiness points an improvement of `+deltaRadar` radar
 * points and/or `+deltaAts` ATS points would add. Used by the Next Best Action
 * ranking so the dashboard can say "+8 نقاط جاهزية". Always ≥ 0, rounded.
 *
 * Because readiness is linear in its inputs, the gain is just the weighted sum
 * of the per-signal gains — but we clamp each gain so it can't push a signal
 * past 100 (you can't gain points you don't have headroom for).
 */
export function projectedReadinessGain(opts: {
  radarCurrent: number | null;
  atsCurrent: number | null;
  deltaRadar?: number;
  deltaAts?: number;
}): number {
  const { radarCurrent, atsCurrent, deltaRadar = 0, deltaAts = 0 } = opts;

  // Current unified readiness (the baseline we measure the gain against).
  const before = computeReadiness(radarCurrent, atsCurrent).value ?? 0;

  // Apply the deltas to whichever signals exist, capped at 100. If a signal is
  // missing, an action that *creates* it (e.g. "build your first resume")
  // is modelled by the caller passing the new score as the delta with the
  // current treated as 0 for that half.
  const nextRadar =
    radarCurrent == null
      ? (deltaRadar > 0 ? Math.min(100, deltaRadar) : null)
      : Math.min(100, radarCurrent + deltaRadar);
  const nextAts =
    atsCurrent == null
      ? (deltaAts > 0 ? Math.min(100, deltaAts) : null)
      : Math.min(100, atsCurrent + deltaAts);

  const after = computeReadiness(nextRadar, nextAts).value ?? 0;
  return Math.max(0, Math.round(after - before));
}

// ─────────────────────────────────────────────
// DB read
// ─────────────────────────────────────────────

/**
 * Read the inputs and compute the unified readiness for a user. Never throws —
 * on any read failure the affected signal is treated as missing (null), which
 * degrades to the honest empty-state copy rather than a wrong number.
 */
export async function getReadiness(
  supabase: SupabaseClient,
  userId: string
): Promise<Readiness> {
  // Radar current = profiles.last_radar_score (the live score the Radar writes).
  let radarCurrent: number | null = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('last_radar_score')
      .eq('id', userId)
      .maybeSingle();
    const v = (data as { last_radar_score?: number | null } | null)?.last_radar_score;
    radarCurrent = v == null ? null : Number(v);
  } catch {
    radarCurrent = null;
  }

  // Radar target = latest radar_cache.target_score for the user.
  let radarTarget: number | null = null;
  try {
    const { data } = await supabase
      .from('radar_cache')
      .select('target_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    const row = (data ?? [])[0] as { target_score?: number | null } | undefined;
    radarTarget = row?.target_score == null ? null : Number(row.target_score);
  } catch {
    radarTarget = null;
  }

  // ATS current = the latest ACTIVE resume's ats_score.
  let atsCurrent: number | null = null;
  try {
    const { data } = await supabase
      .from('resume_versions')
      .select('ats_score, updated_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1);
    const row = (data ?? [])[0] as { ats_score?: number | null } | undefined;
    atsCurrent = row?.ats_score == null ? null : Number(row.ats_score);
  } catch {
    atsCurrent = null;
  }

  const { value: readiness, state } = computeReadiness(radarCurrent, atsCurrent);

  // Target: only meaningful once at least one signal exists. radarTarget comes
  // from the cache; atsTarget is the documented proxy over atsCurrent.
  const atsTarget = atsCurrent == null ? null : atsTargetProxy(atsCurrent);
  const target = state === 'none' ? null : computeReadinessTarget(radarTarget, atsTarget);

  return {
    readiness,
    target,
    breakdown: { radar: radarCurrent, ats: atsCurrent },
    state,
  };
}
