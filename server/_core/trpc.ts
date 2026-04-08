import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import { z } from 'zod';
import { linkedinRouter } from './routes/linkedin';
import { cvRouter } from './routes/cv';
import { campaignRouter } from './routes/campaign';
import { tokenRouter } from './routes/tokens';
import { adminRouter } from './routes/admin';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

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
});

export type AppRouter = typeof appRouter;