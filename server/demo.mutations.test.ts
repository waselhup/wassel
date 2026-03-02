import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Demo Data Mutations', () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  it('should be able to create demo campaign', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test user and team first
    const testEmail = `demo-campaign-${Date.now()}@example.com`;
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
      name: 'Demo Team',
      slug: `demo-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaign
    const campaignId = crypto.randomUUID();
    const { error, data } = await supabase
      .from('campaigns')
      .insert({
        id: campaignId,
        team_id: teamId,
        name: 'Demo Campaign',
        description: 'Test campaign',
        status: 'active',
        type: 'invitation_message',
        configuration: {},
        stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
        created_by: userId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(campaignId);
    expect(data?.team_id).toBe(teamId);
  });

  it('should be able to create demo leads', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test user and team
    const testEmail = `demo-leads-${Date.now()}@example.com`;
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
      name: 'Demo Team',
      slug: `demo-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaign
    await supabase.from('campaigns').insert({
      id: campaignId,
      team_id: teamId,
      name: 'Demo Campaign',
      description: 'Test campaign',
      status: 'active',
      type: 'invitation_message',
      configuration: {},
      stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
      created_by: userId,
    });

    // Create leads
    const leadIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const { error, data } = await supabase
      .from('leads')
      .insert(
        leadIds.map((id, index) => ({
          id,
          team_id: teamId,
          campaign_id: campaignId,
          linkedin_id: `lead-${index}-${Date.now()}`,
          linkedin_url: `https://linkedin.com/in/lead${index}`,
          first_name: `Lead`,
          last_name: `${index}`,
          headline: 'CTO',
          company: `Company ${index}`,
          industry: 'Tech',
          location: 'Riyadh',
          status: 'new',
          priority: 5,
        }))
      )
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data?.[0]?.team_id).toBe(teamId);
  });

  it('should be able to create demo queue items', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test user and team
    const testEmail = `demo-queue-${Date.now()}@example.com`;
    const { data: authData } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    if (!authData?.user?.id) throw new Error('Failed to create test user');

    const userId = authData.user.id;
    const teamId = crypto.randomUUID();
    const campaignId = crypto.randomUUID();
    const leadId = crypto.randomUUID();

    // Create team
    await supabase.from('teams').insert({
      id: teamId,
      name: 'Demo Team',
      slug: `demo-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaign
    await supabase.from('campaigns').insert({
      id: campaignId,
      team_id: teamId,
      name: 'Demo Campaign',
      description: 'Test campaign',
      status: 'active',
      type: 'invitation_message',
      configuration: {},
      stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
      created_by: userId,
    });

    // Create lead
    await supabase.from('leads').insert({
      id: leadId,
      team_id: teamId,
      campaign_id: campaignId,
      linkedin_id: `lead-${Date.now()}`,
      linkedin_url: 'https://linkedin.com/in/lead',
      first_name: 'Lead',
      last_name: 'Test',
      headline: 'CTO',
      company: 'Company',
      industry: 'Tech',
      location: 'Riyadh',
      status: 'new',
      priority: 5,
    });

    // Create queue items
    const queueItemIds = [crypto.randomUUID(), crypto.randomUUID()];
    const { error, data } = await supabase
      .from('action_queue')
      .insert(
        queueItemIds.map((id, index) => ({
          id,
          team_id: teamId,
          campaign_id: campaignId,
          lead_id: leadId,
          step_id: null,
          action_type: 'message',
          content: `Test action ${index}`,
          status: 'pending',
        }))
      )
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.[0]?.team_id).toBe(teamId);
    expect(data?.[0]?.status).toBe('pending');
  });

  it('should persist queue items after creation', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test user and team
    const testEmail = `demo-persist-${Date.now()}@example.com`;
    const { data: authData } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    if (!authData?.user?.id) throw new Error('Failed to create test user');

    const userId = authData.user.id;
    const teamId = crypto.randomUUID();
    const campaignId = crypto.randomUUID();
    const leadId = crypto.randomUUID();
    const queueItemId = crypto.randomUUID();

    // Create team
    await supabase.from('teams').insert({
      id: teamId,
      name: 'Demo Team',
      slug: `demo-team-${Date.now()}`,
      owner_id: userId,
      subscription_tier: 'free',
      credits_remaining: 25,
    });

    // Create campaign
    await supabase.from('campaigns').insert({
      id: campaignId,
      team_id: teamId,
      name: 'Demo Campaign',
      description: 'Test campaign',
      status: 'active',
      type: 'invitation_message',
      configuration: {},
      stats: { total_leads: 0, completed: 0, pending: 0, failed: 0 },
      created_by: userId,
    });

    // Create lead
    await supabase.from('leads').insert({
      id: leadId,
      team_id: teamId,
      campaign_id: campaignId,
      linkedin_id: `lead-${Date.now()}`,
      linkedin_url: 'https://linkedin.com/in/lead',
      first_name: 'Lead',
      last_name: 'Test',
      headline: 'CTO',
      company: 'Company',
      industry: 'Tech',
      location: 'Riyadh',
      status: 'new',
      priority: 5,
    });

    // Create queue item
    const { data: createdItem } = await supabase
      .from('action_queue')
      .insert({
        id: queueItemId,
        team_id: teamId,
        campaign_id: campaignId,
        lead_id: leadId,
        step_id: null,
        action_type: 'message',
        content: 'Test action',
        status: 'pending',
      })
      .select()
      .single();

    expect(createdItem?.id).toBe(queueItemId);

    // Fetch the item again to verify persistence
    const { data: fetchedItem } = await supabase
      .from('action_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();

    expect(fetchedItem?.id).toBe(queueItemId);
    expect(fetchedItem?.status).toBe('pending');
    expect(fetchedItem?.content).toBe('Test action');
  });
});
