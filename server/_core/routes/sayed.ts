import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { sayed } from '../agents/sayed';
import { fetchRssItems } from '../lib/rss-reader';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

const PLATFORMS = ['snapchat', 'linkedin', 'instagram', 'tiktok', 'twitter', 'whatsapp', 'blog', 'email'] as const;
const AD_CHANNELS = ['snapchat', 'linkedin', 'google', 'tiktok', 'instagram', 'meta'] as const;

export const sayedRouter = router({
  generateMonthlyBatch: adminProcedure
    .input(z.object({
      platforms: z.array(z.enum(PLATFORMS)).min(1).max(8),
      themes: z.array(z.string()).optional(),
      postsPerPlatform: z.number().int().min(1).max(30).optional(),
    }))
    .mutation(async ({ input }) => {
      return sayed.generateMonthlyContentBatch({
        platforms: input.platforms,
        themes: input.themes,
        postsPerPlatform: input.postsPerPlatform,
      });
    }),

  draftSinglePost: adminProcedure
    .input(z.object({
      platform: z.enum(PLATFORMS),
      topic: z.string().min(2).max(500),
      sourceUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => sayed.draftSinglePost(input)),

  draftAdCampaign: adminProcedure
    .input(z.object({
      channel: z.enum(AD_CHANNELS),
      objective: z.string().min(3).max(500),
      dailyBudgetSar: z.number().min(1).max(100000),
      targetAudience: z.string().min(3).max(1000),
    }))
    .mutation(async ({ input }) => sayed.draftAdCampaign(input)),

  listContentCalendar: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      platform: z.enum(PLATFORMS).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase
        .from('content_calendar')
        .select('*')
        .order('scheduled_at', { ascending: true })
        .limit(500);
      if (input?.startDate) q = q.gte('scheduled_at', input.startDate);
      if (input?.endDate) q = q.lte('scheduled_at', input.endDate);
      if (input?.platform) q = q.eq('platform', input.platform);
      const { data } = await q;
      return { items: data || [] };
    }),

  listAdCampaigns: adminProcedure
    .input(z.object({
      status: z.enum(['draft', 'awaiting_approval', 'active', 'paused', 'completed', 'killed']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase
        .from('ad_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (input?.status) q = q.eq('status', input.status);
      const { data } = await q;
      return { campaigns: data || [] };
    }),

  publishApprovedContent: adminProcedure
    .input(z.object({ contentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: item } = await ctx.supabase
        .from('content_calendar')
        .select('*')
        .eq('id', input.contentId)
        .single();
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
      if (item.status !== 'approved') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Content not approved' });
      }
      // TODO Batch 2: real Snap/LinkedIn/Instagram API publish.
      await ctx.supabase
        .from('content_calendar')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_url: `https://wasselhub.com/preview/${item.id}`,
        })
        .eq('id', input.contentId);
      return { success: true, note: 'Would publish to ' + item.platform + ' (Batch 2 wires real API).' };
    }),

  killCampaign: adminProcedure
    .input(z.object({ campaignId: z.string().uuid(), reason: z.string().min(2).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('ad_campaigns')
        .update({
          status: 'killed',
          ended_at: new Date().toISOString(),
          config: { kill_reason: input.reason },
        })
        .eq('id', input.campaignId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  repurposeFromRss: adminProcedure
    .input(z.object({ feedUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      const items = await fetchRssItems(input.feedUrl, 5);
      let created = 0;
      for (const item of items) {
        await sayed.draftSinglePost({ platform: 'linkedin', topic: item.title, sourceUrl: item.link });
        await sayed.draftSinglePost({ platform: 'twitter', topic: item.title, sourceUrl: item.link });
        await sayed.draftSinglePost({ platform: 'snapchat', topic: item.title, sourceUrl: item.link });
        created += 3;
      }
      return { itemsRead: items.length, tasksQueued: created };
    }),
});
