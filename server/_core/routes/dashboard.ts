import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import {
  getCareerPulse,
  getNextTask,
  listSuggestions,
  generateSuggestions,
  dismissSuggestion,
  acknowledgeSuggestion,
  getActivityFeed,
  getDrafts,
  getSufficesFor,
  markVisited,
  logActivity,
  type DashboardPillar,
} from '../lib/dashboard-engine';
import {
  getCompanionState,
  markWelcomed,
  markTourDone,
  recordSignal,
  generateWelcome,
  getCompanionMessage,
} from '../lib/companion-engine';

/**
 * Dashboard v2 tRPC router — 11 endpoints.
 *
 * Read-side: getCareerPulse, getNextTask, getAllSuggestions, getActivityFeed,
 *            getDrafts, getSufficesFor
 * Write-side: dismissSuggestion, acknowledgeSuggestion, regenerateSuggestions,
 *             markVisited, logActivity
 *
 * Every endpoint is protectedProcedure (auth required).
 * logActivity is a write-side public utility used by the client-side activity
 * interceptor — it never trusts the input action; it accepts it as a structured
 * label and stores it for read-back.
 */

const LANGUAGE = z.enum(['ar', 'en']);
const PILLAR = z.enum(['onboarding', 'radar', 'resume', 'content', 'profile', 'wallet', 'dashboard', 'system']);

// Throttle regenerateSuggestions to once per 24h per user
async function lastSuggestionWithinHours(
  supabase: ReturnType<typeof Object>,
  userId: string,
  hours: number
): Promise<boolean> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { count } = await (supabase as any)
    .from('ai_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  return (count ?? 0) > 0;
}

export const dashboardRouter = router({
  getCareerPulse: protectedProcedure
    .input(z.object({ language: LANGUAGE.optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        return await getCareerPulse(ctx.supabase, ctx.user.id, input?.language ?? 'ar');
      } catch (e) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: e instanceof Error ? e.message : 'getCareerPulse failed',
        });
      }
    }),

  getNextTask: protectedProcedure
    .input(z.object({ language: LANGUAGE.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const task = await getNextTask(ctx.supabase, ctx.user.id, input?.language ?? 'ar');
      return { task };
    }),

  getAllSuggestions: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['active', 'dismissed', 'acted_upon', 'expired', 'all']).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const suggestions = await listSuggestions(ctx.supabase, ctx.user.id, input ?? {});
      return { suggestions };
    }),

  dismissSuggestion: protectedProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return await dismissSuggestion(ctx.supabase, ctx.user.id, input.suggestionId);
    }),

  acknowledgeSuggestion: protectedProcedure
    .input(z.object({ suggestionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return await acknowledgeSuggestion(ctx.supabase, ctx.user.id, input.suggestionId);
    }),

  getActivityFeed: protectedProcedure
    .input(
      z
        .object({
          pillar: PILLAR.optional(),
          days: z.number().int().min(1).max(90).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const entries = await getActivityFeed(ctx.supabase, ctx.user.id, {
        pillar: input?.pillar as DashboardPillar | undefined,
        days: input?.days,
        limit: input?.limit,
      });
      return { entries };
    }),

  getDrafts: protectedProcedure.query(async ({ ctx }) => {
    return await getDrafts(ctx.supabase, ctx.user.id);
  }),

  getSufficesFor: protectedProcedure.query(async ({ ctx }) => {
    return await getSufficesFor(ctx.supabase, ctx.user.id);
  }),

  regenerateSuggestions: protectedProcedure
    .input(z.object({ language: LANGUAGE.optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const recent = await lastSuggestionWithinHours(ctx.supabase, ctx.user.id, 24);
      if (recent) {
        return {
          generated: 0,
          throttled: true,
          message: 'Already regenerated in the last 24 hours.',
        };
      }
      const result = await generateSuggestions(ctx.supabase, ctx.user.id, input?.language ?? 'ar');
      return { ...result, throttled: false };
    }),

  markVisited: protectedProcedure.mutation(async ({ ctx }) => {
    return await markVisited(ctx.supabase, ctx.user.id);
  }),

  logActivity: protectedProcedure
    .input(
      z.object({
        action: z.string().min(1).max(100),
        pillar: PILLAR.optional(),
        target: z.string().max(200).optional(),
        payload: z.record(z.unknown()).optional(),
        relatedResourceType: z.string().max(60).optional(),
        relatedResourceId: z.string().uuid().optional(),
        tokensCharged: z.number().int().min(0).optional(),
        language: LANGUAGE.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await logActivity(ctx.supabase, {
        userId: ctx.user.id,
        action: input.action,
        pillar: input.pillar as DashboardPillar | undefined,
        target: input.target,
        payload: input.payload,
        relatedResourceType: input.relatedResourceType,
        relatedResourceId: input.relatedResourceId,
        tokensCharged: input.tokensCharged,
        language: input.language,
      });
      return { success: true };
    }),

  // ───────────────────────────────────────────
  // Companion — the in-app career companion (Phase 1).
  // Additive nested router; reuses the dashboard engine + companion engine.
  // ───────────────────────────────────────────
  companion: router({
    // Lifecycle flags (welcome / tour) + visit counter. Seeds the row on first read.
    getState: protectedProcedure.query(async ({ ctx }) => {
      return await getCompanionState(ctx.supabase, ctx.user.id);
    }),

    // The one smart welcome line (free, generated once, cached). The client
    // shows its template welcome immediately and only enriches with this if it
    // resolves — generation never blocks the welcome moment.
    getWelcome: protectedProcedure
      .input(z.object({ language: LANGUAGE.optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await generateWelcome(ctx.supabase, ctx.user.id, input?.language ?? 'ar');
      }),

    markWelcomed: protectedProcedure.mutation(async ({ ctx }) => {
      return await markWelcomed(ctx.supabase, ctx.user.id);
    }),

    markTourDone: protectedProcedure.mutation(async ({ ctx }) => {
      return await markTourDone(ctx.supabase, ctx.user.id);
    }),

    // The companion's contextual message: the reused Next Task + optional
    // step-by-step purchase guidance when the wallet can't cover the action.
    getMessage: protectedProcedure
      .input(z.object({ language: LANGUAGE.optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await getCompanionMessage(ctx.supabase, ctx.user.id, input?.language ?? 'ar');
      }),

    // Adaptation seed — store a behavioural signal. Storage only.
    recordSignal: protectedProcedure
      .input(
        z.object({
          signalType: z.enum(['page_view', 'action', 'visit']),
          route: z.string().max(200).optional(),
          payload: z.record(z.unknown()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await recordSignal(ctx.supabase, ctx.user.id, {
          signalType: input.signalType,
          route: input.route,
          payload: input.payload,
        });
      }),
  }),
});
