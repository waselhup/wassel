import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import {
  runRadar,
  applyIncludedFix,
  revertAppliedFix,
  checkRefreshTriggers,
  markTriggerActedUpon,
  preflight,
  RadarError,
  RADAR_COST,
  type RadarResult,
} from '../lib/radar-engine';
import {
  createSectionOverride,
  deleteSectionOverride,
  logActivity,
} from '../lib/career-profile';

/**
 * Radar v2 tRPC router — 10 endpoints.
 *
 * Read-side: preflight, getCached, history, refreshTriggers
 * Write-side: run, applyFix, revertFix, markTriggerActedUpon,
 *             sessionOverride, clearOverride
 */

const LANGUAGE = z.enum(['ar', 'en']);

function radarErrorToTrpc(err: unknown): TRPCError {
  if (err instanceof RadarError) {
    const codeMap: Record<RadarError['code'], TRPCError['code']> = {
      NO_CAREER_PROFILE: 'PRECONDITION_FAILED',
      NO_LINKEDIN_URL: 'PRECONDITION_FAILED',
      LINKEDIN_NOT_FOUND: 'NOT_FOUND',
      INSUFFICIENT_TOKENS: 'FORBIDDEN',
      MODEL_FAILED: 'INTERNAL_SERVER_ERROR',
      INTERNAL: 'INTERNAL_SERVER_ERROR',
    };
    return new TRPCError({
      code: codeMap[err.code] ?? 'INTERNAL_SERVER_ERROR',
      message: err.message,
      cause: err,
    });
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'Unknown error',
  });
}

export const radarRouter = router({
  /**
   * Pre-flight — everything the /v2/analyze entry page needs.
   * Reads career_profile (R02 — never re-ask) + latest cached analysis +
   * any pending refresh triggers.
   */
  preflight: protectedProcedure.query(async ({ ctx }) => {
    try {
      const pre = await preflight(ctx.supabase, ctx.user.id);
      return pre;
    } catch (err) {
      throw radarErrorToTrpc(err);
    }
  }),

  /**
   * Main analysis. R03 — tokens only on success, refunded on failure.
   * R09 — cache hit by (user, target_role, profile_hash, language) = 0 tokens.
   */
  run: protectedProcedure
    .input(z.object({
      overrideTargetRole: z.string().trim().min(1).max(120).optional(),
      language: LANGUAGE.optional(),
      forceRefresh: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await runRadar(ctx.supabase, {
          userId: ctx.user.id,
          language: input.language ?? 'ar',
          overrideTargetRole: input.overrideTargetRole,
          forceRefresh: input.forceRefresh,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'radar.run', out.cacheId, {
          target_role: out.result.meta.target_role,
          is_cache_hit: out.isCacheHit,
          tokens_charged: out.tokensCharged,
          wallet_used: out.walletUsed,
          current_score: out.result.meta.current_score,
          target_score: out.result.meta.target_score,
        });
        return {
          cacheId: out.cacheId,
          analysisId: out.analysisId,
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
          walletUsed: out.walletUsed,
          result: out.result,
        };
      } catch (err) {
        throw radarErrorToTrpc(err);
      }
    }),

  /**
   * Fetch a stored Radar result by cacheId (or the user's latest one
   * when cacheId is omitted). Used by the AnalyzeResult page on direct
   * link / refresh.
   */
  getCached: protectedProcedure
    .input(z.object({ cacheId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cacheId = input?.cacheId;
      let query = ctx.supabase
        .from('radar_cache')
        .select('id, user_id, target_role, profile_hash, language, result, current_score, target_score, source_linkedin_url, hit_count, created_at, last_accessed_at')
        .eq('user_id', ctx.user.id);

      if (cacheId) query = query.eq('id', cacheId);
      else query = query.order('created_at', { ascending: false }).limit(1);

      const { data, error } = await query.maybeSingle();
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No cached Radar result.' });
      }
      return {
        cacheId: data.id,
        targetRole: data.target_role,
        language: data.language,
        result: data.result as RadarResult,
        currentScore: data.current_score,
        targetScore: data.target_score,
        sourceLinkedinUrl: data.source_linkedin_url,
        hitCount: data.hit_count,
        createdAt: data.created_at,
        lastAccessedAt: data.last_accessed_at,
      };
    }),

  /**
   * Past Radar runs (cache hits + new analyses), newest first.
   */
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().positive().max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const { data, error } = await ctx.supabase
        .from('radar_analyses')
        .select('id, cache_id, target_role, is_cache_hit, tokens_charged, wallet_used, current_score, target_score, language, duration_ms, created_at')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      return { analyses: data ?? [] };
    }),

  /**
   * Apply an Included Fix. R10 — Included Fixes inside a Radar result
   * cost 0 tokens. Sprint 3 records the choice; Sprint 4 will mutate
   * LinkedIn via API where allowed.
   */
  applyFix: protectedProcedure
    .input(z.object({
      cacheId: z.string().uuid(),
      fixIndex: z.number().int().min(0).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await applyIncludedFix(ctx.supabase, {
          userId: ctx.user.id,
          cacheId: input.cacheId,
          fixIndex: input.fixIndex,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'radar.fix_applied', input.cacheId, {
          fix_index: input.fixIndex,
        });
        return out;
      } catch (err) {
        throw radarErrorToTrpc(err);
      }
    }),

  /**
   * Revert a previously applied Included Fix.
   */
  revertFix: protectedProcedure
    .input(z.object({ appliedFixId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await revertAppliedFix(ctx.supabase, {
          userId: ctx.user.id,
          appliedFixId: input.appliedFixId,
        });
      } catch (err) {
        throw radarErrorToTrpc(err);
      }
    }),

  /**
   * Refresh triggers — what's nudging the user to re-run the Radar.
   * Returns implicit triggers (computed from profile state) plus any
   * persisted ones the system inserted.
   */
  refreshTriggers: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await checkRefreshTriggers(ctx.supabase, ctx.user.id);
    } catch (err) {
      throw radarErrorToTrpc(err);
    }
  }),

  /**
   * Mark a persisted trigger as acted-upon (so we stop nudging on it).
   */
  markTriggerActedUpon: protectedProcedure
    .input(z.object({ triggerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await markTriggerActedUpon(ctx.supabase, {
          userId: ctx.user.id,
          triggerId: input.triggerId,
        });
      } catch (err) {
        throw radarErrorToTrpc(err);
      }
    }),

  /**
   * "Try the Radar as if my target role were X for this session only."
   * Writes a 24-hour section_overrides row (R02 — never overwrite the
   * canonical career_profile).
   */
  sessionOverride: protectedProcedure
    .input(z.object({
      targetRole: z.string().trim().min(1).max(120),
      expiresInHours: z.number().int().positive().max(168).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const out = await createSectionOverride(
        ctx.supabase,
        ctx.user.id,
        'radar',
        { target_role: input.targetRole },
        input.expiresInHours ?? 24,
      );
      if (!out.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: out.message ?? 'Failed to create override.',
        });
      }
      return { override: out.override };
    }),

  /**
   * Remove an active override (the user is done experimenting).
   */
  clearOverride: protectedProcedure
    .input(z.object({ overrideId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const out = await deleteSectionOverride(ctx.supabase, ctx.user.id, input.overrideId);
      if (!out.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: out.message ?? 'Failed to clear override.',
        });
      }
      return { success: true };
    }),
});

export type RadarRouter = typeof radarRouter;
export const RADAR_COST_EXPORTED = RADAR_COST;
