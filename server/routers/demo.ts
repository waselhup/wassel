import { router, protectedProcedure } from '../_core/trpc';
import { supabase } from '../supabase';
import { getUserTeamId } from '../db';
import { randomUUID } from 'crypto';

/**
 * Demo data router for creating sample campaigns, leads, and queue items
 */
export const demoRouter = router({
  /**
   * Create demo campaign for the user's team
   */
  createDemoCampaign: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('User has no team');
      }

      const campaignId = randomUUID();
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert({
          id: campaignId,
          team_id: teamId,
          name: 'حملة LinkedIn التجريبية - Q1 2026',
          description: 'حملة تجريبية للتواصل مع صناع القرار في مجال التكنولوجيا',
          status: 'active',
          type: 'invitation_message',
          configuration: {
            target_industry: 'Technology',
            target_title: 'CTO, VP Engineering, Engineering Manager',
            message_template: 'مرحباً {{firstName}}، لاحظت عملك الممتاز في {{company}}...',
          },
          stats: {
            total_leads: 0,
            completed: 0,
            pending: 0,
            failed: 0,
          },
          created_by: ctx.user.id,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create campaign: ${error.message}`);
      }

      return campaign;
    } catch (error) {
      console.error('Demo campaign creation failed:', error);
      throw error;
    }
  }),

  /**
   * Create demo leads for the user's team
   */
  createDemoLeads: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('User has no team');
      }

      // Get the first campaign or create one
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('team_id', teamId)
        .limit(1);

      const campaignId = campaigns?.[0]?.id || randomUUID();

      const demoLeads = [
        {
          id: randomUUID(),
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_id: `lead-001-${Date.now()}`,
          linkedin_url: 'https://linkedin.com/in/ahmed-mohammad',
          first_name: 'أحمد',
          last_name: 'محمد',
          headline: 'CTO في TechCorp',
          company: 'TechCorp',
          industry: 'Technology',
          location: 'الرياض، المملكة العربية السعودية',
          email: 'ahmad@techcorp.com',
          status: 'new',
          priority: 8,
          profile_data: {
            connections: 500,
            followers: 1200,
            endorsements: ['القيادة', 'التكنولوجيا'],
          },
        },
        {
          id: randomUUID(),
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_id: `lead-002-${Date.now()}`,
          linkedin_url: 'https://linkedin.com/in/fatima-ali',
          first_name: 'فاطمة',
          last_name: 'علي',
          headline: 'VP Engineering في InnovateLabs',
          company: 'InnovateLabs',
          industry: 'Technology',
          location: 'دبي، الإمارات العربية المتحدة',
          email: 'fatima@innovatelabs.com',
          status: 'in_progress',
          priority: 9,
          profile_data: {
            connections: 800,
            followers: 2100,
            endorsements: ['الهندسة', 'إدارة المنتج'],
          },
        },
        {
          id: randomUUID(),
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_id: `lead-003-${Date.now()}`,
          linkedin_url: 'https://linkedin.com/in/mohammad-salem',
          first_name: 'محمد',
          last_name: 'سالم',
          headline: 'Engineering Manager في CloudFirst',
          company: 'CloudFirst',
          industry: 'Cloud Computing',
          location: 'جدة، المملكة العربية السعودية',
          email: 'mohammad@cloudfirst.com',
          status: 'completed',
          priority: 7,
          profile_data: {
            connections: 650,
            followers: 1500,
            endorsements: ['معمارية السحابة', 'إدارة الفريق'],
          },
        },
      ];

      const { data: leads, error } = await supabase
        .from('leads')
        .insert(demoLeads)
        .select();

      if (error) {
        throw new Error(`Failed to create leads: ${error.message}`);
      }

      return leads || [];
    } catch (error) {
      console.error('Demo leads creation failed:', error);
      throw error;
    }
  }),

  /**
   * Create demo queue items for the user's team
   */
  createDemoQueueItems: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const teamId = await getUserTeamId(ctx.user.id);
      if (!teamId) {
        throw new Error('User has no team');
      }

      // Get campaign and leads
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('team_id', teamId)
        .limit(1);

      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('team_id', teamId)
        .limit(3);

      if (!campaigns || !leads || campaigns.length === 0 || leads.length === 0) {
        throw new Error('No campaigns or leads found');
      }

      const campaignId = campaigns[0].id;
      const leadIds = leads.map(l => l.id);

      const queueItems = [
        {
          id: randomUUID(),
          team_id: teamId,
          campaign_id: campaignId,
          lead_id: leadIds[0],
          step_id: null,
          action_type: 'send_message',
          content: 'مرحباً أحمد، لاحظت عملك الممتاز في TechCorp وأود التحدث معك عن فرصة تعاون...',
          priority: 'important',
          confidence: 'high',
          status: 'pending',
        },
        {
          id: randomUUID(),
          team_id: teamId,
          campaign_id: campaignId,
          lead_id: leadIds[1],
          step_id: null,
          action_type: 'send_invitation',
          content: 'إضافة فاطمة كمتابع على LinkedIn',
          priority: 'normal',
          confidence: 'medium',
          status: 'pending',
        },
        {
          id: randomUUID(),
          team_id: teamId,
          campaign_id: campaignId,
          lead_id: leadIds[2],
          step_id: null,
          action_type: 'send_message',
          content: 'متابعة مع محمد بخصوص فرصة تعاون في مجال البنية التحتية السحابية',
          priority: 'normal',
          confidence: 'high',
          status: 'pending',
        },
      ];

      const { data: items, error } = await supabase
        .from('action_queue')
        .insert(queueItems)
        .select();

      if (error) {
        throw new Error(`Failed to create queue items: ${error.message}`);
      }

      return items || [];
    } catch (error) {
      console.error('Demo queue items creation failed:', error);
      throw error;
    }
  }),
});
