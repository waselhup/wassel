/**
 * Executor agent tools — the ONLY actions a Claude-driven agent can perform.
 *
 * Each tool is an allowlist entry. New capabilities require a new entry here
 * AND a corresponding permission in an agent's `allowed_tools` array in the DB.
 *
 * Tools flagged `requiresConfirmation` create an `agent_actions` row with
 * status='pending' and return to the UI for admin approval before executing.
 * Tools without the flag execute immediately and stream results back to Claude.
 *
 * Safety principles:
 *  - Tools may only read aggregated / admin-scoped data.
 *  - Outbound emails only go to registered Wassel users (look up by userId).
 *  - No SQL UPDATE/DELETE outside this allowlist.
 *  - Token grants are capped per-call; admin must approve.
 *  - Every execution is logged in agent_actions BEFORE mutations run.
 */

import { sendTokenGrantEmail, sendCampaignEmail } from './email';

export interface ToolContext {
  supabase: any; // service-role client
  userId: string; // the admin invoking
  conversationId?: string;
  agentId?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  requiresConfirmation: boolean;
  inputSchema: Record<string, any>; // Claude tool input_schema (JSON Schema)
  execute: (input: any, ctx: ToolContext) => Promise<any>;
}

/* ---------- utilities ---------- */

function s(v: any, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

async function fetchUserById(supabase: any, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, locale, token_balance')
    .eq('id', userId)
    .single();
  return data;
}

/* ---------- tool implementations ---------- */

const queryPlatformData: ToolDef = {
  name: 'queryPlatformData',
  description:
    "Answer a business question from the Wassel database. Returns aggregated stats with NO personally-identifying information. Examples of valid questions: 'How many users signed up this week?', 'Top 5 industries in our companies directory', 'Total tokens consumed today', 'Open tickets count by priority'. The tool decides which safe, pre-registered query to run. It never returns raw user data.",
  requiresConfirmation: false,
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Plain-English business question about platform metrics.',
      },
    },
    required: ['question'],
  },
  execute: async (input, ctx) => {
    const q = s(input.question).toLowerCase();
    const sb = ctx.supabase;

    // Pattern-matching over a safe allowlist of queries.
    try {
      if (q.includes('signup') || q.includes('new user') || q.includes('سجل') || q.includes('مستخدمين جدد')) {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since);
        const { count: total } = await sb.from('profiles').select('id', { count: 'exact', head: true });
        return { metric: 'signups_last_7_days', value: data?.length ?? 0, total_users: total ?? 0 };
      }
      if (q.includes('token') && (q.includes('consume') || q.includes('used') || q.includes('usage') || q.includes('استهلاك'))) {
        const { data } = await sb
          .from('token_transactions')
          .select('amount')
          .lt('amount', 0)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        const total = (data || []).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);
        return { metric: 'tokens_consumed_last_30d', value: total };
      }
      if (q.includes('ticket') || q.includes('feedback') || q.includes('تذك')) {
        const { data } = await sb
          .from('feedback_tickets')
          .select('status, priority');
        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        (data || []).forEach((t: any) => {
          byStatus[t.status || 'unknown'] = (byStatus[t.status || 'unknown'] || 0) + 1;
          byPriority[t.priority || 'unknown'] = (byPriority[t.priority || 'unknown'] || 0) + 1;
        });
        return { metric: 'tickets_breakdown', total: data?.length || 0, by_status: byStatus, by_priority: byPriority };
      }
      if (q.includes('campaign')) {
        const { data } = await sb.from('email_campaigns').select('status');
        const byStatus: Record<string, number> = {};
        (data || []).forEach((c: any) => {
          byStatus[c.status || 'unknown'] = (byStatus[c.status || 'unknown'] || 0) + 1;
        });
        return { metric: 'campaigns_breakdown', total: data?.length || 0, by_status: byStatus };
      }
      if (q.includes('compan') || q.includes('شرك')) {
        const { data } = await sb.from('saudi_companies').select('industry, size');
        const byIndustry: Record<string, number> = {};
        const bySize: Record<string, number> = {};
        (data || []).forEach((c: any) => {
          byIndustry[c.industry || 'unknown'] = (byIndustry[c.industry || 'unknown'] || 0) + 1;
          bySize[c.size || 'unknown'] = (bySize[c.size || 'unknown'] || 0) + 1;
        });
        return { metric: 'companies_breakdown', total: data?.length || 0, by_industry: byIndustry, by_size: bySize };
      }
      if (q.includes('revenue') || q.includes('mrr') || q.includes('إيراد')) {
        const prices: Record<string, number> = { free: 0, starter: 99, pro: 199, elite: 299 };
        const { data } = await sb.from('profiles').select('plan');
        const mrr = (data || []).reduce((sum: number, p: any) => sum + (prices[p.plan] || 0), 0);
        return { metric: 'mrr', value: mrr, currency: 'SAR' };
      }
      // Fallback: give the agent a summary of what's available
      const { count: users } = await sb.from('profiles').select('id', { count: 'exact', head: true });
      const { count: campaigns } = await sb.from('email_campaigns').select('id', { count: 'exact', head: true });
      const { count: companies } = await sb.from('saudi_companies').select('id', { count: 'exact', head: true });
      const { count: tickets } = await sb.from('feedback_tickets').select('id', { count: 'exact', head: true });
      return {
        note: 'No specific pattern matched. Here is a platform summary.',
        totals: { users: users || 0, campaigns: campaigns || 0, companies: companies || 0, tickets: tickets || 0 },
      };
    } catch (e: any) {
      return { error: e?.message || 'Query failed' };
    }
  },
};

