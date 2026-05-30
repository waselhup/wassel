import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc-init';
import {
  listFaqs,
  startConversation,
  sendMessage,
  setAllowExtended,
  SupportError,
  VISITOR_AI_CAP,
  USER_AI_CAP_DEFAULT,
  USER_AI_CAP_EXTENDED,
} from '../lib/support-engine';

/**
 * Support / Customer-Service Chat router — Part 1 (backend only, no UI).
 *
 * Public (visitor + logged-in):
 *   - faqList            : the saved FAQ entries for the sequence UI.
 *   - startConversation  : creates a conversation row (visitor or user).
 *   - sendMessage        : FAQ-first → capped AI → handoff. Cost is controlled
 *                          SERVER-SIDE via support_conversations.ai_reply_count.
 *
 * Admin-only (UI-less here; the Admin inbox UI lands in Part 2):
 *   - admin.listConversations
 *   - admin.getConversation
 *   - admin.setAllowExtended   (raises a logged-in user's cap to 20)
 *
 * NOTE on auth: the public endpoints intentionally run as `publicProcedure` so
 * an anonymous landing-page visitor can chat. When the caller IS authenticated,
 * ctx.user is present and we bind the conversation to them + mode 'user'.
 * The cost cap is enforced from the DB, never from the client.
 */

function supportErrorToTrpc(err: unknown): TRPCError {
  if (err instanceof SupportError) {
    const codeMap: Record<SupportError['code'], TRPCError['code']> = {
      CONVERSATION_NOT_FOUND: 'NOT_FOUND',
      CONVERSATION_CLOSED: 'BAD_REQUEST',
      EMPTY_MESSAGE: 'BAD_REQUEST',
      MODEL_FAILED: 'INTERNAL_SERVER_ERROR',
      INTERNAL: 'INTERNAL_SERVER_ERROR',
    };
    return new TRPCError({
      code: codeMap[err.code] ?? 'INTERNAL_SERVER_ERROR',
      message: err.message,
      cause: err,
    });
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'Unknown error',
  });
}

// Admin gate — mirrors routes/admin.ts. is_admin === true or FORBIDDEN.
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  try {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', ctx.user.id)
      .single();
    if (!profile?.is_admin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }
    return next({ ctx });
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to verify admin status' });
  }
});

const AUDIENCE = z.enum(['all', 'visitor', 'user']);

export const supportRouter = router({
  /**
   * Public — saved FAQ entries (question + answer, ar/en) for the sequence UI.
   * Zero AI cost. Audience filters visitor-only / user-only entries when given.
   */
  faqList: publicProcedure
    .input(z.object({ audience: AUDIENCE.optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const faqs = await listFaqs(ctx.supabase, input?.audience ?? 'all');
        return {
          faqs: faqs.map((f) => ({
            id: f.id,
            question_ar: f.question_ar,
            question_en: f.question_en,
            answer_ar: f.answer_ar,
            answer_en: f.answer_en,
            display_order: f.display_order,
          })),
        };
      } catch (err) {
        throw supportErrorToTrpc(err);
      }
    }),

  /**
   * Public — create a conversation. If the caller is authenticated, the
   * conversation is bound to them as mode 'user'; otherwise mode 'visitor'.
   * The client may pass an opaque visitorId for anti-abuse correlation.
   */
  startConversation: publicProcedure
    .input(z.object({ visitorId: z.string().max(128).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      try {
        const isUser = !!ctx.user?.id;
        const conv = await startConversation(ctx.supabase, {
          mode: isUser ? 'user' : 'visitor',
          userId: isUser ? ctx.user!.id : null,
          visitorId: input?.visitorId ?? null,
        });
        return {
          conversationId: conv.id,
          mode: conv.mode,
          status: conv.status,
          aiReplyCount: conv.ai_reply_count,
          allowExtended: conv.allow_extended,
        };
      } catch (err) {
        throw supportErrorToTrpc(err);
      }
    }),

  /**
   * Public — the core endpoint. Stores the user message, tries FAQ first
   * (source:'faq', no AI), else checks the server-side cap (visitor 5;
   * user 5, or 20 iff admin allow_extended). On cap → source:'handoff',
   * status 'awaiting_admin', admin notified, NO AI call. Else → Haiku
   * (source:'ai') and the DB counter increments.
   */
  sendMessage: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        message: z.string().trim().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const out = await sendMessage(ctx.supabase, {
          conversationId: input.conversationId,
          message: input.message,
        });
        return out;
      } catch (err) {
        throw supportErrorToTrpc(err);
      }
    }),

  /** Caps, exposed so the client can render hints (not for enforcement). */
  caps: publicProcedure.query(() => ({
    visitor: VISITOR_AI_CAP,
    userDefault: USER_AI_CAP_DEFAULT,
    userExtended: USER_AI_CAP_EXTENDED,
  })),

  // ─── Admin (UI-less in Part 1; full inbox UI in Part 2) ──────────
  admin: router({
    /** List conversations, newest activity first. Optional status filter. */
    listConversations: adminProcedure
      .input(
        z
          .object({
            status: z.enum(['active', 'awaiting_admin', 'closed']).optional(),
            limit: z.number().int().positive().max(200).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        let q = ctx.supabase
          .from('support_conversations')
          .select('id, mode, user_id, status, ai_reply_count, allow_extended, last_message_at, created_at')
          .order('last_message_at', { ascending: false })
          .limit(input?.limit ?? 50);
        if (input?.status) q = q.eq('status', input.status);
        const { data, error } = await q;
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return { conversations: data ?? [] };
      }),

    /** Full transcript of one conversation. */
    getConversation: adminProcedure
      .input(z.object({ conversationId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const { data: conv, error: cErr } = await ctx.supabase
          .from('support_conversations')
          .select('*')
          .eq('id', input.conversationId)
          .maybeSingle();
        if (cErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: cErr.message });
        if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' });

        const { data: messages, error: mErr } = await ctx.supabase
          .from('support_messages')
          .select('id, role, source, content, faq_id, created_at')
          .eq('conversation_id', input.conversationId)
          .order('created_at', { ascending: true });
        if (mErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mErr.message });

        return { conversation: conv, messages: messages ?? [] };
      }),

    /** Raise/lower a conversation's cap (allow_extended → 20 replies for users). */
    setAllowExtended: adminProcedure
      .input(z.object({ conversationId: z.string().uuid(), allow: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const conv = await setAllowExtended(ctx.supabase, input.conversationId, input.allow);
          return {
            conversationId: conv.id,
            allowExtended: conv.allow_extended,
            status: conv.status,
          };
        } catch (err) {
          throw supportErrorToTrpc(err);
        }
      }),
  }),
});

export type SupportRouter = typeof supportRouter;
