import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc-init';
import { loadWasselContext, updateWasselContext } from '../lib/context-loader';
import { sayed } from '../agents/sayed';
import type { BaseAgent } from '../agents/base';

const dayMs = 24 * 60 * 60 * 1000;

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

const APPROVAL_MODES = ['approval_required', 'suggest_only', 'auto_with_bounds', 'auto'] as const;
const AGENT_REGISTRY: Record<string, BaseAgent> = { sayed };

export const farisRouter = router({
  listAgents: adminProcedure.query(async ({ ctx }) => {
    const { data: agents } = await ctx.supabase
      .from('agents')
      .select('*')
      .order('portal', { ascending: true });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const enriched = await Promise.all((agents || []).map(async (a: any) => {
      const [{ data: costRows }, { data: pendingCount }, { data: completedCount }] = await Promise.all([
        ctx.supabase.from('agent_cost_log').select('input_tokens, output_tokens, cost_sar').eq('agent_id', a.id).gte('created_at', monthStartIso),
        ctx.supabase.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('agent_id', a.id).eq('status', 'pending'),
        ctx.supabase.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('agent_id', a.id).in('status', ['approved', 'edited_approved', 'completed']).gte('created_at', monthStartIso),
      ]) as any[];
      const rows = (costRows || []) as Array<{ input_tokens: number; output_tokens: number; cost_sar: number }>;
      const tokensThisMonth = rows.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
      const costSarThisMonth = rows.reduce((s, r) => s + Number(r.cost_sar || 0), 0);
      return {
        ...a,
        tokens_this_month: tokensThisMonth,
        cost_sar_this_month: Number(costSarThisMonth.toFixed(2)),
        pending_tasks: (pendingCount as any)?.count ?? 0,
        completed_this_month: (completedCount as any)?.count ?? 0,
        over_budget: tokensThisMonth > (a.monthly_token_budget || 0),
      };
    }));

    return enriched;
  }),

  getApprovalQueue: adminProcedure
    .input(z.object({
      filter: z.enum(['pending', 'edited', 'executing', 'all']).default('pending'),
      agentId: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const filter = input?.filter ?? 'pending';
      const limit = input?.limit ?? 50;
      let q = ctx.supabase.from('agent_tasks').select('*').order('created_at', { ascending: false }).limit(limit);
      if (filter === 'pending') q = q.eq('status', 'pending');
      else if (filter === 'edited') q = q.eq('status', 'edited_approved');
      else if (filter === 'executing') q = q.in('status', ['executing', 'approved']);
      if (input?.agentId) q = q.eq('agent_id', input.agentId);
      const { data } = await q;
      return { rows: data || [] };
    }),

  getTask: adminProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: task, error } = await ctx.supabase
        .from('agent_tasks')
        .select('*')
        .eq('id', input.taskId)
        .single();
      if (error || !task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      const { data: args } = await ctx.supabase
        .from('agent_arguments')
        .select('*')
        .eq('task_id', input.taskId)
        .order('turn_number', { ascending: true });
      return { task, arguments: args || [] };
    }),

  approveTask: adminProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      editedPayload: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const edited = !!input.editedPayload;
      const { error } = await ctx.supabase
        .from('agent_tasks')
        .update({
          status: edited ? 'edited_approved' : 'approved',
          edited_payload: input.editedPayload ?? null,
          approved_by: ctx.user.email || ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.taskId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      const { data: task } = await ctx.supabase
        .from('agent_tasks')
        .select('id, task_type, payload, edited_payload, related_resource_id, agent_id')
        .eq('id', input.taskId)
        .single();

      if (task?.task_type === 'social_post') {
        await ctx.supabase
          .from('content_calendar')
          .update({ status: 'approved' })
          .eq('task_id', input.taskId);
      }
      if (task?.task_type === 'ad_campaign' && task.related_resource_id) {
        await ctx.supabase
          .from('ad_campaigns')
          .update({ status: 'active', started_at: new Date().toISOString() })
          .eq('id', task.related_resource_id);
      }
      await ctx.supabase
        .from('agent_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', input.taskId);

      return { success: true, taskId: input.taskId };
    }),

  rejectTask: adminProcedure
    .input(z.object({ taskId: z.string().uuid(), reason: z.string().min(2).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('agent_tasks')
        .update({
          status: 'rejected',
          rejection_reason: input.reason,
          approved_by: ctx.user.email || ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.taskId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      await ctx.supabase.from('content_calendar').update({ status: 'failed' }).eq('task_id', input.taskId);
      return { success: true };
    }),

  replyToArgue: adminProcedure
    .input(z.object({ taskId: z.string().uuid(), message: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const { data: task } = await ctx.supabase
        .from('agent_tasks')
        .select('agent_id')
        .eq('id', input.taskId)
        .single();
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      const agent = AGENT_REGISTRY[task.agent_id];
      if (!agent) {
        await ctx.supabase.from('agent_arguments').insert({
          task_id: input.taskId,
          turn_number: 1,
          speaker: 'ali',
          message: input.message,
        });
        return { agentReply: null as string | null, note: 'Agent not wired yet for argue-mode response' };
      }
      const reply = await agent.respondToArgue(input.taskId, input.message);
      return { agentReply: reply };
    }),

  morningBrief: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const dayStart = new Date(now - dayMs).toISOString();
    const [
      { count: signups },
      { count: paid },
      { count: pending },
      adSpendRes,
    ] = await Promise.all([
      ctx.supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
      ctx.supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', dayStart),
      ctx.supabase.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ctx.supabase.from('ad_campaigns').select('total_spend_sar').gte('started_at', dayStart),
    ]) as any[];

    const adSpend = ((adSpendRes.data || []) as Array<{ total_spend_sar: number }>)
      .reduce((s, r) => s + Number(r.total_spend_sar || 0), 0);

    return {
      signups: signups || 0,
      paid: paid || 0,
      pending: pending || 0,
      adSpendSar: Number(adSpend.toFixed(2)),
      generatedAt: new Date().toISOString(),
    };
  }),

  dailyVitals: adminProcedure.query(async ({ ctx }) => {
    const now = Date.now();
    const dayStart = new Date(now - dayMs).toISOString();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthIso = monthStart.toISOString();

    const [
      { count: signups },
      { count: paid },
      { count: pending },
      mrrRes,
      costRes,
      adSpendRes,
      errorsRes,
      churnRes,
    ] = await Promise.all([
      ctx.supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
      ctx.supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', dayStart),
      ctx.supabase.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ctx.supabase.from('subscriptions').select('monthly_amount_sar').eq('status', 'active'),
      ctx.supabase.from('agent_cost_log').select('cost_sar').gte('created_at', dayStart),
      ctx.supabase.from('ad_campaigns').select('total_spend_sar').gte('started_at', monthIso),
      ctx.supabase.from('api_logs').select('id', { count: 'exact', head: true }).gte('status_code', 500).gte('created_at', dayStart),
      ctx.supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'canceled').gte('canceled_at', monthIso),
    ]) as any[];

    const mrr = ((mrrRes.data || []) as Array<{ monthly_amount_sar: number }>)
      .reduce((s, r) => s + Number(r.monthly_amount_sar || 0), 0);
    const tokenSpend = ((costRes.data || []) as Array<{ cost_sar: number }>)
      .reduce((s, r) => s + Number(r.cost_sar || 0), 0);
    const adSpend = ((adSpendRes.data || []) as Array<{ total_spend_sar: number }>)
      .reduce((s, r) => s + Number(r.total_spend_sar || 0), 0);

    return {
      signupsToday: signups || 0,
      paidToday: paid || 0,
      mrrSar: Number(mrr.toFixed(2)),
      adSpendSar: Number(adSpend.toFixed(2)),
      pendingApprovals: pending || 0,
      agentTokenSpendSar: Number(tokenSpend.toFixed(2)),
      errors24h: errorsRes.count || 0,
      churnedThisMonth: churnRes.count || 0,
    };
  }),

  agentCostReport: adminProcedure
    .input(z.object({ agentId: z.string().optional(), days: z.number().int().min(1).max(90).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const since = new Date(Date.now() - days * dayMs).toISOString();
      let q = ctx.supabase
        .from('agent_cost_log')
        .select('agent_id, input_tokens, output_tokens, cost_usd, cost_sar, created_at')
        .gte('created_at', since);
      if (input?.agentId) q = q.eq('agent_id', input.agentId);
      const { data } = await q;
      const rows = (data || []) as Array<{ agent_id: string; input_tokens: number; output_tokens: number; cost_usd: number; cost_sar: number }>;

      const byAgent = new Map<string, { tokens: number; costUsd: number; costSar: number; calls: number }>();
      for (const r of rows) {
        const k = r.agent_id;
        const acc = byAgent.get(k) || { tokens: 0, costUsd: 0, costSar: 0, calls: 0 };
        acc.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
        acc.costUsd += Number(r.cost_usd || 0);
        acc.costSar += Number(r.cost_sar || 0);
        acc.calls += 1;
        byAgent.set(k, acc);
      }
      const breakdown = Array.from(byAgent.entries()).map(([agentId, v]) => ({
        agentId,
        tokens: v.tokens,
        calls: v.calls,
        costUsd: Number(v.costUsd.toFixed(4)),
        costSar: Number(v.costSar.toFixed(2)),
      }));

      return {
        sinceDays: days,
        breakdown,
        totalCostSar: Number(breakdown.reduce((s, b) => s + b.costSar, 0).toFixed(2)),
        totalCostUsd: Number(breakdown.reduce((s, b) => s + b.costUsd, 0).toFixed(4)),
      };
    }),

  readContextFile: adminProcedure.query(async () => {
    const content = await loadWasselContext(true);
    return { content };
  }),

  updateContextFile: adminProcedure
    .input(z.object({ content: z.string().min(50).max(50000) }))
    .mutation(async ({ input }) => {
      await updateWasselContext(input.content);
      return { success: true };
    }),

  toggleAgentMode: adminProcedure
    .input(z.object({ agentId: z.string(), mode: z.enum(APPROVAL_MODES) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('agents')
        .update({ approval_mode: input.mode, updated_at: new Date().toISOString() })
        .eq('id', input.agentId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  updateAgentBudget: adminProcedure
    .input(z.object({ agentId: z.string(), monthlyTokenBudget: z.number().int().min(0).max(100_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('agents')
        .update({ monthly_token_budget: input.monthlyTokenBudget, updated_at: new Date().toISOString() })
        .eq('id', input.agentId);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
