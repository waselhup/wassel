import { router, protectedProcedure } from '../_core/trpc';
import { supabase } from '../supabase';
import { getUserTeamId } from '../db';
import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Campaigns router for real campaign management
 */
export const campaignsRouter = router({
  /**
   * Get all unique clients for the user's team
   */
  getClients: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) return [];
    const teamId = await getUserTeamId(ctx.user.id);
    if (!teamId) return [];

    const { data } = await supabase
      .from('campaigns')
      .select('client_id, client_name')
      .eq('team_id', teamId)
      .not('client_id', 'is', null)
      .order('client_name', { ascending: true });

    const clientMap = new Map();
    (data || []).forEach(item => {
      if (item.client_id && !clientMap.has(item.client_id)) {
        clientMap.set(item.client_id, {
          id: item.client_id,
          name: item.client_name || `عميل #${item.client_id.slice(0, 8)}`,
        });
      }
    });

    return Array.from(clientMap.values());
  }),

  /**
   * List campaigns for the user's team, optionally filtered by client_id
   */
  list: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        return [];
      }

      try {
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) {
          return [];
        }

        let query = supabase
          .from('campaigns')
          .select('*')
          .eq('team_id', teamId);

        if (input?.clientId) {
          query = query.eq('client_id', input.clientId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Failed to fetch campaigns:', error);
          return [];
        }

        return data || [];
      } catch (error) {
        console.error('Campaign list error:', error);
        return [];
      }
    }),

  /**
   * Create a new campaign
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'اسم الحملة مطلوب').max(255),
        description: z.string().optional(),
        type: z.string().default('combined'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('المستخدم غير مصرح');
      }

      try {
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) {
          throw new Error('لم يتم العثور على فريق');
        }

        const campaignId = randomUUID();

        const { data, error } = await supabase
          .from('campaigns')
          .insert({
            id: campaignId,
            team_id: teamId,
            name: input.name,
            description: input.description || null,
            status: 'draft',
            type: input.type,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`فشل إنشاء الحملة: ${error.message}`);
        }

        return data;
      } catch (error) {
        console.error('Campaign creation error:', error);
        throw error;
      }
    }),

  /**
   * Get a single campaign
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        return null;
      }

      try {
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) {
          return null;
        }

        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', input.id)
          .eq('team_id', teamId)
          .single();

        if (error) {
          return null;
        }

        return data || null;
      } catch (error) {
        console.error('Campaign get error:', error);
        return null;
      }
    }),

  /**
   * Update campaign status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('المستخدم غير مصرح');
      }

      try {
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) {
          throw new Error('لم يتم العثور على فريق');
        }

        const { data, error } = await supabase
          .from('campaigns')
          .update({ status: input.status })
          .eq('id', input.id)
          .eq('team_id', teamId)
          .select()
          .single();

        if (error) {
          throw new Error(`فشل تحديث الحملة: ${error.message}`);
        }

        return data;
      } catch (error) {
        console.error('Campaign update error:', error);
        throw error;
      }
    }),

  /**
   * Delete a campaign
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new Error('المستخدم غير مصرح');
      }

      try {
        const teamId = await getUserTeamId(ctx.user.id);
        if (!teamId) {
          throw new Error('لم يتم العثور على فريق');
        }

        const { error } = await supabase
          .from('campaigns')
          .delete()
          .eq('id', input.id)
          .eq('team_id', teamId);

        if (error) {
          throw new Error(`فشل حذف الحملة: ${error.message}`);
        }

        return { success: true };
      } catch (error) {
        console.error('Campaign delete error:', error);
        throw error;
      }
    }),
});
