import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from './trpc-init';
import { linkedinRouter } from './routes/linkedin';
import { cvRouter } from './routes/cv';
import { campaignRouter } from './routes/campaign';
import { tokenRouter } from './routes/tokens';
import { adminRouter } from './routes/admin';
import { reviewsRouter } from './routes/reviews';
import { feedbackRouter } from './routes/feedback';
import { aiFeedbackRouter } from './routes/aiFeedback';
import { agentsRouter } from './routes/agents';
import { companiesRouter } from './routes/companies';
import { executorAgentsRouter } from './routes/executorAgents';
import { analyticsRouter } from './routes/analytics';
import { opsRouter } from './routes/ops';
import { postsRouter } from './routes/posts';

export { router, publicProcedure, protectedProcedure };

export const appRouter = router({
  health: publicProcedure.query(async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }),

  auth: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('*')
        .eq('id', ctx.user.id)
        .single();

      if (error) throw new TRPCError({ code: 'NOT_FOUND' });
      return data;
    }),
  }),

  linkedin: linkedinRouter,
  cv: cvRouter,
  campaign: campaignRouter,
  token: tokenRouter,
  admin: adminRouter,
  reviews: reviewsRouter,
  feedback: feedbackRouter,
  aiFeedback: aiFeedbackRouter,
  agents: agentsRouter,
  companies: companiesRouter,
  executor: executorAgentsRouter,
  analytics: analyticsRouter,
  ops: opsRouter,
  posts: postsRouter,
});

export type AppRouter = typeof appRouter;