const sendEmailToUser: ToolDef = {
  name: 'sendEmailToUser',
  description:
    'Send a transactional email to a registered Wassel user by userId. The email goes through the standard Resend pipeline. Only works for users that exist in our profiles table — not external addresses.',
  requiresConfirmation: true,
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The profiles.id (UUID) of the Wassel user.' },
      subject: { type: 'string', description: 'Email subject line.' },
      body: { type: 'string', description: 'Plain-text email body. Will be wrapped in the Wassel email template.' },
    },
    required: ['userId', 'subject', 'body'],
  },
  execute: async (input, ctx) => {
    const user = await fetchUserById(ctx.supabase, s(input.userId));
    if (!user?.email) return { error: 'User not found or has no email' };

    const result = await sendCampaignEmail({
      to: user.email,
      subject: s(input.subject),
      body: s(input.body),
      unsubscribeToken: 'admin-sent-' + Date.now(), // marker; admin-sent mails aren't unsubscribable at row level
      dryRun: false,
    });
    return { success: result.success, messageId: result.messageId, error: result.error, sentTo: user.email };
  },
};

const grantTokensToUser: ToolDef = {
  name: 'grantTokensToUser',
  description:
    'Add tokens to a Wassel user balance. Capped at 10,000 per call. Logs to token_transactions with type=admin_grant. Sends the user an email.',
  requiresConfirmation: true,
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The profiles.id (UUID) of the Wassel user.' },
      amount: { type: 'integer', description: 'Token amount (positive integer ≤ 10000).' },
      reason: { type: 'string', description: 'Human-readable reason, e.g. "Compensation for bug #1234".' },
    },
    required: ['userId', 'amount', 'reason'],
  },
  execute: async (input, ctx) => {
    const amount = Math.min(10000, Math.max(1, Number(input.amount) | 0));
    const user = await fetchUserById(ctx.supabase, s(input.userId));
    if (!user) return { error: 'User not found' };

    const newBalance = (user.token_balance || 0) + amount;
    const { error: updErr } = await ctx.supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', user.id);
    if (updErr) return { error: updErr.message };

    await ctx.supabase.from('token_transactions').insert([
      {
        user_id: user.id,
        amount,
        type: 'admin_grant',
        description: s(input.reason) + ' (via executor agent)',
      },
    ]);

    // Best-effort email
    sendTokenGrantEmail({
      user: { email: user.email, fullName: user.full_name, language: user.locale },
      amount,
      reason: s(input.reason),
      newBalance,
    }).catch((e) => console.error('[grantTokens] email failed:', e?.message));

    return { success: true, userEmail: user.email, amountGranted: amount, newBalance };
  },
};

