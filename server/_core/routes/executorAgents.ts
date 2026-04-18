import { z } from 'zod';
import { router, protectedProcedure } from '../trpc-init';
import { TRPCError } from '@trpc/server';
import { AGENT_TOOLS } from '../lib/agentTools';

const ADMIN_EMAILS = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];
const MODEL = 'claude-sonnet-4-6';

const AI_OPERATOR_HEADER = `You are an AI Operator (not an assistant) for Wassel, built on Anthropic Constitutional AI principles and standards from:
- MIT CSAIL — Autonomous Agent research
- Stanford HAI — Human-Centered AI Guidelines
- Anthropic — Responsible Scaling Policy
- DeepMind — Sparrow agent alignment

Operating principles:
1. Outcome-Driven (Dan Martell): every operation must have a clear 30-day outcome.
2. 10-80-10 Delegation: the user provides the vision (10%), you execute (80%), the user approves (10%).
3. Buy Back Your Time: every action must save a measurable amount of time.
4. Profit Lever focus: prioritize activities that drive revenue; deprioritize cosmetic content.
5. Silent execution: execute first; explain only when asked.

What you DO:
- Read the full context before taking any action.
- Verify prerequisites silently.
- Execute the full plan end-to-end.
- Return a single final report in the form:
  Done. [outcome achieved]
  Metrics: [time saved, cost saved, revenue impact]
  Verify: [URL or command for verification]

What you do NOT do:
- Do not ask mid-task questions.
- Do not request confirmations.
- Do not explain steps before executing.
- Never use: "Do you want", "Should I continue", "I need confirmation".

`;

async function ensureAdmin(ctx: any) {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('is_admin, email')
    .eq('id', ctx.user.id)
    .single();
  if (!profile?.is_admin && !ADMIN_EMAILS.includes(profile?.email || '')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
  }
}

async function getKillSwitch(ctx: any): Promise<boolean> {
  const { data } = await ctx.supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'executor_agents_enabled')
    .single();
  return data?.value !== false;
}

async function getRateLimit(ctx: any): Promise<number> {
  const { data } = await ctx.supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'executor_max_actions_per_admin_per_hour')
    .single();
  const v = Number(data?.value);
  return Number.isFinite(v) && v > 0 ? v : 50;
}

/**
 * Pack the Claude API tools array from an agent's allowed_tools whitelist.
 * Only tools that exist in AGENT_TOOLS are exposed.
 */
function buildToolsForAgent(allowed: string[]) {
  return allowed
    .map((name) => {
      const tool = AGENT_TOOLS[name];
      if (!tool) return null;
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      };
    })
    .filter(Boolean);
}

/**
 * Call Claude's /v1/messages with tools. Returns the raw response.
 */
