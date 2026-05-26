import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import {
  startSession,
  endSession,
  getMorningBrief,
  sendMessage,
  getRecentTurns,
  recordDecision,
  getDecisionMemory,
  listPersonalities,
  generateWeeklyJournal,
  getWeeklyJournal,
  getAgentMemoryStats,
  getSessionStats,
  attachScreenContent,
} from '../lib/war-room-engine';
import { createClient } from '@supabase/supabase-js';

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

const LANGUAGES = ['ar', 'en'] as const;
const DECISION_TYPES = ['approve', 'reject', 'edit', 'approve_with_changes', 'ask_question', 'defer'] as const;
const CONTENT_TYPES = ['chart', 'table', 'text', 'image', 'funnel', 'kpi', 'comparison'] as const;

export const warRoomRouter = router({
  // ─────────────────────────────────────────────────────────────────
  // Personalities (8 rows, read-only for the room layout)
  // ─────────────────────────────────────────────────────────────────
  getPersonalities: adminProcedure.query(async () => {
    const personalities = await listPersonalities();
    return { personalities };
  }),

  // ─────────────────────────────────────────────────────────────────
  // Sessions
  // ─────────────────────────────────────────────────────────────────
  startSession: adminProcedure
    .input(z.object({
      language: z.enum(LANGUAGES).default('ar'),
      voiceEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = await startSession(ctx.user.id, input.language, input.voiceEnabled ?? false);
      return { sessionId };
    }),

  endSession: adminProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await endSession(input.sessionId);
      return { success: true };
    }),

  sessionStats: adminProcedure.query(async ({ ctx }) => {
    return getSessionStats(ctx.user.id);
  }),

  // ─────────────────────────────────────────────────────────────────
  // Morning brief — 8 agents speak in seat order
  // ─────────────────────────────────────────────────────────────────
  morningBrief: adminProcedure
    .input(z.object({ sessionId: z.string().uuid(), language: z.enum(LANGUAGES).default('ar') }))
    .mutation(async ({ ctx, input }) => {
      const briefs = await getMorningBrief(input.sessionId, ctx.user.id, input.language);
      return { briefs };
    }),

  // ─────────────────────────────────────────────────────────────────
  // Chat
  // ─────────────────────────────────────────────────────────────────
  sendMessage: adminProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      message: z.string().min(1).max(4000),
      language: z.enum(LANGUAGES).default('ar'),
      voiceEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await sendMessage({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        message: input.message,
        language: input.language,
      });
      return result;
    }),

  listMessages: adminProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      const turns = await getRecentTurns(input.sessionId, input.limit);
      return { turns };
    }),

  // ─────────────────────────────────────────────────────────────────
  // Decisions
  // ─────────────────────────────────────────────────────────────────
  recordDecision: adminProcedure
    .input(z.object({
      agentId: z.string(),
      conversationId: z.string().uuid().nullable().optional(),
      decisionType: z.enum(DECISION_TYPES),
      originalProposal: z.string().min(1),
      aliResponse: z.string().optional(),
      aliEdit: z.string().optional(),
      rejectionReason: z.string().optional(),
      topicTags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await recordDecision({
        userId: ctx.user.id,
        agentId: input.agentId,
        conversationId: input.conversationId ?? null,
        decisionType: input.decisionType,
        originalProposal: input.originalProposal,
        aliResponse: input.aliResponse,
        aliEdit: input.aliEdit,
        rejectionReason: input.rejectionReason,
        topicTags: input.topicTags,
      });
      return { id };
    }),

  getDecisionMemory: adminProcedure
    .input(z.object({
      agentId: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
      topicTags: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const decisions = await getDecisionMemory(ctx.user.id, input.agentId, input.limit, input.topicTags);
      return { decisions };
    }),

  agentMemoryStats: adminProcedure.query(async ({ ctx }) => {
    const counts = await getAgentMemoryStats(ctx.user.id);
    return { counts };
  }),

  // ─────────────────────────────────────────────────────────────────
  // Projector
  // ─────────────────────────────────────────────────────────────────
  attachScreenContent: adminProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      contentType: z.enum(CONTENT_TYPES),
      titleAr: z.string().optional(),
      titleEn: z.string().optional(),
      payload: z.record(z.any()),
      displayDurationSeconds: z.number().int().min(1).max(600).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await attachScreenContent({
        conversationId: input.conversationId,
        contentType: input.contentType,
        titleAr: input.titleAr,
        titleEn: input.titleEn,
        payload: input.payload,
        displayDurationSeconds: input.displayDurationSeconds,
      });
      return { id };
    }),

  getScreenContent: adminProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ input }) => {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await admin
        .from('war_room_screen_content')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .order('created_at', { ascending: false });
      return { content: data || [] };
    }),

  // ─────────────────────────────────────────────────────────────────
  // Weekly journal
  // ─────────────────────────────────────────────────────────────────
  weeklyJournal: adminProcedure
    .input(z.object({ weekStart: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const journal = await getWeeklyJournal(ctx.user.id, input?.weekStart);
      return { journal };
    }),

  generateWeeklyJournal: adminProcedure
    .input(z.object({ language: z.enum(LANGUAGES).default('ar') }).optional())
    .mutation(async ({ ctx, input }) => {
      const result = await generateWeeklyJournal(ctx.user.id, input?.language ?? 'ar');
      return result;
    }),
});
