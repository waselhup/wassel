import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { supabase } from '../supabase';
import { getUserTeamId } from '../db';

export const leadsRouter = router({
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) return [];
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) return [];

      let query = supabase.from('leads').select('*').eq('team_id', teamId as string);
      
      if (input?.campaignId) {
        query = query.eq('campaign_id', input.campaignId);
      }

      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    }),

  importLeads: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        leads: z.array(
          z.object({
            linkedin_url: z.string().url(),
            first_name: z.string().optional(),
            last_name: z.string().optional(),
            company: z.string().optional(),
            headline: z.string().optional(),
            email: z.string().email().optional(),
          })
        ),
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
        .eq('team_id', teamId as string)
        .single();

      if (!campaign) {
        throw new Error('الحملة غير موجودة');
      }

      // Import leads
      const leadsToInsert = input.leads.map((lead) => ({
        team_id: teamId,
        campaign_id: input.campaignId,
        linkedin_url: lead.linkedin_url,
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        company: lead.company || '',
        headline: lead.headline || '',
        email: lead.email || '',
        profile_data: {
          first_name: lead.first_name,
          last_name: lead.last_name,
          company: lead.company,
          headline: lead.headline,
        },
        imported_by: ctx.user.id,
        imported_at: new Date().toISOString(),
      }));

      // Insert with conflict handling (upsert on unique constraint)
      const { data: inserted, error } = await supabase
        .from('leads')
        .upsert(leadsToInsert, {
          onConflict: 'team_id,linkedin_url',
        })
        .select();

      if (error) {
        console.error('Import error:', error);
        throw new Error(`خطأ في الاستيراد: ${error.message}`);
      }

      // Count duplicates (leads that already existed)
      const duplicates = leadsToInsert.length - (inserted?.length || 0);

      // Create action queue items for newly imported leads
      if (inserted && inserted.length > 0) {
        const queueItems = inserted.map((lead) => ({
          team_id: teamId,
          campaign_id: input.campaignId,
          lead_id: lead.id,
          action_type: 'invitation',
          status: 'pending',
          requires_approval: true,
          created_at: new Date().toISOString(),
        }));

        await supabase.from('action_queue').insert(queueItems);
      }

      // Update campaign stats
      const { data: stats } = await supabase
        .from('leads')
        .select('id', { count: 'exact' })
        .eq('campaign_id', input.campaignId);

      if (stats) {
        await supabase
          .from('campaigns')
          .update({
            stats: {
              total_leads: stats.length || 0,
              completed: 0,
              pending: inserted?.length || 0,
              failed: 0,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.campaignId);
      }

      return {
        imported: inserted?.length || 0,
        duplicates,
        message: `تم استيراد ${inserted?.length || 0} عميل محتمل`,
      };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ leadId: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return null;
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) return null;

      const { data } = await supabase
        .from('leads')
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq('id', input.leadId)
        .eq('team_id', teamId as string)
        .select()
        .single();

      return data || null;
    }),

  delete: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) return null;
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) return null;

      const { data } = await supabase
        .from('leads')
        .delete()
        .eq('id', input.leadId)
        .eq('team_id', teamId as string)
        .select()
        .single();

      return data || null;
    }),
});
