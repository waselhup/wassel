import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { logApiCall, mapAnthropicStatusToArabic } from '../lib/apiLogger';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

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

interface AgentDef {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  color: string;
  systemPrompt: string;
}

const AGENTS: Record<string, AgentDef> = {
  orchestrator: {
    id: 'orchestrator',
    nameAr: 'الموجّه',
    nameEn: 'Orchestrator',
    descAr: 'موجّه ذكي يرشدك لأفضل وكيل لسؤالك',
    descEn: "Intelligent router — points you to the right specialist",
    icon: 'Settings',
    color: '#0A8F84',
    systemPrompt:
      "You are Wassel's AI orchestrator. Wassel is an Arabic-first LinkedIn automation SaaS for the Saudi/GCC market. Users (admins) ask you questions about the platform. Help directly when simple. For complex questions, recommend the right specialist: Growth Strategist (user data, campaigns), Content Specialist (Arabic content quality), Campaign Optimizer (campaign performance), Support Copilot (user feedback responses), Data Analyst (metrics queries), or Product Advisor (feature prioritization). Be helpful, specific, and concise. Reply in the language of the question (Arabic or English).",
  },
  growth_strategist: {
    id: 'growth_strategist',
    nameAr: 'استراتيجي النمو',
    nameEn: 'Growth Strategist',
    descAr: 'يحلل سلوك المستخدمين ويقترح تكتيكات النمو',
    descEn: 'Analyzes user behavior and suggests growth tactics',
    icon: 'TrendingUp',
    color: '#0EA5E9',
    systemPrompt:
      "You are Wassel's Growth Strategist. Analyze our user base, suggest growth tactics, identify top users, predict churn, recommend features. Focus on the Saudi/GCC market dynamics. Always include Vision 2030 alignment opportunities where relevant. When you reference data, ask the admin to share specific numbers (you don't have direct DB access — you reason from what they tell you).",
  },
  content_specialist: {
    id: 'content_specialist',
    nameAr: 'متخصص المحتوى',
    nameEn: 'Content Specialist',
    descAr: 'يقيّم جودة المحتوى العربي المُنشأ بالذكاء الاصطناعي',
    descEn: 'Reviews AI-generated Arabic content for quality',
    icon: 'PenTool',
    color: '#8B5CF6',
    systemPrompt:
      "You are Wassel's Content Specialist. Evaluate AI-generated LinkedIn content (posts, messages, CV bullets). Check for: Modern Standard Arabic quality (no Gulf dialect), cultural fit for Saudi/GCC professional norms, Vision 2030 alignment where natural, clear hook, professional tone, length appropriateness for LinkedIn. Suggest specific improvements with before/after examples.",
  },
  campaign_optimizer: {
    id: 'campaign_optimizer',
    nameAr: 'محسّن الحملات',
    nameEn: 'Campaign Optimizer',
    descAr: 'يحلل أداء الحملات ويقترح تحسينات',
    descEn: 'Analyzes campaign performance and suggests optimizations',
    icon: 'Zap',
    color: '#F59E0B',
    systemPrompt:
      "You are Wassel's Campaign Optimizer. Analyze LinkedIn outreach campaign performance. Suggest message tweaks, timing changes, audience filter refinements. Find patterns in what works for the Saudi/GCC professional audience. When the admin shares campaign data (open rates, reply rates, prospect details), give specific actionable recommendations.",
  },
  support_copilot: {
    id: 'support_copilot',
    nameAr: 'مساعد الدعم',
    nameEn: 'Support Copilot',
    descAr: 'يصيغ ردوداً احترافية على ملاحظات المستخدمين',
    descEn: 'Drafts professional responses to user feedback',
    icon: 'MessageCircle',
    color: '#10B981',
    systemPrompt:
      "You are Wassel's Support Copilot. Draft professional, empathetic, Arabic-first responses to user feedback (complaints, feature requests, bugs). Keep tone warm but professional. Acknowledge the issue, explain what's happening (if known), commit to action with realistic timing. Default to Arabic; switch to English if the user wrote in English.",
  },
  data_analyst: {
    id: 'data_analyst',
    nameAr: 'محلل البيانات',
    nameEn: 'Data Analyst',
    descAr: 'يجيب على الأسئلة حول مقاييس المنصة',
    descEn: 'Answers questions about platform metrics',
    icon: 'BarChart',
    color: '#6366F1',
    systemPrompt:
      "You are Wassel's Data Analyst. Help the admin answer business questions about Wassel: active users, token consumption, revenue, top features, churn, conversion. You don't have direct database access — when you need data, ask the admin for the specific metric or SQL query they should run. Then interpret the results. Suggest what to track and why.",
  },
  product_advisor: {
    id: 'product_advisor',
    nameAr: 'مستشار المنتج',
    nameEn: 'Product Advisor',
    descAr: 'يقترح الميزات الأنسب بناءً على الملاحظات والاستخدام',
    descEn: 'Suggests features based on feedback and usage patterns',
    icon: 'Lightbulb',
    color: '#EC4899',
    systemPrompt:
      "You are Wassel's Product Advisor. Suggest the next 3 features to build based on user feedback patterns and behavior data the admin shares. Prioritize by impact-to-effort ratio. Focus on the Saudi/GCC LinkedIn marketing use case. Always justify recommendations with the user value and the strategic fit. Push back on low-impact ideas.",
  },
};

