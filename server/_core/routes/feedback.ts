import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { sendTicketResponseEmail, shouldSendTransactional } from '../lib/email';

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

export const feedbackRouter = router({
  submit: protectedProcedure
    .input(z.object({
      category: z.enum(['bug', 'feature', 'question', 'other']),
      subject: z.string().min(1).max(200),
      description: z.string().min(1).max(5000),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
      pageUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log('[FEEDBACK] Submitting ticket from user:', ctx.user.id);
      const { data, error } = await ctx.supabase
        .from('feedback_tickets')
        .insert([{
          user_id: ctx.user.id,
          category: input.category,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          page_url: input.pageUrl || null,
        }])
        .select()
        .single();
      if (error) {
        console.error('[FEEDBACK] Insert error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      console.log('[FEEDBACK] Ticket created:', data.id);
      return data;
    }),

  myTickets: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('feedback_tickets')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data || [];
  }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    const { data: tickets, error } = await ctx.supabase
      .from('feedback_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    if (!tickets || tickets.length === 0) return [];
    const userIds = Array.from(new Set(tickets.map((t: any) => t.user_id).filter(Boolean)));
    const { data: profiles } = await ctx.supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    return tickets.map((t: any) => ({ ...t, user: profileMap.get(t.user_id) || null }));
  }),

  respond: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      response: z.string().min(1),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const update: any = {
        admin_response: input.response,
        admin_id: ctx.user.id,
        updated_at: new Date().toISOString(),
      };
      if (input.status) update.status = input.status;

      const { data: ticket, error: fetchErr } = await ctx.supabase
        .from('feedback_tickets')
        .select('id, user_id, subject')
        .eq('id', input.id)
        .single();
      if (fetchErr || !ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });
      }

      const { error } = await ctx.supabase
        .from('feedback_tickets')
        .update(update)
        .eq('id', input.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      try {
        if (await shouldSendTransactional(ctx.supabase, (ticket as any).user_id)) {
          const { data: profile } = await ctx.supabase
            .from('profiles')
            .select('email, full_name, locale')
            .eq('id', (ticket as any).user_id)
            .single();
          if (profile?.email) {
            const result = await sendTicketResponseEmail({
              user: { email: profile.email, fullName: profile.full_name, language: profile.locale },
              ticketSubject: (ticket as any).subject,
              ticketId: (ticket as any).id,
              responseText: input.response,
            });
            console.log('[feedback.respond] email result:', result);
          }
        }
      } catch (e: any) {
        console.error('[feedback.respond] email send failed (non-fatal):', e?.message);
      }

      return { success: true };
    }),

  updateStatus: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from('feedback_tickets')
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq('id', input.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
