import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { hussein } from '../agents/hussein';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

export const husseinRouter = router({
  listKnownPatterns: adminProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('known_error_patterns')
      .select('*')
      .order('occurrences_count', { ascending: false });
    return data || [];
  }),

  seedDefaultPatterns: adminProcedure.mutation(async () => hussein.seedKnownErrorPatterns()),

  autoResolveErrors: adminProcedure.mutation(async () => hussein.autoResolveKnownErrors()),

  servicesHealthCheck: adminProcedure.mutation(async () => hussein.checkServicesHealth()),

  recentResolutions: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('known_error_patterns')
        .select('*')
        .order('last_seen', { ascending: false })
        .limit(input?.limit ?? 20);
      return data || [];
    }),

  createIncident: adminProcedure
    .input(z.object({
      error: z.string().min(1).max(2000),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      service: z.string().optional(),
    }))
    .mutation(async ({ input }) => hussein.createIncidentFromError(input)),
});
