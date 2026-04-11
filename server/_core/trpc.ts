import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from './trpc-init';
import { linkedinRouter } from './routes/linkedin';
import { cvRouter } from './routes/cv';
import { campaignRouter } from './routes/campaign';
import { tokenRouter } from './routes/tokens';
import { adminRouter } from './routes/admin';
import { knowledgeRouter } from './routes/knowledge';

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
  knowledge: knowledgeRouter,
});

export type AppRouter = typeof appRouter;
