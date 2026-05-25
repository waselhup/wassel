import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc-init';
import { hassan } from '../agents/hassan';

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  return next({ ctx });
});

export const hassanRouter = router({
  draftHotUpgradePitches: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).optional(),
      minPropensity: z.number().min(0).max(1).optional(),
    }).optional())
    .mutation(async ({ input }) => hassan.draftHotUpgradePitches(input)),

  draftPitchForUser: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      trigger: z.string().min(1).max(100),
      surface: z.string().min(1).max(50),
      experimentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input }) => hassan.draftPitchForUser(input)),

  listPendingPitches: adminProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('upgrade_pitches')
      .select('*, profiles(full_name, email, plan)')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .limit(100);
    return data || [];
  }),

  approvePitch: adminProcedure
    .input(z.object({ pitchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('upgrade_pitches').update({ status: 'approved' }).eq('id', input.pitchId);
      return { ok: true };
    }),

  rejectPitch: adminProcedure
    .input(z.object({ pitchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('upgrade_pitches').update({ status: 'rejected' }).eq('id', input.pitchId);
      return { ok: true };
    }),

  listExperiments: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('ab_experiments').select('*').order('created_at', { ascending: false }).limit(100);
      if (input?.status) q = q.eq('status', input.status);
      const { data } = await q;
      return data || [];
    }),

  proposeExperiment: adminProcedure
    .input(z.object({ surface: z.string().min(1), hypothesis: z.string().min(5).max(2000) }))
    .mutation(async ({ input }) => hassan.proposeExperiment(input)),

  startExperiment: adminProcedure
    .input(z.object({ experimentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('ab_experiments').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', input.experimentId);
      return { ok: true };
    }),

  killExperiment: adminProcedure
    .input(z.object({ experimentId: z.string().uuid(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('ab_experiments').update({
        status: 'killed', ended_at: new Date().toISOString(), results: { killed_reason: input.reason || 'manual' },
      }).eq('id', input.experimentId);
      return { ok: true };
    }),

  hotLeads: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('user_health_scores')
        .select('*, profiles(full_name, email, plan, token_balance)')
        .gte('upgrade_propensity', 0.5)
        .order('upgrade_propensity', { ascending: false })
        .limit(input?.limit ?? 20);
      return data || [];
    }),

  referralCodes: adminProcedure
    .input(z.object({ userId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase.from('referral_codes').select('*').order('created_at', { ascending: false }).limit(200);
      if (input?.userId) q = q.eq('owner_user_id', input.userId);
      const { data } = await q;
      return data || [];
    }),

  createReferralCode: protectedProcedure
    .input(z.object({
      userId: z.string().uuid().optional(),
      rewardInviter: z.number().int().min(0).max(10000).optional(),
      rewardInvitee: z.number().int().min(0).max(10000).optional(),
      maxUses: z.number().int().min(1).max(100000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = input.userId || ctx.user.id;
      return hassan.generateReferralCode(userId, input);
    }),

  redeemReferralCode: publicProcedure
    .input(z.object({ code: z.string().min(1).max(40), inviteeUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: code } = await ctx.supabase
        .from('referral_codes')
        .select('*')
        .eq('code', input.code)
        .eq('active', true)
        .maybeSingle();
      if (!code) throw new TRPCError({ code: 'NOT_FOUND', message: 'Code not found' });
      if (code.expires_at && new Date(code.expires_at) < new Date()) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Code expired' });
      }
      if (code.max_uses && code.uses_count >= code.max_uses) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Code exhausted' });
      }
      const { error: redeemErr } = await ctx.supabase.from('referral_redemptions').insert({
        code_id: code.id,
        invitee_user_id: input.inviteeUserId,
      });
      if (redeemErr) throw new TRPCError({ code: 'CONFLICT', message: redeemErr.message });
      await ctx.supabase.from('referral_codes').update({ uses_count: (code.uses_count || 0) + 1 }).eq('id', code.id);
      return { ok: true, rewardTokensInvitee: code.reward_tokens_invitee, rewardTokensInviter: code.reward_tokens_inviter };
    }),

  servePitch: protectedProcedure
    .input(z.object({ surface: z.string() }))
    .query(async ({ ctx, input }) => hassan.servePitch(ctx.user.id, input.surface)),

  recordPitchClick: protectedProcedure
    .input(z.object({ pitchId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await hassan.recordPitchClick(input.pitchId);
      return { ok: true };
    }),

  recordConversion: adminProcedure
    .input(z.object({ userId: z.string().uuid(), amountSar: z.number().min(0), pitchId: z.string().uuid().optional() }))
    .mutation(async ({ input }) => {
      await hassan.recordConversion(input);
      return { ok: true };
    }),
});
