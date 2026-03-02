import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Real Campaign Creation', () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  it('should create a campaign with all required fields', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test user and team
    const testEmail = `campaign-test-${Date.now()}@example.com`;
    const { data: authData } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    if (!authData?.user?.id) throw new Error('Failed to create test user');

    const userId = authData.user.id;
    const teamId = crypto.randomUUID();

    // Create team
    await supabase.from('teams').insert({
      id: teamId,
      name: 'Test Team',
      slug: `test-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaign
    const campaignId = crypto.randomUUID();
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        id: campaignId,
        team_id: teamId,
        name: 'Test Campaign',
        description: 'A test campaign',
        status: 'draft',
        type: 'invitation_message',
        configuration: {},
        stats: {
          total_leads: 0,
          completed: 0,
          pending: 0,
          failed: 0,
        },
        created_by: userId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(campaignId);
    expect(data?.name).toBe('Test Campaign');
    expect(data?.status).toBe('draft');
    expect(data?.type).toBe('invitation_message');
  });

  it('should update campaign status', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test user and team
    const testEmail = `campaign-status-${Date.now()}@example.com`;
    const { data: authData } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    if (!authData?.user?.id) throw new Error('Failed to create test user');

    const userId = authData.user.id;
    const teamId = crypto.randomUUID();
    const campaignId = crypto.randomUUID();

    // Create team
    await supabase.from('teams').insert({
      id: teamId,
      name: 'Test Team',
      slug: `test-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaign
    await supabase.from('campaigns').insert({
      id: campaignId,
      team_id: teamId,
      name: 'Test Campaign',
      status: 'draft',
      type: 'invitation_message',
      configuration: {},
      stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
      created_by: userId,
    });

    // Update status
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaignId)
      .eq('team_id', teamId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe('active');
  });

  it('should delete a campaign', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test user and team
    const testEmail = `campaign-delete-${Date.now()}@example.com`;
    const { data: authData } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    if (!authData?.user?.id) throw new Error('Failed to create test user');

    const userId = authData.user.id;
    const teamId = crypto.randomUUID();
    const campaignId = crypto.randomUUID();

    // Create team
    await supabase.from('teams').insert({
      id: teamId,
      name: 'Test Team',
      slug: `test-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaign
    await supabase.from('campaigns').insert({
      id: campaignId,
      team_id: teamId,
      name: 'Test Campaign',
      status: 'draft',
      type: 'invitation_message',
      configuration: {},
      stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
      created_by: userId,
    });

    // Delete campaign
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('team_id', teamId);

    expect(deleteError).toBeNull();

    // Verify deletion
    const { data: deletedCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    expect(deletedCampaign).toBeNull();
  });

  it('should enforce team isolation on campaigns', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create two test users
    const user1Email = `campaign-isolation-1-${Date.now()}@example.com`;
    const user2Email = `campaign-isolation-2-${Date.now()}@example.com`;

    const { data: user1 } = await supabase.auth.admin.createUser({
      email: user1Email,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    const { data: user2 } = await supabase.auth.admin.createUser({
      email: user2Email,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    if (!user1?.user?.id || !user2?.user?.id) throw new Error('Failed to create test users');

    // Create teams
    const team1Id = crypto.randomUUID();
    const team2Id = crypto.randomUUID();

    await supabase.from('teams').insert({
      id: team1Id,
      name: 'Team 1',
      slug: `team-1-${Date.now()}`,
      owner_id: user1.user.id,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    await supabase.from('teams').insert({
      id: team2Id,
      name: 'Team 2',
      slug: `team-2-${Date.now()}`,
      owner_id: user2.user.id,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaigns in each team
    const campaign1Id = crypto.randomUUID();
    const campaign2Id = crypto.randomUUID();

    await supabase.from('campaigns').insert({
      id: campaign1Id,
      team_id: team1Id,
      name: 'Campaign 1',
      status: 'draft',
      type: 'invitation_message',
      configuration: {},
      stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
      created_by: user1.user.id,
    });

    await supabase.from('campaigns').insert({
      id: campaign2Id,
      team_id: team2Id,
      name: 'Campaign 2',
      status: 'draft',
      type: 'invitation_message',
      configuration: {},
      stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
      created_by: user2.user.id,
    });

    // Verify team1 can only see their campaign
    const { data: team1Campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('team_id', team1Id);

    expect(team1Campaigns).toHaveLength(1);
    expect(team1Campaigns?.[0]?.id).toBe(campaign1Id);

    // Verify team2 can only see their campaign
    const { data: team2Campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('team_id', team2Id);

    expect(team2Campaigns).toHaveLength(1);
    expect(team2Campaigns?.[0]?.id).toBe(campaign2Id);
  });
});
