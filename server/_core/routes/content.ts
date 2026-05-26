import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import {
  preflightContent,
  generateContent,
  applyContentRefinement,
  archiveContent,
  restoreContent,
  markPublishedExternally,
  setReminder,
  dismissReminder,
  generateTopicSuggestions,
  ContentError,
  CONTENT_POST_COST,
  CONTENT_CAROUSEL_COST,
  CONTENT_REPURPOSE_COST,
  CONTENT_PAID_REFINEMENT_COST,
  CONTENT_FREE_REFINEMENTS_PER_VERSION,
  type Carousel,
  type ContentResult,
} from '../lib/content-engine';
import { exportCarouselToPdf } from '../lib/content-export';
import { logActivity } from '../lib/career-profile';

/**
 * Content v2 tRPC router — 16 endpoints.
 *
 * Read: preflight, listVersions, getVersion, getCached, topicSuggestions, history
 * Write: generatePost, generateCarousel, generateRepurpose, refine, archive,
 *        restore, markPublished, setReminder, dismissReminder, exportCarouselPdf
 *
 * All endpoints are protectedProcedure (user must be authenticated).
 */

const LANGUAGE = z.enum(['ar', 'en']);
const CONTENT_TYPE = z.enum(['post', 'carousel', 'repurpose_bundle']);
const VERSION_STATUS = z.enum(['active', 'archived', 'published_externally', 'legacy', 'all']);

