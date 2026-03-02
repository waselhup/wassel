import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper to get user's team ID from Supabase auth
export async function getUserTeamId(userId: string): Promise<string | null> {
  try {
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    return teamMember?.team_id || null;
  } catch (error) {
    console.error('[Supabase] Failed to get user team:', error);
    return null;
  }
}

// Helper to verify team ownership
export async function verifyTeamAccess(userId: string, teamId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .limit(1)
      .single();

    return !!data;
  } catch (error) {
    console.error('[Supabase] Failed to verify team access:', error);
    return false;
  }
}
