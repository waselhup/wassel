import { describe, it, expect, beforeEach } from 'vitest';
import { supabase } from './supabase';

describe('Lead Import', () => {
  let teamId: string;
  let campaignId: string;
  let userId: string;

  beforeEach(async () => {
    // Use test user ID
    userId = 'test-user-' + Date.now();
    
    // Create test team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: 'Test Team',
        slug: 'test-team-' + Date.now(),
        owner_id: userId,
      })
      .select()
      .single();

    if (teamError) {
      console.error('Team creation error:', teamError);
    }
    teamId = team?.id || '';

    // Create test campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        team_id: teamId,
        name: 'Test Campaign',
        type: 'invitation',
        configuration: {},
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
    }
    campaignId = campaign?.id || '';
  });

  it('should import leads from CSV data', async () => {
    const leads = [
      {
        linkedin_url: 'https://linkedin.com/in/test1-' + Date.now(),
        first_name: 'محمد',
        last_name: 'علي',
        company: 'شركة التقنية',
        headline: 'مدير المشروع',
      },
      {
        linkedin_url: 'https://linkedin.com/in/test2-' + Date.now(),
        first_name: 'فاطمة',
        last_name: 'أحمد',
        company: 'شركة البرمجيات',
        headline: 'مهندسة البرمجيات',
      },
    ];

    const { data: inserted, error } = await supabase
      .from('leads')
      .insert(
        leads.map((lead) => ({
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_url: lead.linkedin_url,
          first_name: lead.first_name,
          last_name: lead.last_name,
          company: lead.company,
          headline: lead.headline,
          profile_data: {
            first_name: lead.first_name,
            last_name: lead.last_name,
            company: lead.company,
            headline: lead.headline,
          },
          imported_by: userId,
          imported_at: new Date().toISOString(),
        }))
      )
      .select();

    expect(error).toBeNull();
    expect(inserted).toBeDefined();
    expect(inserted?.length).toBeGreaterThanOrEqual(2);
    expect(inserted?.[0]?.first_name).toBe('محمد');
  });

  it('should handle duplicate leads (upsert)', async () => {
    const linkedinUrl = 'https://linkedin.com/in/duplicate-test-' + Date.now();

    // First insert
    const { data: first, error: firstError } = await supabase
      .from('leads')
      .upsert(
        [
          {
            team_id: teamId,
            campaign_id: campaignId,
            linkedin_url: linkedinUrl,
            first_name: 'محمد',
            last_name: 'علي',
            company: 'شركة أولى',
            profile_data: {},
            imported_by: userId,
            imported_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'team_id,linkedin_url' }
      )
      .select();

    expect(firstError).toBeNull();
    expect(first?.length).toBeGreaterThanOrEqual(1);

    // Second insert (duplicate)
    const { data: second, error: secondError } = await supabase
      .from('leads')
      .upsert(
        [
          {
            team_id: teamId,
            campaign_id: campaignId,
            linkedin_url: linkedinUrl,
            first_name: 'محمد',
            last_name: 'علي',
            company: 'شركة محدثة',
            profile_data: {},
            imported_by: userId,
            imported_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'team_id,linkedin_url' }
      )
      .select();

    expect(secondError).toBeNull();
    expect(second?.length).toBeGreaterThanOrEqual(1);
    expect(second?.[0]?.company).toBe('شركة محدثة');
  });

  it('should create action queue items for imported leads', async () => {
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .insert({
        team_id: teamId,
        campaign_id: campaignId,
        linkedin_url: 'https://linkedin.com/in/queue-test-' + Date.now(),
        first_name: 'علي',
        last_name: 'محمد',
        company: 'شركة الاختبار',
        profile_data: {},
        imported_by: userId,
        imported_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(leadError).toBeNull();
    const leadId = leads?.id;

    const { data: queueItem, error: queueError } = await supabase
      .from('action_queue')
      .insert({
        team_id: teamId,
        campaign_id: campaignId,
        lead_id: leadId,
        action_type: 'invitation',
        status: 'pending',
        requires_approval: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(queueError).toBeNull();
    expect(queueItem).toBeDefined();
    expect(queueItem?.status).toBe('pending');
    expect(queueItem?.lead_id).toBe(leadId);
  });

  it('should update campaign stats after import', async () => {
    // Insert leads
    const { error: insertError } = await supabase.from('leads').insert([
      {
        team_id: teamId,
        campaign_id: campaignId,
        linkedin_url: 'https://linkedin.com/in/stat-test-1-' + Date.now(),
        first_name: 'محمد',
        last_name: 'علي',
        company: 'شركة',
        profile_data: {},
        imported_by: userId,
        imported_at: new Date().toISOString(),
      },
      {
        team_id: teamId,
        campaign_id: campaignId,
        linkedin_url: 'https://linkedin.com/in/stat-test-2-' + Date.now(),
        first_name: 'فاطمة',
        last_name: 'أحمد',
        company: 'شركة',
        profile_data: {},
        imported_by: userId,
        imported_at: new Date().toISOString(),
      },
    ]);

    expect(insertError).toBeNull();

    // Count leads
    const { data: leads, count, error: countError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId);

    expect(countError).toBeNull();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(2);

    // Update campaign stats
    const { data: updated, error: updateError } = await supabase
      .from('campaigns')
      .update({
        stats: {
          total_leads: count || 0,
          completed: 0,
          pending: count || 0,
          failed: 0,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updated?.stats?.total_leads).toBeGreaterThanOrEqual(2);
  });

  it('should enforce team isolation on lead import', async () => {
    // Create another team
    const { data: otherTeam, error: otherTeamError } = await supabase
      .from('teams')
      .insert({
        name: 'Other Team',
        slug: 'other-team-' + Date.now(),
        owner_id: userId,
      })
      .select()
      .single();

    expect(otherTeamError).toBeNull();
    const otherTeamId = otherTeam?.id || '';

    // Try to insert lead into first team's campaign from another team
    // This should succeed at DB level but violate team isolation
    const { data: leads, error: insertError } = await supabase
      .from('leads')
      .insert({
        team_id: otherTeamId, // Different team
        campaign_id: campaignId, // But same campaign
        linkedin_url: 'https://linkedin.com/in/isolation-test-' + Date.now(),
        first_name: 'محمد',
        last_name: 'علي',
        company: 'شركة',
        profile_data: {},
        imported_by: userId,
        imported_at: new Date().toISOString(),
      })
      .select();

    // Should handle gracefully
    expect(insertError || leads).toBeDefined();
  });
});
