import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { supabase } from '../supabase';
import { getUserTeamId } from '../db';
import { randomUUID } from 'crypto';

/**
 * Extension API Router
 * 
 * These procedures are designed to be called from the Chrome Extension.
 * They enforce team isolation and return clean, predictable data contracts.
 * 
 * Data Contracts:
 * - All responses include { success: boolean, data: T, error?: string }
 * - All mutations require team context (derived from auth user)
 * - All queries are scoped to user's team
 */

export const extensionRouter = router({
  // Campaign: list all campaigns for team
  campaignsList: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data } = await supabase
        .from('campaigns')
        .select('id, name, type, status, stats, created_at, updated_at')
        .eq('team_id', teamId as string)
        .order('created_at', { ascending: false });

      return {
        success: true,
        data: data || [],
      };
    }),

  // Campaign: create new campaign
  campaignCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'اسم الحملة مطلوب'),
        type: z.enum(['invitation', 'message', 'sequence']),
        configuration: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          team_id: teamId,
          name: input.name,
          type: input.type,
          configuration: input.configuration || {},
          status: 'draft',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`خطأ في إنشاء الحملة: ${error.message}`);
      }

      return {
        success: true,
        data: data?.[0] || null,
      };
    }),

  // Campaign: get specific campaign
  campaignGet: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', input.campaignId)
        .eq('team_id', teamId as string);

      if (!data) {
        throw new Error('الحملة غير موجودة');
      }

      return {
        success: true,
        data,
      };
    }),

  // Leads: list leads for campaign
  leadsList: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data } = await supabase
        .from('leads')
        .select('id, first_name, last_name, company, headline, linkedin_url, status, created_at')
        .eq('campaign_id', input.campaignId)
        .eq('team_id', teamId as string)
        .order('created_at', { ascending: false });

      return {
        success: true,
        data: data || [],
      };
    }),

  // Leads: add single lead
  leadsAdd: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        linkedin_url: z.string().url(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        company: z.string().optional(),
        headline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      // Verify campaign belongs to team
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id')
        .eq('id', input.campaignId)
        .eq('team_id', teamId as string);

      if (!campaign) {
        throw new Error('الحملة غير موجودة');
      }

      // Insert lead
      const { data: leadArray, error } = await supabase
        .from('leads')
        .insert({
          team_id: teamId,
          campaign_id: input.campaignId,
          linkedin_url: input.linkedin_url,
          first_name: input.first_name || '',
          last_name: input.last_name || '',
          company: input.company || '',
          headline: input.headline || '',
          profile_data: {
            first_name: input.first_name,
            last_name: input.last_name,
            company: input.company,
            headline: input.headline,
          },
          imported_by: ctx.user.id,
          imported_at: new Date().toISOString(),
        })
        .select('id, first_name, last_name, company, linkedin_url, created_at');

      if (error) {
        throw new Error(`خطأ في إضافة العميل: ${error.message}`);
      }

      const lead = leadArray?.[0];
      if (!lead) {
        throw new Error('فشل إنشاء العميل');
      }

      // Create queue item automatically
      await supabase.from('action_queue').insert({
        team_id: teamId,
        campaign_id: input.campaignId,
        lead_id: lead.id,
        action_type: 'invitation',
        status: 'pending',
        requires_approval: true,
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        data: lead,
      };
    }),

  // Queue: list queue items
  queueList: protectedProcedure
    .input(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      let query = supabase
        .from('action_queue')
        .select('id, campaign_id, lead_id, action_type, status, requires_approval, created_at, approved_at')
        .eq('team_id', teamId as string);

      if (input?.status) {
        query = query.eq('status', input.status);
      }

      const { data } = await query.order('created_at', { ascending: false });

      return {
        success: true,
        data: data || [],
      };
    }),

  // Queue: approve item
  queueApprove: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data, error } = await supabase
        .from('action_queue')
        .update({
          status: 'approved',
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.itemId)
        .eq('team_id', teamId as string)
        .select('id, status, approved_at');

      if (error) {
        throw new Error(`خطأ في الموافقة: ${error.message}`);
      }

      return {
        success: true,
        data,
      };
    }),

  // Queue: reject item
  queueReject: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data, error } = await supabase
        .from('action_queue')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.itemId)
        .eq('team_id', teamId as string)
        .select('id, status, updated_at');

      if (error) {
        throw new Error(`خطأ في الرفض: ${error.message}`);
      }

      return {
        success: true,
        data,
      };
    }),

  // Templates: list templates
  templatesList: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data } = await supabase
        .from('message_templates')
        .select('id, name, category, subject, content, variables, created_at')
        .eq('team_id', teamId as string)
        .order('created_at', { ascending: false });

      return {
        success: true,
        data: data || [],
      };
    }),

  // Templates: get specific template
  templatesGet: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('غير مصرح');
      }

      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('فريق غير موجود');
      }

      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', input.templateId)
        .eq('team_id', teamId as string);

      if (!data) {
        throw new Error('القالب غير موجود');
      }

      return {
        success: true,
        data,
      };
    }),

  // Health check
  health: protectedProcedure
    .query(async ({ ctx }) => {
      return {
        success: true,
        data: {
          authenticated: !!ctx.user?.id,
          userId: ctx.user?.id,
          timestamp: new Date().toISOString(),
        },
      };
    }),
});
