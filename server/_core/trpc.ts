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
import { documentRouter } from './routes/document';
import { pricingRouter } from './routes/pricing';
import { financeRouter } from './routes/finance';
import { farisRouter } from './routes/faris';
import { sayedRouter } from './routes/sayed';
import { alMukhadramRouter } from './routes/al-mukhadram';
import { hassanRouter } from './routes/hassan';
import { fatimaRouter } from './routes/fatima';
import { dhaiRouter } from './routes/dhai';
import { husseinRouter } from './routes/hussein';
import { mohammedRouter } from './routes/mohammed';
import { careerProfileRouter } from './routes/career-profile';
import { warRoomRouter } from './routes/war-room';
import { radarRouter } from './routes/radar';
import { resumeRouter } from './routes/resume';

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
  document: documentRouter,
  pricing: pricingRouter,
  finance: financeRouter,
  faris: farisRouter,
  sayed: sayedRouter,
  alMukhadram: alMukhadramRouter,
  hassan: hassanRouter,
  fatima: fatimaRouter,
  dhai: dhaiRouter,
  hussein: husseinRouter,
  mohammed: mohammedRouter,
  careerProfile: careerProfileRouter,
  warRoom: warRoomRouter,
  radar: radarRouter,
  resume: resumeRouter,
});

export type AppRouter = typeof appRouter;
