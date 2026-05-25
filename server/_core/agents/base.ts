import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadWasselContext } from '../lib/context-loader';
import { callClaudeForAgent, type AgentClaudeCallOpts, type AgentClaudeCallResult } from './cost-tracker';

let cachedAdmin: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Supabase service-role credentials missing');
  cachedAdmin = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdmin;
}

export type ApprovalMode = 'approval_required' | 'suggest_only' | 'auto_with_bounds' | 'auto';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface QueueTaskOpts {
  taskType: string;
  title: string;
  payload: Record<string, any>;
  preview?: Record<string, any>;
  priority?: TaskPriority;
  scheduledFor?: Date | string | null;
  estimatedTokenCost?: number;
  estimatedMoneyCostSar?: number;
  expectedImpact?: string;
  relatedResourceId?: string | null;
}

export abstract class BaseAgent {
  abstract readonly id: string;
  abstract readonly nameAr: string;
  abstract readonly nameEn: string;

  protected client(): SupabaseClient {
    return getAdminClient();
  }

  protected async loadContext(): Promise<string> {
    return loadWasselContext();
  }

  protected async callClaude(opts: Omit<AgentClaudeCallOpts, 'agentId'>): Promise<AgentClaudeCallResult> {
    return callClaudeForAgent({ ...opts, agentId: this.id });
  }

  async queueTask(opts: QueueTaskOpts): Promise<string> {
    const { data, error } = await this.client()
      .from('agent_tasks')
      .insert({
        agent_id: this.id,
        task_type: opts.taskType,
        title: opts.title,
        payload: opts.payload,
        preview: opts.preview ?? null,
        priority: opts.priority ?? 'normal',
        scheduled_for: opts.scheduledFor
          ? (opts.scheduledFor instanceof Date ? opts.scheduledFor.toISOString() : opts.scheduledFor)
          : null,
        estimated_token_cost: opts.estimatedTokenCost ?? null,
        estimated_money_cost_sar: opts.estimatedMoneyCostSar ?? null,
        expected_impact: opts.expectedImpact ?? null,
        related_resource_id: opts.relatedResourceId ?? null,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`queueTask failed: ${error?.message || 'no row returned'}`);
    return data.id as string;
  }

  async getApprovalMode(): Promise<ApprovalMode> {
    const { data } = await this.client()
      .from('agents')
      .select('approval_mode')
      .eq('id', this.id)
      .single();
    return (data?.approval_mode as ApprovalMode) || 'approval_required';
  }

  protected async appendArgument(taskId: string, speaker: 'agent' | 'ali', message: string, supportingData?: Record<string, any>): Promise<void> {
    const { data: existing } = await this.client()
      .from('agent_arguments')
      .select('turn_number')
      .eq('task_id', taskId)
      .order('turn_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextTurn = ((existing?.turn_number as number) || 0) + 1;
    await this.client().from('agent_arguments').insert({
      task_id: taskId,
      turn_number: nextTurn,
      speaker,
      message,
      supporting_data: supportingData ?? null,
    });
  }

  async respondToArgue(taskId: string, aliMessage: string): Promise<string> {
    await this.appendArgument(taskId, 'ali', aliMessage);
    const { data: task } = await this.client()
      .from('agent_tasks')
      .select('task_type, title, payload, edited_payload, expected_impact')
      .eq('id', taskId)
      .single();
    const { data: history } = await this.client()
      .from('agent_arguments')
      .select('speaker, message')
      .eq('task_id', taskId)
      .order('turn_number', { ascending: true });

    const historyBlock = (history || [])
      .map((h: any) => `${h.speaker === 'ali' ? 'Ali' : this.nameEn}: ${h.message}`)
      .join('\n');

    const reply = await this.callClaude({
      task: 'post_generate',
      purpose: 'argue_back',
      taskId,
      system: `You are ${this.nameEn} (${this.nameAr}), pushing back on Ali's edit with concrete data when warranted. Be direct, cite numbers when you can, never grovel. If Ali's edit is clearly better, agree and explain why. If your original was better, defend it with data. Reply in Ali's language. Keep it under 120 words.`,
      userContent: `Task: ${task?.title}\nType: ${task?.task_type}\nExpected impact: ${task?.expected_impact || 'unknown'}\n\nDiscussion so far:\n${historyBlock}\n\nYour response:`,
      maxTokens: 400,
    });
    const message = reply.text.trim();
    await this.appendArgument(taskId, 'agent', message);
    return message;
  }
}
