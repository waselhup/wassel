import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { mohammed } from '../agents/mohammed';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

export const mohammedRouter = router({
  reconcileMoyasarDaily: adminProcedure.mutation(async () => mohammed.reconcileMoyasarDaily()),

  generateInvoice: adminProcedure
    .input(z.object({ paymentTransactionId: z.string().uuid() }))
    .mutation(async ({ input }) => mohammed.generateZatcaInvoice(input.paymentTransactionId)),

  listInvoices: adminProcedure
    .input(z.object({
      status: z.string().optional(),
      userId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('zatca_invoices').select('*, profiles(full_name, email)').order('issue_date', { ascending: false }).limit(input?.limit ?? 100);
      if (input?.status) q = q.eq('status', input.status);
      if (input?.userId) q = q.eq('user_id', input.userId);
      const { data } = await q;
      return data || [];
    }),

  myInvoices: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('zatca_invoices')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('issue_date', { ascending: false });
    return data || [];
  }),

  dailySnapshot: adminProcedure.mutation(async () => mohammed.computeFinanceSnapshot()),

  financeKpis: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('finance_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(input?.days ?? 30);
      return data || [];
    }),

  predictRunway: adminProcedure.mutation(async () => mohammed.predictRunway()),

  marginAlerts: adminProcedure.mutation(async () => mohammed.flagMarginIssues()),

  weeklyReport: adminProcedure.mutation(async () => mohammed.weeklyFinanceReport()),
});
