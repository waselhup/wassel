import { supabase } from './supabase';

/**
 * Get user's primary team ID from Supabase
 * Uses team_members table to find the first team for the authenticated user
 */
export async function getUserTeamId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error) {
      console.warn('[Database] Failed to get user team:', error);
      return null;
    }

    return data?.team_id || null;
  } catch (error) {
    console.error('[Database] Error getting user team:', error);
    return null;
  }
}

/**
 * Get user profile from Supabase
 */
export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[Database] Failed to get user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Database] Error getting user profile:', error);
    return null;
  }
}

/**
 * Get campaigns for a team
 */
export async function getCampaignsByTeam(teamId: string) {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Database] Failed to get campaigns:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Database] Error getting campaigns:', error);
    return [];
  }
}

/**
 * Get leads for a team
 */
export async function getLeadsByTeam(teamId: string) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Database] Failed to get leads:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Database] Error getting leads:', error);
    return [];
  }
}

/**
 * Update lead status
 */
export async function updateLeadStatus(teamId: string, leadId: string, status: string) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) {
      console.warn('[Database] Failed to update lead:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Database] Error updating lead:', error);
    return null;
  }
}

/**
 * Get action queue items for a team
 */
export async function getQueueItemsByTeam(teamId: string) {
  try {
    const { data, error } = await supabase
      .from('action_queue')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Database] Failed to get queue items:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Database] Error getting queue items:', error);
    return [];
  }
}

/**
 * Approve queue item
 */
export async function approveQueueItem(teamId: string, itemId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('action_queue')
      .update({
        status: 'ready',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) {
      console.warn('[Database] Failed to approve queue item:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Database] Error approving queue item:', error);
    return null;
  }
}

/**
 * Reject queue item
 */
export async function rejectQueueItem(teamId: string, itemId: string) {
  try {
    const { data, error } = await supabase
      .from('action_queue')
      .update({
        status: 'skipped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) {
      console.warn('[Database] Failed to reject queue item:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Database] Error rejecting queue item:', error);
    return null;
  }
}
