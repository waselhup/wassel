import { router, protectedProcedure } from '../_core/trpc';
import { supabase } from '../supabase';
import { getUserTeamId } from '../db';
import { z } from 'zod';
import { getPlan, getUsagePercentage, getRemainingLeads, PlanType } from '../../shared/plans';

/**
 * Billing router for usage tracking and plan management
 * Phase 4: Monetization Layer
 */
export const billingRouter = router({
  /**
   * Get current plan and usage for user's team
   */
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      return {
        plan: 'starter',
        usedLeads: 0,
        monthlyLimit: 100,
        percentageUsed: 0,
        remainingLeads: 100,
      };
    }

    try {
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        return {
          plan: 'starter',
          usedLeads: 0,
          monthlyLimit: 100,
          percentageUsed: 0,
          remainingLeads: 100,
        };
      }

      // Get team's current plan (stored in teams table or default to starter)
      const { data: team } = await supabase
        .from('teams')
        .select('plan')
        .eq('id', teamId)
        .single();

      const planId = (team?.plan as PlanType) || 'starter';
      const plan = getPlan(planId);

      // Count leads added this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('team_id', teamId)
        .gte('created_at', monthStart);

      const usedLeads = leads?.length || 0;
      const percentageUsed = getUsagePercentage(usedLeads, plan);
      const remainingLeads = getRemainingLeads(usedLeads, plan);

      return {
        plan: planId,
        usedLeads,
        monthlyLimit: plan.monthlyLeadLimit,
        percentageUsed,
        remainingLeads,
      };
    } catch (error) {
      console.error('[Wassel] BILLING_USAGE_01 - Failed to get usage:', error);
      return {
        plan: 'starter',
        usedLeads: 0,
        monthlyLimit: 100,
        percentageUsed: 0,
        remainingLeads: 100,
      };
    }
  }),

  /**
   * Check if user can add more leads
   */
  canAddLead: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return false;

    try {
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) return false;

      // Get team's plan
      const { data: team } = await supabase
        .from('teams')
        .select('plan')
        .eq('id', teamId)
        .single();

      const planId = (team?.plan as PlanType) || 'starter';
      const plan = getPlan(planId);

      // Count leads this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('team_id', teamId)
        .gte('created_at', monthStart);

      const usedLeads = leads?.length || 0;

      return usedLeads < plan.monthlyLeadLimit;
    } catch (error) {
      console.error('[Wassel] BILLING_CHECK_01 - Failed to check lead limit:', error);
      return true; // Fail open - allow adding if check fails
    }
  }),

  /**
   * Get all available plans
   */
  getPlans: protectedProcedure.query(async () => {
    return {
      starter: {
        id: 'starter',
        nameAr: 'المبتدئ',
        monthlyLeadLimit: 100,
        maxCampaigns: 3,
        priceAr: 'مجاني',
        features: ['حتى 100 عميل شهرياً', '3 حملات', 'تحليلات أساسية'],
      },
      pro: {
        id: 'pro',
        nameAr: 'احترافي',
        monthlyLeadLimit: 500,
        maxCampaigns: 10,
        priceAr: '99 ر.س/شهر',
        features: ['حتى 500 عميل شهرياً', '10 حملات', 'تحليلات متقدمة'],
      },
      agency: {
        id: 'agency',
        nameAr: 'وكالة',
        monthlyLeadLimit: 5000,
        maxCampaigns: 100,
        priceAr: '499 ر.س/شهر',
        features: ['حتى 5000 عميل شهرياً', 'حملات غير محدودة', 'دعم 24/7'],
      },
    };
  }),

  /**
   * Request upgrade (logs request for founder follow-up)
   */
  requestUpgrade: protectedProcedure
    .input(z.object({ targetPlan: z.enum(['pro', 'agency']) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('المستخدم غير مصرح');
      }

      try {
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) {
          throw new Error('لم يتم العثور على فريق');
        }

        // Log upgrade request (for founder to follow up manually)
        console.log(
          `[Wassel] UPGRADE_REQUEST - User ${ctx.user.id} requested upgrade to ${input.targetPlan}`
        );

        return {
          success: true,
          message: 'تم استقبال طلبك. سيتواصل معك فريقنا قريباً.',
          messageEn: 'Your upgrade request has been received. Our team will contact you soon.',
        };
      } catch (error) {
        console.error('[Wassel] UPGRADE_REQUEST_01 - Failed to request upgrade:', error);
        throw error;
      }
    }),
});
