import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { callClaude, type ClaudeTask } from '../lib/claude-client';
import { loadWasselContext } from '../lib/context-loader';

const PRICING_USD_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':            { input: 3,    output: 15 },
  'claude-haiku-4-5-20251001':    { input: 0.8,  output: 4 },
  'claude-opus-4-7':              { input: 15,   output: 75 },
};

const DEFAULT_USD_SAR_RATE = 3.75;
let cachedUsdSar: { value: number; loadedAt: number } | null = null;
const SAR_RATE_TTL_MS = 60 * 60 * 1000;

let cachedAdmin: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Supabase service-role credentials missing');
  cachedAdmin = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdmin;
}

async function getUsdSarRate(): Promise<number> {
  const now = Date.now();
  if (cachedUsdSar && now - cachedUsdSar.loadedAt < SAR_RATE_TTL_MS) {
    return cachedUsdSar.value;
  }
  try {
    const { data } = await getAdminClient()
      .from('system_settings')
      .select('value')
      .eq('key', 'usd_sar_rate')
      .maybeSingle();
    const raw = data?.value;
    const n = typeof raw === 'number' ? raw : Number(raw);
    const value = Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_SAR_RATE;
    cachedUsdSar = { value, loadedAt: now };
    return value;
  } catch {
    return DEFAULT_USD_SAR_RATE;
  }
}

export interface AgentClaudeCallOpts {
  agentId: string;
  taskId?: string | null;
  purpose: string;
  task: ClaudeTask;
  system: string;
  userContent: string | Array<{ type: string; [k: string]: any }>;
  maxTokens?: number;
  temperature?: number;
  modelOverride?: string;
  injectContext?: boolean;
}

export interface AgentClaudeCallResult {
  text: string;
  rawResponse: any;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costSar: number;
}

export async function callClaudeForAgent(opts: AgentClaudeCallOpts): Promise<AgentClaudeCallResult> {
  const inject = opts.injectContext ?? true;
  const context = inject ? await loadWasselContext() : '';
  const system = inject
    ? `${context}\n\n---\n\n${opts.system}`
    : opts.system;

  const response = await callClaude({
    task: opts.task,
    system,
    userContent: opts.userContent,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    modelOverride: opts.modelOverride,
  });

  const text = (response.content || [])
    .map((c) => (c.type === 'text' ? c.text || '' : ''))
    .join('');

  const model = response.model || opts.modelOverride || '';
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  const pricing = PRICING_USD_PER_M_TOKENS[model] || PRICING_USD_PER_M_TOKENS['claude-sonnet-4-6'];
  const costUsd = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  const sarRate = await getUsdSarRate();
  const costSar = costUsd * sarRate;

  try {
    await getAdminClient().from('agent_cost_log').insert({
      agent_id: opts.agentId,
      task_id: opts.taskId ?? null,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Number(costUsd.toFixed(6)),
      cost_sar: Number(costSar.toFixed(4)),
      purpose: opts.purpose,
    });
  } catch (err: any) {
    console.error('[cost-tracker] log insert failed:', err?.message || err);
  }

  return {
    text,
    rawResponse: response,
    model,
    inputTokens,
    outputTokens,
    costUsd,
    costSar,
  };
}

export async function getAgentMonthlySpend(agentId: string): Promise<{ tokens: number; costSar: number; costUsd: number }> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data } = await getAdminClient()
    .from('agent_cost_log')
    .select('input_tokens, output_tokens, cost_usd, cost_sar')
    .eq('agent_id', agentId)
    .gte('created_at', monthStart.toISOString());

  const rows = (data || []) as Array<{ input_tokens: number; output_tokens: number; cost_usd: number; cost_sar: number }>;
  const tokens = rows.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
  const costSar = rows.reduce((s, r) => s + Number(r.cost_sar || 0), 0);
  const costUsd = rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  return { tokens, costSar, costUsd };
}