function contentErrorToTrpc(err: unknown): TRPCError {
  if (err instanceof ContentError) {
    const codeMap: Record<ContentError['code'], TRPCError['code']> = {
      NO_CAREER_PROFILE: 'PRECONDITION_FAILED',
      INSUFFICIENT_TOKENS: 'FORBIDDEN',
      MODEL_FAILED: 'INTERNAL_SERVER_ERROR',
      TONE_VIOLATION: 'BAD_REQUEST',
      VERSION_NOT_FOUND: 'NOT_FOUND',
      CACHE_NOT_FOUND: 'NOT_FOUND',
      SOURCE_POST_NOT_FOUND: 'NOT_FOUND',
      LEGACY_READ_ONLY: 'BAD_REQUEST',
      TOPIC_REQUIRED: 'BAD_REQUEST',
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

export const contentRouter = router({
  /**
   * Preflight — what /v2/posts/new/:type needs to render the entry CTA.
   * Reads career_profile + cache state + (if no topic provided) suggestions.
   */
  preflight: protectedProcedure
    .input(z.object({
      contentType: CONTENT_TYPE,
      topic: z.string().trim().min(1).max(500).optional(),
      sourcePostId: z.string().uuid().optional(),
      language: LANGUAGE.optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        return await preflightContent(ctx.supabase, ctx.user.id, {
          contentType: input.contentType,
          topic: input.topic,
          sourcePostId: input.sourcePostId,
          language: input.language ?? 'ar',
        });
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * List versions by type/status — drives Hub recent + archive views.
   */
  listVersions: protectedProcedure
    .input(z.object({
      contentType: CONTENT_TYPE.optional(),
      status: VERSION_STATUS.optional(),
      limit: z.number().int().positive().max(100).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('content_versions')
        .select('id, cache_id, content_type, display_title, topic, status, tokens_charged, wallet_used, language, legacy_source, external_url, archived_at, published_at, created_at, updated_at')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(input?.limit ?? 50);
      if (input?.contentType) {
        query = query.eq('content_type', input.contentType);
      }
      if (input?.status && input.status !== 'all') {
        query = query.eq('status', input.status);
      }
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { versions: data ?? [] };
    }),

  /**
   * Fetch a single version + its cached content (if any).
   */
  getVersion: protectedProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: version, error: vErr } = await ctx.supabase
        .from('content_versions')
        .select('*')
        .eq('id', input.versionId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();
      if (vErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: vErr.message });
      if (!version) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found.' });

      let cache: {
        id: string;
        result: ContentResult;
        content_type: string;
        topic: string;
        source_post_id: string | null;
        created_at: string;
        expires_at: string;
        hit_count: number;
      } | null = null;
      if (version.cache_id) {
        const { data: c } = await ctx.supabase
          .from('content_cache')
          .select('id, result, content_type, topic, source_post_id, created_at, expires_at, hit_count')
          .eq('id', version.cache_id)
          .eq('user_id', ctx.user.id)
          .maybeSingle();
        cache = (c as typeof cache) ?? null;
      }

      const { count: refinementsUsed } = await ctx.supabase
        .from('content_refinements')
        .select('id', { count: 'exact', head: true })
        .eq('version_id', input.versionId);

      // Pending reminder for this version, if any
      const { data: reminder } = await ctx.supabase
        .from('content_reminders')
        .select('id, remind_at, status, notification_channel')
        .eq('user_id', ctx.user.id)
        .eq('version_id', input.versionId)
        .eq('status', 'pending')
        .order('remind_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        version,
        cache,
        refinementsUsed: refinementsUsed ?? 0,
        freeRefinementsPerVersion: CONTENT_FREE_REFINEMENTS_PER_VERSION,
        paidRefinementCost: CONTENT_PAID_REFINEMENT_COST,
        pendingReminder: reminder ?? null,
      };
    }),

  /**
   * Fetch cached content by cacheId.
   */
  getCached: protectedProcedure
    .input(z.object({ cacheId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('content_cache')
        .select('*')
        .eq('id', input.cacheId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cached content not found.' });
      return {
        cacheId: data.id,
        contentType: data.content_type,
        topic: data.topic,
        sourcePostId: data.source_post_id,
        language: data.language,
        result: data.result as ContentResult,
        tokensCharged: data.tokens_charged,
        hitCount: data.hit_count,
        createdAt: data.created_at,
        lastAccessedAt: data.last_accessed_at,
        expiresAt: data.expires_at,
      };
    }),

  /**
   * Generate a Post (5 tokens). R03 + R09 + Bowling Lane Rules.
   */
  generatePost: protectedProcedure
    .input(z.object({
      topic: z.string().trim().min(3).max(500),
      language: LANGUAGE.optional(),
      forceRefresh: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await generateContent(ctx.supabase, {
          userId: ctx.user.id,
          language: input.language ?? 'ar',
          contentType: 'post',
          topic: input.topic,
          forceRefresh: input.forceRefresh,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'content.post', out.cacheId, {
          topic: input.topic.slice(0, 80),
          is_cache_hit: out.isCacheHit,
          tokens_charged: out.tokensCharged,
          wallet_used: out.walletUsed,
        });
        return {
          cacheId: out.cacheId,
          versionId: out.versionId,
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
          walletUsed: out.walletUsed,
          result: out.result,
          toneViolations: out.toneViolations,
        };
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Generate a Carousel (25 tokens).
   */
  generateCarousel: protectedProcedure
    .input(z.object({
      topic: z.string().trim().min(3).max(500),
      language: LANGUAGE.optional(),
      forceRefresh: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await generateContent(ctx.supabase, {
          userId: ctx.user.id,
          language: input.language ?? 'ar',
          contentType: 'carousel',
          topic: input.topic,
          forceRefresh: input.forceRefresh,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'content.carousel', out.cacheId, {
          topic: input.topic.slice(0, 80),
          is_cache_hit: out.isCacheHit,
          tokens_charged: out.tokensCharged,
          wallet_used: out.walletUsed,
        });
        return {
          cacheId: out.cacheId,
          versionId: out.versionId,
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
          walletUsed: out.walletUsed,
          result: out.result,
          toneViolations: out.toneViolations,
        };
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Generate a Repurpose Bundle (15 tokens). Requires sourcePostId.
   */
  generateRepurpose: protectedProcedure
    .input(z.object({
      sourcePostId: z.string().uuid(),
      language: LANGUAGE.optional(),
      forceRefresh: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await generateContent(ctx.supabase, {
          userId: ctx.user.id,
          language: input.language ?? 'ar',
          contentType: 'repurpose_bundle',
          sourcePostId: input.sourcePostId,
          forceRefresh: input.forceRefresh,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'content.repurpose', out.cacheId, {
          source_post_id: input.sourcePostId,
          is_cache_hit: out.isCacheHit,
          tokens_charged: out.tokensCharged,
          wallet_used: out.walletUsed,
        });
        return {
          cacheId: out.cacheId,
          versionId: out.versionId,
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
          walletUsed: out.walletUsed,
          result: out.result,
          toneViolations: out.toneViolations,
        };
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Refinement — first 5 per version are free; subsequent cost 5 tokens.
   */
  refine: protectedProcedure
    .input(z.object({
      versionId: z.string().uuid(),
      chipType: z.string().min(1).max(80),
      customPrompt: z.string().trim().min(1).max(400).optional(),
      language: LANGUAGE.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await applyContentRefinement(ctx.supabase, {
          userId: ctx.user.id,
          language: input.language ?? 'ar',
          versionId: input.versionId,
          chipType: input.chipType,
          customPrompt: input.customPrompt,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'content.refine', input.versionId, {
          chip_type: input.chipType,
          refinement_index: out.refinementIndex,
          tokens_charged: out.tokensCharged,
        });
        return {
          result: out.result,
          tokensCharged: out.tokensCharged,
          refinementIndex: out.refinementIndex,
          isFreeWindow: out.isFreeWindow,
          remainingFree: out.remainingFree,
          cacheId: out.cacheId,
        };
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Archive (Archive First — never delete).
   */
  archive: protectedProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await archiveContent(ctx.supabase, { userId: ctx.user.id, versionId: input.versionId });
        await logActivity(ctx.supabase, ctx.user.id, 'content.archive', input.versionId);
        return out;
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Restore an archived version.
   */
  restore: protectedProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await restoreContent(ctx.supabase, { userId: ctx.user.id, versionId: input.versionId });
        await logActivity(ctx.supabase, ctx.user.id, 'content.restore', input.versionId);
        return out;
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Mark as published externally — user copied & posted on LinkedIn.
   */
  markPublished: protectedProcedure
    .input(z.object({
      versionId: z.string().uuid(),
      externalUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await markPublishedExternally(ctx.supabase, {
          userId: ctx.user.id,
          versionId: input.versionId,
          externalUrl: input.externalUrl,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'content.published', input.versionId, {
          external_url: input.externalUrl ?? null,
        });
        return out;
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Set a smart reminder (A12 V1) — in-app or email nudge at remind_at.
   * NOT scheduled publishing.
   */
  setReminder: protectedProcedure
    .input(z.object({
      versionId: z.string().uuid(),
      remindAt: z.string().datetime(),
      channels: z.array(z.enum(['in_app', 'email'])).min(1).max(2).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await setReminder(ctx.supabase, {
          userId: ctx.user.id,
          versionId: input.versionId,
          remindAt: input.remindAt,
          channels: input.channels,
        });
        await logActivity(ctx.supabase, ctx.user.id, 'content.reminder_set', input.versionId, {
          remind_at: input.remindAt,
        });
        return out;
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Dismiss a pending reminder.
   */
  dismissReminder: protectedProcedure
    .input(z.object({ reminderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await dismissReminder(ctx.supabase, { userId: ctx.user.id, reminderId: input.reminderId });
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * Export carousel as PDF — 0 tokens.
   */
  exportCarouselPdf: protectedProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: version } = await ctx.supabase
        .from('content_versions')
        .select('id, cache_id, content_type, display_title, language')
        .eq('id', input.versionId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();
      if (!version) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found.' });
      if (version.content_type !== 'carousel') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'PDF export is for carousels only.' });
      }
      if (!version.cache_id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This version has no exportable content.' });
      }
      const { data: cache } = await ctx.supabase
        .from('content_cache')
        .select('result')
        .eq('id', version.cache_id)
        .eq('user_id', ctx.user.id)
        .maybeSingle();
      if (!cache) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cached carousel missing.' });

      const bytes = await exportCarouselToPdf(cache.result as Carousel, version.language as 'ar' | 'en');
      const filename = (version.display_title || 'carousel')
        .replace(/[^a-zA-Z0-9\-_ ؀-ۿ]+/g, '_')
        .slice(0, 80) + '.pdf';

      return {
        filename,
        mimeType: 'application/pdf',
        base64: Buffer.from(bytes).toString('base64'),
      };
    }),

  /**
   * Quick Start topic suggestions (cached 24h, 0 tokens).
   * Refreshes the cache when expired.
   */
  topicSuggestions: protectedProcedure
    .input(z.object({ language: LANGUAGE.optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        return await generateTopicSuggestions(ctx.supabase, ctx.user.id, input?.language ?? 'ar');
      } catch (err) {
        throw contentErrorToTrpc(err);
      }
    }),

  /**
   * History — every generation, ordered newest first.
   */
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().positive().max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 30;
      const { data, error } = await ctx.supabase
        .from('content_versions')
        .select('id, content_type, display_title, topic, status, tokens_charged, wallet_used, language, created_at, updated_at')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { versions: data ?? [] };
    }),
});

export type ContentRouter = typeof contentRouter;
export const CONTENT_POST_COST_EXPORTED = CONTENT_POST_COST;
export const CONTENT_CAROUSEL_COST_EXPORTED = CONTENT_CAROUSEL_COST;
export const CONTENT_REPURPOSE_COST_EXPORTED = CONTENT_REPURPOSE_COST;
