import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';

// Admin check middleware
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.user.id)
    .single();

  if (!profile?.is_admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const reviewsRouter = router({
  // Public: get approved reviews only
  list: publicProcedure.query(async ({ ctx }) => {
    console.log('[REVIEWS] Fetching approved reviews');
    const { data, error } = await ctx.supabase
      .from('reviews')
      .select('id, rating, comment, created_at, user_id')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[REVIEWS] List error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch reviews' });
    }

    // Get user display names for approved reviews
    const userIds = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    return (data || []).map((r: any) => ({
      ...r,
      user_name: profileMap[r.user_id]?.full_name || null,
      user_avatar: profileMap[r.user_id]?.avatar_url || null,
    }));
  }),

  // Protected: submit a review
  submit: protectedProcedure
    .input(z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(5).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log('[REVIEWS] Submitting review from user:', ctx.user.id);

      const { data, error } = await ctx.supabase
        .from('reviews')
        .insert([{
          user_id: ctx.user.id,
          rating: input.rating,
          comment: input.comment,
          status: 'pending',
        }])
        .select()
        .single();

      if (error) {
        console.error('[REVIEWS] Submit error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit review' });
      }

      console.log('[REVIEWS] Review submitted:', data?.id);
      return data;
    }),

  // Protected: get user's own reviews
  myReviews: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('reviews')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[REVIEWS] myReviews error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch your reviews' });
    }
    return data || [];
  }),

  // Admin: list all pending reviews
  listPending: adminProcedure.query(async ({ ctx }) => {
    console.log('[REVIEWS] Admin fetching pending reviews');
    const { data, error } = await ctx.supabase
      .from('reviews')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[REVIEWS] listPending error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch pending reviews' });
    }

    // Get user names
    const userIds = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    return (data || []).map((r: any) => ({
      ...r,
      user_name: profileMap[r.user_id]?.full_name || null,
      user_email: profileMap[r.user_id]?.email || null,
    }));
  }),

  // Admin: list ALL reviews (any status)
  listAll: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch reviews' });
    }

    const userIds = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    return (data || []).map((r: any) => ({
      ...r,
      user_name: profileMap[r.user_id]?.full_name || null,
      user_email: profileMap[r.user_id]?.email || null,
    }));
  }),

  // Admin: approve review
  approve: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      console.log('[REVIEWS] Admin approving review:', input.id);
      const { error } = await ctx.supabase
        .from('reviews')
        .update({
          status: 'approved',
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to approve review' });
      }
      return { success: true };
    }),

  // Admin: reject review
  reject: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      console.log('[REVIEWS] Admin rejecting review:', input.id);
      const { error } = await ctx.supabase
        .from('reviews')
        .update({ status: 'rejected' })
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reject review' });
      }
      return { success: true };
    }),

  // Admin: delete review
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      console.log('[REVIEWS] Admin deleting review:', input.id);
      const { error } = await ctx.supabase
        .from('reviews')
        .delete()
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete review' });
      }
      return { success: true };
    }),
});
