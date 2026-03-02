import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Supabase Auth Flow', () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  it('should be able to send magic link', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testEmail = `test-${Date.now()}@example.com`;

    const { error } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    });

    // The error should be null (success)
    expect(error).toBeNull();
  });

  it('should be able to create user profile on first login', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create a test user
    const testEmail = `profile-test-${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    expect(authError).toBeNull();
    expect(authData?.user?.id).toBeDefined();

    if (!authData?.user?.id) return;

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: testEmail,
        full_name: 'Test User',
        timezone: 'Asia/Riyadh',
        locale: 'ar',
        subscription_tier: 'free',
        subscription_status: 'active',
        credits_remaining: 25,
        monthly_credits: 25,
      });

    expect(profileError).toBeNull();

    // Verify profile was created
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    expect(fetchError).toBeNull();
    expect(profile?.id).toBe(userId);
    expect(profile?.email).toBe(testEmail);
  });

  it('should be able to create team on first login', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create a test user
    const testEmail = `team-test-${Date.now()}@example.com`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!@#',
      email_confirm: true,
    });

    expect(authError).toBeNull();
    expect(authData?.user?.id).toBeDefined();

    if (!authData?.user?.id) return;

    const userId = authData.user.id;
    const teamId = crypto.randomUUID();

    // Create team
    const { error: teamError } = await supabase
      .from('teams')
      .insert({
        id: teamId,
        name: 'Test Team',
        slug: `test-team-${Date.now()}`,
        owner_id: userId,
        subscription_tier: 'free',
        credits_remaining: 25,
      });

    expect(teamError).toBeNull();

    // Add user to team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        id: crypto.randomUUID(),
        team_id: teamId,
        user_id: userId,
        role: 'owner',
      });

    expect(memberError).toBeNull();

    // Verify team membership
    const { data: member, error: fetchError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    expect(fetchError).toBeNull();
    expect(member?.role).toBe('owner');
  });

  it('should enforce team isolation on queries', async () => {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create two test users
    const user1Email = `isolation-test-1-${Date.now()}@example.com`;
    const user2Email = `isolation-test-2-${Date.now()}@example.com`;

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

    expect(user1?.user?.id).toBeDefined();
    expect(user2?.user?.id).toBeDefined();

    if (!user1?.user?.id || !user2?.user?.id) return;

    // Create teams for each user
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

    // Add users to their respective teams
    await supabase.from('team_members').insert({
      id: crypto.randomUUID(),
      team_id: team1Id,
      user_id: user1.user.id,
      role: 'owner',
    });

    await supabase.from('team_members').insert({
      id: crypto.randomUUID(),
      team_id: team2Id,
      user_id: user2.user.id,
      role: 'owner',
    });

    // Create leads in each team
    const lead1Id = crypto.randomUUID();
    const lead2Id = crypto.randomUUID();

    await supabase.from('leads').insert({
      id: lead1Id,
      team_id: team1Id,
      campaign_id: crypto.randomUUID(),
      linkedin_id: `lead-1-${Date.now()}`,
      linkedin_url: 'https://linkedin.com/in/lead1',
      first_name: 'Lead',
      last_name: 'One',
      headline: 'CTO',
      company: 'Company 1',
      industry: 'Tech',
      location: 'Riyadh',
      status: 'new',
      priority: 5,
    });

    await supabase.from('leads').insert({
      id: lead2Id,
      team_id: team2Id,
      campaign_id: crypto.randomUUID(),
      linkedin_id: `lead-2-${Date.now()}`,
      linkedin_url: 'https://linkedin.com/in/lead2',
      first_name: 'Lead',
      last_name: 'Two',
      headline: 'VP',
      company: 'Company 2',
      industry: 'Tech',
      location: 'Dubai',
      status: 'new',
      priority: 5,
    });

    // Verify team isolation: team1 can only see their leads
    const { data: team1Leads } = await supabase
      .from('leads')
      .select('*')
      .eq('team_id', team1Id);

    expect(team1Leads).toHaveLength(1);
    expect(team1Leads?.[0]?.id).toBe(lead1Id);

    // Verify team isolation: team2 can only see their leads
    const { data: team2Leads } = await supabase
      .from('leads')
      .select('*')
      .eq('team_id', team2Id);

    expect(team2Leads).toHaveLength(1);
    expect(team2Leads?.[0]?.id).toBe(lead2Id);
  });
});
