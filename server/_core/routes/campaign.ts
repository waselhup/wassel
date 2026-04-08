import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const { data } = await ctx.supabase
        .from('email_campaigns')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      return data || [];
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch campaigns',
      });
    }
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        const { data: campaign } = await ctx.supabase          .from('email_campaigns')
          .select('*')
          .eq('id', input.id)
          .eq('user_id', ctx.user.id)
          .single();

        if (!campaign) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Campaign not found',
          });
        }

        const { data: recipients } = await ctx.supabase
          .from('campaign_recipients')
          .select('*')
          .eq('campaign_id', input.id);

        return { campaign, recipients: recipients || [] };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch campaign',
        });
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        campaignName: z.string().min(1),
        jobTitle: z.string().min(1),
        targetCompanies: z.array(z.string()).min(1),
        recipientCount: z.number().int().positive(),
        language: z.enum(['ar', 'en']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check token balance
        const { data: profile } = await ctx.supabase          .from('profiles')
          .select('token_balance')
          .eq('id', ctx.user.id)
          .single();

        const tokensNeeded = input.recipientCount;
        if (!profile || profile.token_balance < tokensNeeded) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient tokens',
          });
        }

        // Create campaign
        const { data: campaign, error: createError } = await ctx.supabase
          .from('email_campaigns')
          .insert([
            {
              user_id: ctx.user.id,
              name: input.campaignName,
              job_title: input.jobTitle,
              target_companies: input.targetCompanies,
              status: 'draft',
              language: input.language,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        // Mock: Generate recipients from Apify
        const mockRecipients = Array.from({ length: input.recipientCount }).map(
          (_, i) => ({
            campaign_id: campaign.id,
            email: `recipient${i + 1}@company.com`,
            name: `Recipient ${i + 1}`,
            company: input.targetCompanies[0],
            status: 'pending',
          })
        );

        // Deduct tokens
        await ctx.supabase
          .from('profiles')
          .update({ token_balance: (profile.token_balance || 0) - tokensNeeded })
          .eq('id', ctx.user.id);

        // Insert recipients
        if (mockRecipients.length > 0) {
          await ctx.supabase.from('campaign_recipients').insert(mockRecipients);
        }

        return campaign;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create campaign',
        });
      }
    }),
});