export const agentsRouter = router({
  list: adminProcedure.query(async () => {
    return Object.values(AGENTS).map((a) => ({
      id: a.id,
      nameAr: a.nameAr,
      nameEn: a.nameEn,
      descAr: a.descAr,
      descEn: a.descEn,
      icon: a.icon,
      color: a.color,
    }));
  }),

  startConversation: adminProcedure
    .input(z.object({ agentId: z.string(), title: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const agent = AGENTS[input.agentId];
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown agent' });

      const title =
        input.title || `${agent.nameAr} — ${new Date().toLocaleDateString('en-CA')}`;

      const { data, error } = await ctx.supabase
        .from('agent_conversations')
        .insert([
          {
            admin_user_id: ctx.user.id,
            agent_id: input.agentId,
            title,
          },
        ])
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  listConversations: adminProcedure
    .input(z.object({ agentId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      let q = ctx.supabase
        .from('agent_conversations')
        .select('*')
        .eq('admin_user_id', ctx.user.id)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (input.agentId) q = q.eq('agent_id', input.agentId);
      const { data, error } = await q;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  getConversation: adminProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { data: conv, error: convErr } = await ctx.supabase
        .from('agent_conversations')
        .select('*')
        .eq('id', input.conversationId)
        .eq('admin_user_id', ctx.user.id)
        .single();
      if (convErr || !conv) throw new TRPCError({ code: 'NOT_FOUND' });

      const { data: messages } = await ctx.supabase
        .from('agent_messages')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .order('created_at', { ascending: true });

      return { conversation: conv, messages: messages || [] };
    }),

  sendMessage: adminProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        content: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ANTHROPIC_API_KEY) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'ANTHROPIC_API_KEY not configured',
        });
      }

      const { data: conv } = await ctx.supabase
        .from('agent_conversations')
        .select('*')
        .eq('id', input.conversationId)
        .eq('admin_user_id', ctx.user.id)
        .single();
      if (!conv) throw new TRPCError({ code: 'NOT_FOUND' });

      const agent = AGENTS[(conv as any).agent_id];
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent definition missing' });

      await ctx.supabase.from('agent_messages').insert([
        {
          conversation_id: input.conversationId,
          role: 'user',
          content: input.content,
        },
      ]);

      const { data: history } = await ctx.supabase
        .from('agent_messages')
        .select('role, content')
        .eq('conversation_id', input.conversationId)
        .order('created_at', { ascending: true });

      const { data: notes } = await ctx.supabase
        .from('agent_training_notes')
        .select('note')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: true });

      const trainingBlock =
        notes && notes.length > 0
          ? `\n\n## Training notes from admin (apply these always):\n${(notes as any[])
              .map((n, i) => `${i + 1}. ${n.note}`)
              .join('\n')}`
          : '';

      const fullSystem = agent.systemPrompt + trainingBlock;

      const messages = (history || [])
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      const _t0 = Date.now();
      let claudeRes: Response;
      try {
        claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: fullSystem,
            messages,
          }),
        });
      } catch (err: any) {
        await logApiCall({
          service: 'anthropic',
          endpoint: '/v1/messages:agents',
          statusCode: 500,
          responseTimeMs: Date.now() - _t0,
          errorMsg: err?.message,
          userId: ctx.user.id,
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Network error reaching Claude' });
      }

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        await logApiCall({
          service: 'anthropic',
          endpoint: '/v1/messages:agents',
          statusCode: claudeRes.status,
          responseTimeMs: Date.now() - _t0,
          errorMsg: errText,
          userId: ctx.user.id,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: mapAnthropicStatusToArabic(claudeRes.status),
        });
      }

      const claudeData = (await claudeRes.json()) as any;
      await logApiCall({
        service: 'anthropic',
        endpoint: '/v1/messages:agents',
        statusCode: 200,
        responseTimeMs: Date.now() - _t0,
        userId: ctx.user.id,
      });

      const reply: string = claudeData?.content?.[0]?.text || '';
      const inputTokens = claudeData?.usage?.input_tokens || 0;
      const outputTokens = claudeData?.usage?.output_tokens || 0;
      const tokensUsed = inputTokens + outputTokens;

      await ctx.supabase.from('agent_messages').insert([
        {
          conversation_id: input.conversationId,
          role: 'assistant',
          content: reply,
          tokens_used: tokensUsed,
        },
      ]);

      await ctx.supabase
        .from('agent_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.conversationId);

      return { content: reply, tokensUsed };
    }),

  deleteConversation: adminProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from('agent_conversations')
        .delete()
        .eq('id', input.conversationId)
        .eq('admin_user_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  listTrainingNotes: adminProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('agent_training_notes')
        .select('*')
        .eq('agent_id', input.agentId)
        .order('created_at', { ascending: false });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data || [];
    }),

  addTrainingNote: adminProcedure
    .input(
      z.object({
        agentId: z.string(),
        note: z.string().min(3).max(2000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from('agent_training_notes')
        .insert([
          {
            agent_id: input.agentId,
            note: input.note,
            added_by: ctx.user.id,
          },
        ])
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  deleteTrainingNote: adminProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from('agent_training_notes')
        .delete()
        .eq('id', input.noteId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