const generateDailyReport: ToolDef = {
  name: 'generateDailyReport',
  description:
    'Produce a concise daily ops report: signups, token consumption, campaigns launched, tickets opened, errors. Read-only.',
  requiresConfirmation: false,
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  execute: async (_input, ctx) => {
    const sb = ctx.supabase;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const [signupsToday, signupsYesterday, campaignsToday, ticketsToday, tokensConsumed] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
      sb.from('email_campaigns').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      sb.from('feedback_tickets').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      sb.from('token_transactions').select('amount').lt('amount', 0).gte('created_at', todayStart.toISOString()),
    ]);
    const tokens = (tokensConsumed.data || []).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

    return {
      date: todayStart.toISOString().slice(0, 10),
      signups_today: signupsToday.count || 0,
      signups_yesterday: signupsYesterday.count || 0,
      campaigns_created_today: campaignsToday.count || 0,
      tickets_opened_today: ticketsToday.count || 0,
      tokens_consumed_today: tokens,
    };
  },
};

const addCompanyToDatabase: ToolDef = {
  name: 'addCompanyToDatabase',
  description:
    'Add a new Saudi company to the saudi_companies directory. Requires admin confirmation before insert.',
  requiresConfirmation: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      name_ar: { type: 'string' },
      website: { type: 'string', description: 'Domain like aramco.com (no https://).' },
      industry: { type: 'string' },
      city: { type: 'string' },
      size: { type: 'string', enum: ['startup', 'small', 'medium', 'large', 'enterprise'] },
      primary_email: { type: 'string' },
    },
    required: ['name', 'website'],
  },
  execute: async (input, ctx) => {
    const { data, error } = await ctx.supabase
      .from('saudi_companies')
      .insert([
        {
          name: s(input.name),
          name_ar: s(input.name_ar) || null,
          website: s(input.website),
          industry: s(input.industry) || null,
          city: s(input.city) || 'Riyadh',
          size: s(input.size) || 'medium',
          primary_email: s(input.primary_email) || null,
          source: 'executor-agent',
          verified: false,
        },
      ])
      .select()
      .single();
    if (error) return { error: error.message };
    return { success: true, company: data };
  },
};

const draftTicketResponse: ToolDef = {
  name: 'draftTicketResponse',
  description:
    'Draft a response to a user feedback ticket. Returns the draft text; the admin reviews and approves separately. Does not send anything.',
  requiresConfirmation: false,
  inputSchema: {
    type: 'object',
    properties: {
      ticketId: { type: 'string', description: 'feedback_tickets.id (UUID).' },
    },
    required: ['ticketId'],
  },
  execute: async (input, ctx) => {
    const { data: ticket } = await ctx.supabase
      .from('feedback_tickets')
      .select('id, subject, description, category, priority, locale, user_id')
      .eq('id', s(input.ticketId))
      .single();
    if (!ticket) return { error: 'Ticket not found' };

    if (!process.env.ANTHROPIC_API_KEY) {
      return { error: 'ANTHROPIC_API_KEY not configured' };
    }

    const isAr = (ticket.locale || 'ar') === 'ar';
    const sys = isAr
      ? 'أنت عضو في فريق دعم وصّل. اكتب رداً متعاطفاً واحترافياً بالعربية.'
      : 'You are a Wassel support team member. Write an empathetic, professional response in English.';
    const user = `Ticket subject: ${ticket.subject}\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\nBody: ${ticket.description}\n\nDraft a 3-6 sentence response.`;

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: sys,
          messages: [{ role: 'user', content: user }],
        }),
      });
      const j = (await r.json()) as any;
      const draft = j?.content?.[0]?.text || '';
      return { draft, ticketId: ticket.id, language: isAr ? 'ar' : 'en' };
    } catch (e: any) {
      return { error: e?.message || 'Claude call failed' };
    }
  },
};

