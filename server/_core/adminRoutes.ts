import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const router = Router();

function supabase() {
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Log admin action */
async function logAction(adminId: string, action: string, targetUserId?: string, metadata?: any) {
  await supabase().from('admin_activity_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId || null,
    metadata: metadata || null,
  });
}

/* ================================================
   GET /overview — 4 metrics + activity feed
   ================================================ */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const sb = supabase();

    // Total teams
    const { count: totalTeams } = await sb.from('teams').select('*', { count: 'exact', head: true });

    // Active this week
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: activeWeek } = await sb.from('teams').select('*', { count: 'exact', head: true }).gte('last_active_at', weekAgo);

    // Active campaigns
    const { count: activeCampaigns } = await sb.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active');

    // Total prospects
    const { count: totalProspects } = await sb.from('prospects').select('*', { count: 'exact', head: true });

    // Recent activity — last 10 admin logs + recent signups
    const { data: recentLogs } = await sb.from('admin_activity_log')
      .select('*').order('created_at', { ascending: false }).limit(10);

    // Recent signups
    const { data: recentProfiles } = await sb.from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false }).limit(5);

    const activity = [
      ...(recentProfiles || []).map(p => ({
        type: 'signup',
        text: `New signup: ${p.email}`,
        name: p.full_name || p.email?.split('@')[0] || 'User',
        time: p.created_at,
      })),
      ...(recentLogs || []).map(l => ({
        type: 'admin',
        text: l.action,
        name: 'Admin',
        time: l.created_at,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

    res.json({
      metrics: {
        totalTeams: totalTeams || 0,
        activeWeek: activeWeek || 0,
        activeCampaigns: activeCampaigns || 0,
        totalProspects: totalProspects || 0,
      },
      activity,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ================================================
   GET /customers — all teams with stats
   ================================================ */
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const sb = supabase();

    // Get all teams with owner info
    const { data: teams } = await sb.from('teams')
      .select('id, name, created_at, plan, status, last_active_at')
      .order('created_at', { ascending: false });

    if (!teams) return res.json({ customers: [] });

    // Get team members for each team to find owner email
    const teamIds = teams.map(t => t.id);
    const { data: members } = await sb.from('team_members')
      .select('team_id, user_id, role')
      .in('team_id', teamIds);

    const ownerUserIds = (members || []).filter(m => m.role === 'owner').map(m => m.user_id);

    const { data: profiles } = await sb.from('profiles')
      .select('id, email, full_name')
      .in('id', ownerUserIds.length > 0 ? ownerUserIds : ['none']);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const memberMap = new Map<string, any>();
    (members || []).filter(m => m.role === 'owner').forEach(m => memberMap.set(m.team_id, m));

    // Get prospect counts per team
    const { data: prospectCounts } = await sb.rpc('count_prospects_per_team') as any;
    const prospectMap = new Map();
    if (Array.isArray(prospectCounts)) {
      prospectCounts.forEach((r: any) => prospectMap.set(r.team_id, r.count));
    }

    // Get campaign counts per team
    const { data: campaigns } = await sb.from('campaigns')
      .select('id, team_id')
      .in('team_id', teamIds);

    const campaignCounts = new Map<string, number>();
    (campaigns || []).forEach(c => {
      campaignCounts.set(c.team_id, (campaignCounts.get(c.team_id) || 0) + 1);
    });

    const customers = teams.map(t => {
      const ownerMember = memberMap.get(t.id);
      const ownerProfile = ownerMember ? profileMap.get(ownerMember.user_id) : null;
      return {
        id: t.id,
        name: t.name || ownerProfile?.full_name || 'Unknown',
        email: ownerProfile?.email || '',
        plan: t.plan || 'trial',
        status: t.status || 'active',
        prospects: prospectMap.get(t.id) || 0,
        campaigns: campaignCounts.get(t.id) || 0,
        lastActive: t.last_active_at,
        createdAt: t.created_at,
        userId: ownerMember?.user_id || null,
      };
    });

    res.json({ customers });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ================================================
   GET /customers/:id — single customer detail
   ================================================ */
router.get('/customers/:id', async (req: Request, res: Response) => {
  try {
    const sb = supabase();
    const teamId = req.params.id;

    const { data: team } = await sb.from('teams')
      .select('*').eq('id', teamId).single();

    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Owner profile
    const { data: owner } = await sb.from('team_members')
      .select('user_id').eq('team_id', teamId).eq('role', 'owner').single();

    let profile = null;
    if (owner) {
      const { data: p } = await sb.from('profiles')
        .select('*').eq('id', owner.user_id).single();
      profile = p;
    }

    // Campaigns
    const { data: campaigns } = await sb.from('campaigns')
      .select('id, name, status, type, created_at')
      .eq('team_id', teamId).order('created_at', { ascending: false });

    // Prospect count
    const { count: prospectCount } = await sb.from('prospects')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', (campaigns || []).map(c => c.id));

    // Acceptance rate
    const { count: invitesSent } = await sb.from('prospect_step_status')
      .select('*', { count: 'exact', head: true })
      .eq('step_type', 'invite')
      .eq('status', 'completed')
      .in('campaign_id', (campaigns || []).map(c => c.id));

    const { count: accepted } = await sb.from('linkedin_connections')
      .select('*', { count: 'exact', head: true })
      .eq('connection_status', 'accepted')
      .eq('team_id', teamId);

    const acceptRate = (invitesSent && invitesSent > 0)
      ? Math.round(((accepted || 0) / invitesSent) * 100) : 0;

    res.json({
      team,
      profile,
      campaigns: campaigns || [],
      metrics: {
        prospects: prospectCount || 0,
        activeCampaigns: (campaigns || []).filter(c => c.status === 'active').length,
        acceptanceRate: acceptRate,
        daysSinceSignup: Math.floor((Date.now() - new Date(team.created_at).getTime()) / 86400000),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ================================================
   POST /customers/:id/suspend — toggle suspend
   ================================================ */
router.post('/customers/:id/suspend', async (req: Request, res: Response) => {
  try {
    const sb = supabase();
    const teamId = req.params.id;
    const adminId = (req as any).user?.id;

    // Get current status
    const { data: team } = await sb.from('teams')
      .select('status').eq('id', teamId).single();

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const newStatus = team.status === 'suspended' ? 'active' : 'suspended';

    await sb.from('teams').update({ status: newStatus }).eq('id', teamId);

    await logAction(adminId, `${newStatus === 'suspended' ? 'Suspended' : 'Unsuspended'} team`, undefined, { teamId });

    res.json({ status: newStatus });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ================================================
   POST /impersonate — generate short-lived JWT
   ================================================ */
router.post('/impersonate', async (req: Request, res: Response) => {
  try {
    const sb = supabase();
    const adminId = (req as any).user?.id;
    const { targetUserId } = req.body;

    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

    // Verify admin is super_admin
    const { data: adminProfile } = await sb.from('profiles')
      .select('role').eq('id', adminId).single();

    if (!adminProfile || adminProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get target user profile
    const { data: targetProfile } = await sb.from('profiles')
      .select('id, email, role, team_id').eq('id', targetUserId).single();

    if (!targetProfile) return res.status(404).json({ error: 'User not found' });

    // Generate short-lived JWT (1hr)
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(
      {
        sub: targetProfile.id,
        email: targetProfile.email,
        role: targetProfile.role || 'client_user',
        team_id: targetProfile.team_id,
        impersonated_by: adminId,
        iss: 'wassel-admin',
      },
      secret,
      { expiresIn: '1h' }
    );

    await logAction(adminId, `Impersonated user: ${targetProfile.email}`, targetUserId);

    res.json({
      token,
      user: {
        id: targetProfile.id,
        email: targetProfile.email,
        role: targetProfile.role,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ================================================
   GET /stats — platform-wide analytics
   ================================================ */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const sb = supabase();

    // Signups per day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recentProfiles } = await sb.from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo);

    const signupsByDay = new Map<string, number>();
    (recentProfiles || []).forEach(p => {
      const day = p.created_at?.slice(0, 10);
      if (day) signupsByDay.set(day, (signupsByDay.get(day) || 0) + 1);
    });

    // Invites sent per day (last 30 days)
    const { data: recentInvites } = await sb.from('prospect_step_status')
      .select('completed_at')
      .eq('step_type', 'invite')
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo);

    const invitesByDay = new Map<string, number>();
    (recentInvites || []).forEach(i => {
      const day = i.completed_at?.slice(0, 10);
      if (day) invitesByDay.set(day, (invitesByDay.get(day) || 0) + 1);
    });

    // Connections per day (last 30 days)
    const { data: recentConnections } = await sb.from('linkedin_connections')
      .select('connected_at')
      .eq('connection_status', 'accepted')
      .gte('connected_at', thirtyDaysAgo);

    const connectionsByDay = new Map<string, number>();
    (recentConnections || []).forEach(c => {
      const day = c.connected_at?.slice(0, 10);
      if (day) connectionsByDay.set(day, (connectionsByDay.get(day) || 0) + 1);
    });

    // Build 30-day chart data
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      const day = date.toISOString().slice(0, 10);
      dailyData.push({
        date: day,
        signups: signupsByDay.get(day) || 0,
        invites: invitesByDay.get(day) || 0,
        connections: connectionsByDay.get(day) || 0,
      });
    }

    // Top customers
    const { data: teams } = await sb.from('teams')
      .select('id, name').limit(10);

    // Table counts
    const tables = ['profiles', 'teams', 'campaigns', 'prospects', 'prospect_step_status', 'linkedin_connections'];
    const tableCounts: Record<string, number> = {};
    for (const table of tables) {
      const { count } = await sb.from(table).select('*', { count: 'exact', head: true });
      tableCounts[table] = count || 0;
    }

    res.json({
      dailyData,
      tableCounts,
      topTeams: teams || [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