async function callClaude(params: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  tools: any[];
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: params.system,
      messages: params.messages,
      tools: params.tools.length ? params.tools : undefined,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude API ${res.status}: ${txt.slice(0, 400)}`);
  }
  return (await res.json()) as any;
}

export const executorAgentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx);
    if (!(await getKillSwitch(ctx))) {
      return [];
    }
    const { data } = await ctx.supabase
      .from('executor_agents')
      .select('*')
      .eq('enabled', true)
      .order('id');
    return data || [];
  }),

  startConversation: protectedProcedure
    .input(z.object({ agentId: z.string(), title: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await ensureAdmin(ctx);
      const { data, error } = await ctx.supabase
        .from('executor_conversations')
        .insert([
          {
            agent_id: input.agentId,
            user_id: ctx.user.id,
            title: input.title || null,
          },
        ])
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  listConversations: protectedProcedure.query(async ({ ctx }) => {
    await ensureAdmin(ctx);
    const { data } = await ctx.supabase
      .from('executor_conversations')
      .select('id, agent_id, title, created_at, updated_at')
      .eq('user_id', ctx.user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    return data || [];
  }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await ensureAdmin(ctx);
      const { data: conversation } = await ctx.supabase
        .from('executor_conversations')
        .select('*')
        .eq('id', input.conversationId)
        .single();
      if (!conversation || conversation.user_id !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      const { data: messages } = await ctx.supabase
        .from('executor_messages')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .order('created_at');
      const { data: actions } = await ctx.supabase
        .from('agent_actions')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .order('created_at');
      return { conversation, messages: messages || [], actions: actions || [] };
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ensureAdmin(ctx);
      await ctx.supabase
        .from('executor_conversations')
        .delete()
        .eq('id', input.conversationId)
        .eq('user_id', ctx.user.id);
      return { ok: true };
    }),

  /**
   * Core pipeline. Sends the user's message to Claude with tool schema,
   * executes non-confirmation tools inline, creates pending action rows for
   * confirmation-required tools, and returns the assistant response.
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureAdmin(ctx);
      if (!(await getKillSwitch(ctx))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Executor agents disabled' });
      }

      // Rate limit check
      const limit = await getRateLimit(ctx);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentActions } = await ctx.supabase
        .from('agent_actions')
        .select('id', { count: 'exact', head: true })
        .eq('admin_user_id', ctx.user.id)
        .gte('created_at', oneHourAgo);
      if ((recentActions || 0) >= limit) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Rate limit: ${limit} actions/hour reached`,
        });
      }

      // Load conversation + agent + history
      const { data: conversation } = await ctx.supabase
        .from('executor_conversations')
        .select('id, agent_id, user_id')
        .eq('id', input.conversationId)
        .single();
      if (!conversation || conversation.user_id !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const { data: agent } = await ctx.supabase
        .from('executor_agents')
        .select('*')
        .eq('id', conversation.agent_id)
        .single();
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });

      const { data: prior } = await ctx.supabase
        .from('executor_messages')
        .select('role, content, tool_calls')
        .eq('conversation_id', input.conversationId)
        .order('created_at');

      // Save user message
      await ctx.supabase.from('executor_messages').insert([
        {
          conversation_id: input.conversationId,
          role: 'user',
          content: input.content,
        },
      ]);

      // Build Claude messages array from history + new user message
      const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
      for (const m of prior || []) {
        if (m.role === 'user') {
          messages.push({ role: 'user', content: m.content || '' });
        } else if (m.role === 'assistant') {
          messages.push({ role: 'assistant', content: m.content || '' });
        }
      }
      messages.push({ role: 'user', content: input.content });

      const allowedTools = Array.isArray(agent.allowed_tools) ? agent.allowed_tools : [];
      const tools = buildToolsForAgent(allowedTools);

      // Call Claude
      let response;
      try {
        response = await callClaude({ system: AI_OPERATOR_HEADER + '\n' + agent.system_prompt, messages, tools });
      } catch (e: any) {
        return { error: e?.message || 'Claude call failed', pendingActions: [] };
      }

      const contentBlocks = response.content || [];
      const textBlocks: string[] = [];
      const toolUseBlocks: Array<{ id: string; name: string; input: any }> = [];
      for (const block of contentBlocks) {
        if (block.type === 'text') textBlocks.push(block.text);
        if (block.type === 'tool_use') toolUseBlocks.push(block);
      }

      // Cap tool calls per message
      const MAX_TOOLS = 5;
      const capped = toolUseBlocks.slice(0, MAX_TOOLS);

      const pendingActions: any[] = [];
      const executedResults: Array<{ tool_use_id: string; content: any }> = [];

      for (const tu of capped) {
        const tool = AGENT_TOOLS[tu.name];
        if (!tool) continue;

        if (tool.requiresConfirmation) {
          const { data: actionRow } = await ctx.supabase
            .from('agent_actions')
            .insert([
              {
                conversation_id: input.conversationId,
                agent_id: agent.id,
                admin_user_id: ctx.user.id,
                tool_name: tu.name,
                tool_input: tu.input,
                status: 'pending',
                requires_confirmation: true,
              },
            ])
            .select()
            .single();
          pendingActions.push(actionRow);
        } else {
          try {
            const result = await tool.execute(tu.input, {
              supabase: ctx.supabase,
              userId: ctx.user.id,
              conversationId: input.conversationId,
              agentId: agent.id,
            });
            await ctx.supabase.from('agent_actions').insert([
              {
                conversation_id: input.conversationId,
                agent_id: agent.id,
                admin_user_id: ctx.user.id,
                tool_name: tu.name,
                tool_input: tu.input,
                tool_output: result,
                status: result?.error ? 'failed' : 'executed',
                requires_confirmation: false,
                executed_at: new Date().toISOString(),
                error_message: result?.error || null,
              },
            ]);
            executedResults.push({ tool_use_id: tu.id, content: JSON.stringify(result) });
          } catch (e: any) {
            executedResults.push({ tool_use_id: tu.id, content: JSON.stringify({ error: e?.message }) });
          }
        }
      }

      // If we executed any non-confirmation tools, feed results back to Claude for a final reply
      let finalText = textBlocks.join('\n\n');
      if (executedResults.length > 0) {
        const followupMessages = [...messages];
        followupMessages.push({ role: 'assistant', content: contentBlocks });
        followupMessages.push({
          role: 'user',
          content: executedResults.map((r) => ({
            type: 'tool_result',
            tool_use_id: r.tool_use_id,
            content: r.content,
          })),
        });
        try {
          const followup = await callClaude({ system: agent.system_prompt, messages: followupMessages, tools });
          const followupText = (followup.content || [])
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n\n');
          finalText = [finalText, followupText].filter(Boolean).join('\n\n');
        } catch (e: any) {
          finalText = finalText + `\n\n(tool-followup failed: ${e?.message})`;
        }
      }

      // Save assistant message
      await ctx.supabase.from('executor_messages').insert([
        {
          conversation_id: input.conversationId,
          role: 'assistant',
          content: finalText,
          tool_calls: capped.length ? capped : null,
        },
      ]);

      await ctx.supabase
        .from('executor_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.conversationId);

      return { content: finalText, pendingActions };
    }),

  approveAction: protectedProcedure
    .input(z.object({ actionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ensureAdmin(ctx);
      const { data: action } = await ctx.supabase
        .from('agent_actions')
        .select('*')
        .eq('id', input.actionId)
        .single();
      if (!action) throw new TRPCError({ code: 'NOT_FOUND' });
      if (action.admin_user_id !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      if (action.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Already ${action.status}` });
      }

      const tool = AGENT_TOOLS[action.tool_name];
      if (!tool) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown tool' });

      let result: any;
      try {
        result = await tool.execute(action.tool_input, {
          supabase: ctx.supabase,
          userId: ctx.user.id,
          conversationId: action.conversation_id,
          agentId: action.agent_id,
        });
      } catch (e: any) {
        result = { error: e?.message || 'Execution failed' };
      }

      const { data: updated } = await ctx.supabase
        .from('agent_actions')
        .update({
          tool_output: result,
          status: result?.error ? 'failed' : 'executed',
          approved_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          error_message: result?.error || null,
        })
        .eq('id', input.actionId)
        .select()
        .single();
      return updated;
    }),

  rejectAction: protectedProcedure
    .input(z.object({ actionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ensureAdmin(ctx);
      const { data } = await ctx.supabase
        .from('agent_actions')
        .update({ status: 'rejected' })
        .eq('id', input.actionId)
        .eq('admin_user_id', ctx.user.id)
        .select()
        .single();
      return data;
    }),

  listActions: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid().optional() }).optional())
    .query(async ({ input, ctx }) => {
      await ensureAdmin(ctx);
      let q = ctx.supabase
        .from('agent_actions')
        .select('*')
        .eq('admin_user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (input?.conversationId) q = q.eq('conversation_id', input.conversationId);
      const { data } = await q;
      return data || [];
    }),
});