const pauseCampaign: ToolDef = {
  name: 'pauseCampaign',
  description: 'Pause a running campaign (status → paused). Requires confirmation.',
  requiresConfirmation: true,
  inputSchema: {
    type: 'object',
    properties: {
      campaignId: { type: 'string', description: 'email_campaigns.id (UUID).' },
      reason: { type: 'string' },
    },
    required: ['campaignId', 'reason'],
  },
  execute: async (input, ctx) => {
    const { data, error } = await ctx.supabase
      .from('email_campaigns')
      .update({ status: 'paused' })
      .eq('id', s(input.campaignId))
      .select('id, campaign_name, status')
      .single();
    if (error) return { error: error.message };
    return { success: true, campaign: data, reason: s(input.reason) };
  },
};

const broadcastAnnouncementToUsers: ToolDef = {
  name: 'broadcastAnnouncementToUsers',
  description:
    'Create a platform announcement shown to matching users as a banner. Inserts one row into platform_announcements — no emails sent.',
  requiresConfirmation: true,
  inputSchema: {
    type: 'object',
    properties: {
      message_ar: { type: 'string' },
      message_en: { type: 'string' },
      audience: { type: 'string', enum: ['all', 'active', 'pro'] },
      duration_hours: { type: 'integer', description: 'How long the banner shows; default 48h.' },
    },
    required: ['audience'],
  },
  execute: async (input, ctx) => {
    const dur = Math.max(1, Math.min(720, Number(input.duration_hours) || 48));
    const { data, error } = await ctx.supabase
      .from('platform_announcements')
      .insert([
        {
          message_ar: s(input.message_ar) || null,
          message_en: s(input.message_en) || null,
          audience: s(input.audience) || 'all',
          ends_at: new Date(Date.now() + dur * 60 * 60 * 1000).toISOString(),
          created_by: ctx.userId,
        },
      ])
      .select()
      .single();
    if (error) return { error: error.message };
    return { success: true, announcement: data };
  },
};

const exportDataAsCSV: ToolDef = {
  name: 'exportDataAsCSV',
  description:
    'Export a CSV snapshot for a data type. Returns a base64-encoded CSV blob. Options: users, campaigns, companies, tickets.',
  requiresConfirmation: false,
  inputSchema: {
    type: 'object',
    properties: {
      dataType: { type: 'string', enum: ['users', 'campaigns', 'companies', 'tickets'] },
    },
    required: ['dataType'],
  },
  execute: async (input, ctx) => {
    const type = s(input.dataType);
    const tables: Record<string, { table: string; columns: string[] }> = {
      users: { table: 'profiles', columns: ['id', 'email', 'full_name', 'plan', 'token_balance', 'created_at'] },
      campaigns: { table: 'email_campaigns', columns: ['id', 'campaign_name', 'status', 'total_recipients', 'emails_sent', 'created_at'] },
      companies: { table: 'saudi_companies', columns: ['id', 'name', 'industry', 'city', 'size', 'primary_email'] },
      tickets: { table: 'feedback_tickets', columns: ['id', 'subject', 'category', 'priority', 'status', 'created_at'] },
    };
    const spec = tables[type];
    if (!spec) return { error: 'Unknown dataType' };

    const { data, error } = await ctx.supabase.from(spec.table).select(spec.columns.join(',')).limit(5000);
    if (error) return { error: error.message };

    const lines: string[] = [spec.columns.join(',')];
    for (const row of data || []) {
      const r = row as Record<string, any>;
      lines.push(spec.columns.map((c) => JSON.stringify(r[c] ?? '')).join(','));
    }
    const csv = lines.join('\n');
    return {
      success: true,
      dataType: type,
      rows: data?.length || 0,
      csvBase64: Buffer.from(csv, 'utf8').toString('base64'),
      sizeBytes: csv.length,
    };
  },
};

/* ---------- registry ---------- */

export const AGENT_TOOLS: Record<string, ToolDef> = {
  queryPlatformData,
  sendEmailToUser,
  grantTokensToUser,
  generateDailyReport,
  addCompanyToDatabase,
  draftTicketResponse,
  pauseCampaign,
  broadcastAnnouncementToUsers,
  exportDataAsCSV,
};

export const TOOL_NAMES = Object.keys(AGENT_TOOLS);
