import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { supabase } from '../supabase';
import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Auth router with magic link and auto-onboarding procedures
 */
export const authRouter = router({
  /**
   * Get current user from Supabase Auth
   * Returns null if not authenticated
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return null;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ctx.user.id)
        .single();

      return profile || null;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      return null;
    }
  }),

  /**
   * Auto-onboard user on first login
   * Creates profile + default team + team membership
   */
  onboard: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      fullName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('User not authenticated');
      }

      const userId = ctx.user.id;

      try {
        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();

        if (existingProfile) {
          // Profile already exists, just return it
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          return { profile, team: null, isNewUser: false };
        }

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: input.email,
            full_name: input.fullName || 'مستخدم جديد',
            timezone: 'Asia/Riyadh',
            locale: 'ar',
            subscription_tier: 'free',
            subscription_status: 'active',
            credits_remaining: 25,
            monthly_credits: 25,
          });

        if (profileError) {
          throw new Error(`Failed to create profile: ${profileError.message}`);
        }

        // Create default team
        const teamId = randomUUID();
        const { error: teamError } = await supabase
          .from('teams')
          .insert({
            id: teamId,
            name: 'فريقي الافتراضي',
            slug: `team-${userId.slice(0, 8)}-${Date.now()}`,
            owner_id: userId,
            subscription_tier: 'free',
            credits_remaining: 25,
          });

        if (teamError) {
          throw new Error(`Failed to create team: ${teamError.message}`);
        }

        // Add user to team
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            id: randomUUID(),
            team_id: teamId,
            user_id: userId,
            role: 'owner',
          });

        if (memberError) {
          throw new Error(`Failed to add user to team: ${memberError.message}`);
        }

        // Fetch created profile and team
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        const { data: team } = await supabase
          .from('teams')
          .select('*')
          .eq('id', teamId)
          .single();

        return {
          profile,
          team,
          isNewUser: true,
        };
      } catch (error) {
        console.error('Onboarding failed:', error);
        throw error;
      }
    }),

  /**
   * Get user's primary team
   */
  getTeam: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return null;

    try {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', ctx.user.id)
        .limit(1)
        .single();

      if (!teamMember) return null;

      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamMember.team_id)
        .single();

      return team || null;
    } catch (error) {
      console.error('Failed to fetch team:', error);
      return null;
    }
  }),

  /**
   * Logout (clear session)
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    try {
      // Clear session cookie if needed
      // This is handled by Supabase Auth on the client
      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }),
});
