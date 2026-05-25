// Al-Mukhadram (المخضرم) — Customer Success agent.
// Welcomes, rescues, supports, flags VIPs. Owns email + WhatsApp sequences.
// Approval mode: approval_required.

import { BaseAgent } from './base';
import * as whatsapp from '../lib/whatsapp';

function safeJsonParse<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(trimmed) as T; } catch { return fallback; }
}

type Channel = 'whatsapp' | 'email';

export interface HealthScore {
  score: number;       // 0..100
  segment: 'hot_lead' | 'warm_lead' | 'active' | 'at_risk' | 'dormant' | 'churned' | 'vip';
  upgradePropensity: number; // 0..1
  churnRisk: number;          // 0..1
  signals: Record<string, any>;
}

export class AlMukhadramAgent extends BaseAgent {
  readonly id = 'al_mukhadram';
  readonly nameAr = 'المخضرم';
  readonly nameEn = 'Al-Mukhadram';

  /** Draft the welcome_7day bilingual onboarding sequence (Day 0/1/3/7). */
  async draftWelcomeSequence(): Promise<{ tasksCreated: number; sequenceId: string | null }> {
    const result = await this.callClaude({
      task: 'campaign_message',
      purpose: 'welcome_sequence_draft',
      system: `You are ${this.nameEn} (${this.nameAr}), Wassel's seasoned customer success lead. You write like a wise older Saudi colleague — warm, never pushy, always concrete. You write BOTH Arabic (primary) and English versions. Never mention Apify or scraping. Output STRICT JSON only.`,
      userContent: `Draft Wassel's welcome 7-day sequence — 4 steps (Day 0 welcome, Day 1 tip, Day 3 first-action nudge, Day 7 upgrade soft pitch).

For each step output BOTH channels (email + whatsapp) and BOTH languages (ar + en).

Return JSON:
{
  "steps": [
    {
      "day": 0,
      "email_subject_ar": "...",
      "email_subject_en": "...",
      "email_body_ar": "...",
      "email_body_en": "...",
      "whatsapp_body_ar": "...",
      "whatsapp_body_en": "..."
    },
    ...
  ]
}`,
      maxTokens: 4000,
      temperature: 0.6,
    });

    const parsed = safeJsonParse<{ steps: any[] }>(result.text, { steps: [] });
    const steps = parsed.steps || [];

    // Upsert sequence row with drafted steps as JSONB.
    const { data: seq } = await this.client()
      .from('email_sequences')
      .upsert({
        name: 'welcome_7day',
        description: 'Bilingual 7-day onboarding flow',
        trigger_event: 'signup',
        steps,
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'name' })
      .select('id')
      .single();

    // Queue one approval task per step so Ali can edit/approve.
    let tasksCreated = 0;
    for (const step of steps) {
      await this.queueTask({
        taskType: 'welcome_step',
        title: `Welcome Day ${step.day}: ${step.email_subject_ar?.slice(0, 50) || '(no subject)'}`,
        payload: { sequence_id: seq?.id || null, ...step },
        preview: {
          day: step.day,
          email_subject_ar: step.email_subject_ar,
          email_subject_en: step.email_subject_en,
          whatsapp_snippet_ar: (step.whatsapp_body_ar || '').slice(0, 120),
        },
        estimatedMoneyCostSar: result.costSar / Math.max(steps.length, 1),
        expectedImpact: 'Activation lift on Day ' + step.day,
      });
      tasksCreated++;
    }

    return { tasksCreated, sequenceId: seq?.id || null };
  }

  /**
   * Daily rescue: find dormant + free-trial-consumed users, draft a personalized
   * rescue message in their language. Returns the count of tasks queued.
   */
  async draftDailyRescues(limit = 25): Promise<{ tasksCreated: number; cohorts: { dormant: number; free_consumed: number } }> {
    const supabase = this.client();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

    // Cohort A: dormant ≥14d (no recent activity, has profile)
    const { data: dormant } = await supabase
      .from('profiles')
      .select('id, full_name, language, email, phone, last_active_at, plan, token_balance')
      .lt('last_active_at', fourteenDaysAgo)
      .order('last_active_at', { ascending: true })
      .limit(limit);

    // Cohort B: free-trial token balance == 0, free plan
    const { data: freeConsumed } = await supabase
      .from('profiles')
      .select('id, full_name, language, email, phone, plan, token_balance')
      .eq('plan', 'free')
      .lte('token_balance', 0)
      .limit(limit);

    const targets = [
      ...(dormant || []).map((p: any) => ({ ...p, cohort: 'dormant' })),
      ...(freeConsumed || []).map((p: any) => ({ ...p, cohort: 'free_consumed' })),
    ];

    let tasksCreated = 0;
    for (const t of targets) {
      const result = await this.callClaude({
        task: 'campaign_message',
        purpose: `rescue_${t.cohort}`,
        system: `You are ${this.nameEn} (${this.nameAr}). Write ONE rescue message in ${t.language === 'en' ? 'English' : 'Arabic'} (the user's language). Warm, concrete, no marketing tone. Surface ONE specific value Wassel can provide right now. Under 90 words. Output STRICT JSON.`,
        userContent: `User: ${t.full_name || '(no name)'} · cohort: ${t.cohort} · plan: ${t.plan} · tokens left: ${t.token_balance ?? 0}.

Output JSON:
{ "channel": "whatsapp"|"email", "subject_or_summary": "...", "body": "...", "language": "ar"|"en" }`,
        maxTokens: 600,
        temperature: 0.7,
      });
      const drafted = safeJsonParse<{ channel: Channel; subject_or_summary: string; body: string; language: string }>(
        result.text, { channel: 'email', subject_or_summary: 'We miss you on Wassel', body: result.text, language: t.language || 'ar' }
      );

      await this.queueTask({
        taskType: 'rescue_message',
        title: `Rescue ${t.cohort}: ${t.full_name || t.email || t.id}`,
        payload: { user_id: t.id, ...drafted },
        preview: {
          cohort: t.cohort,
          channel: drafted.channel,
          language: drafted.language,
          body_snippet: (drafted.body || '').slice(0, 150),
        },
        estimatedMoneyCostSar: result.costSar,
        expectedImpact: t.cohort === 'dormant' ? 'Reactivation' : 'Free → paid conversion',
      });
      tasksCreated++;
    }
    return { tasksCreated, cohorts: { dormant: (dormant || []).length, free_consumed: (freeConsumed || []).length } };
  }

  async draftSupportReply(opts: { userId: string; inboundMessage: string; channel: Channel }): Promise<{ taskId: string }> {
    const { data: user } = await this.client()
      .from('profiles')
      .select('full_name, language, plan, token_balance')
      .eq('id', opts.userId)
      .maybeSingle();

    const result = await this.callClaude({
      task: 'campaign_message',
      purpose: 'support_reply',
      system: `You are ${this.nameEn} (${this.nameAr}), Wassel's support lead. Write ONE reply in the user's language. Acknowledge, answer, offer next step. Never marketing. Output JSON.`,
      userContent: `User ${user?.full_name || opts.userId} (plan=${user?.plan || 'free'}, tokens=${user?.token_balance ?? 0}) wrote on ${opts.channel}:
"${opts.inboundMessage}"

Output: { "body": "...", "language": "ar"|"en", "follow_up_action": "..." | null }`,
      maxTokens: 600,
      temperature: 0.5,
    });
    const reply = safeJsonParse<{ body: string; language: string; follow_up_action: string | null }>(
      result.text, { body: result.text, language: user?.language || 'ar', follow_up_action: null }
    );
    const taskId = await this.queueTask({
      taskType: 'support_reply',
      title: `Support reply (${opts.channel}) → ${user?.full_name || opts.userId}`,
      payload: { user_id: opts.userId, channel: opts.channel, inbound: opts.inboundMessage, ...reply },
      preview: { channel: opts.channel, language: reply.language, body_snippet: reply.body.slice(0, 150) },
      estimatedMoneyCostSar: result.costSar,
      expectedImpact: 'Inbound resolution',
    });
    return { taskId };
  }

  async flagVipsForOutreach(): Promise<{ count: number }> {
    // VIPs = score ≥ 90 OR paid plan with high engagement.
    const { data } = await this.client()
      .from('user_health_scores')
      .select('user_id, score, segment, upgrade_propensity, signals')
      .eq('segment', 'vip')
      .order('score', { ascending: false })
      .limit(20);
    const vips = data || [];
    for (const v of vips) {
      await this.queueTask({
        taskType: 'vip_outreach_flag',
        title: `VIP outreach: ${v.user_id}`,
        payload: { user_id: v.user_id, score: v.score, signals: v.signals },
        preview: { score: v.score, segment: v.segment },
        priority: 'high',
        expectedImpact: 'Founder-led retention',
      });
    }
    return { count: vips.length };
  }

  async computeHealthScore(userId: string): Promise<HealthScore> {
    const supabase = this.client();
    const now = Date.now();
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, token_balance, last_active_at, created_at, linkedin_url')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return { score: 0, segment: 'churned', upgradePropensity: 0, churnRisk: 1, signals: {} };
    }

    const lastActiveDays = profile.last_active_at
      ? Math.floor((now - new Date(profile.last_active_at).getTime()) / 86400000)
      : 99;
    const signupAgeDays = profile.created_at
      ? Math.floor((now - new Date(profile.created_at).getTime()) / 86400000)
      : 0;

    // Activity features (Radar / CV / Posts) count
    const [{ count: radarCount }, { count: cvCount }, { count: postsCount }] = await Promise.all([
      supabase.from('linkedin_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('cv_versions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    let score = 0;
    // recency 0..30
    score += Math.max(0, 30 - Math.min(30, lastActiveDays));
    // features
    if ((radarCount || 0) > 0) score += 20;
    if ((cvCount || 0) > 0) score += 20;
    if ((postsCount || 0) > 0) score += 10;
    // paid
    if (profile.plan && profile.plan !== 'free') score += 30;
    // tokens consumed signal (free plan ran through tokens = engaged)
    if (profile.plan === 'free' && (profile.token_balance ?? 0) <= 0) score += 15;
    // inactive penalty
    if (lastActiveDays > 14) score -= 20;

    score = Math.max(0, Math.min(100, score));

    const segment: HealthScore['segment'] =
      score >= 90 ? 'vip' :
      score >= 70 ? 'active' :
      score >= 50 ? 'warm_lead' :
      score >= 30 ? 'hot_lead' :
      score >= 10 ? 'at_risk' :
      lastActiveDays > 60 ? 'churned' : 'dormant';

    // Propensity (uses Hassan's formula too — duplicated here so we can persist)
    let propensity = 0;
    if (profile.plan === 'free' && (profile.token_balance ?? 0) <= 0) propensity += 0.30;
    if (((radarCount || 0) + (cvCount || 0) + (postsCount || 0)) >= 2) propensity += 0.25;
    if (signupAgeDays <= 7) propensity += 0.20;
    if (profile.linkedin_url) propensity += 0.10;
    propensity = Math.max(0, Math.min(1, propensity));

    const churn = lastActiveDays > 30 ? Math.min(1, lastActiveDays / 90) : 0;

    const signals = {
      last_active_days: lastActiveDays,
      signup_age_days: signupAgeDays,
      radar_count: radarCount || 0,
      cv_count: cvCount || 0,
      posts_count: postsCount || 0,
      plan: profile.plan,
      token_balance: profile.token_balance,
    };

    const recompute = new Date(now + 6 * 3600 * 1000).toISOString();
    await supabase.from('user_health_scores').upsert({
      user_id: userId,
      score,
      segment,
      upgrade_propensity: Number(propensity.toFixed(2)),
      churn_risk: Number(churn.toFixed(2)),
      signals,
      computed_at: new Date(now).toISOString(),
      next_recompute_at: recompute,
    });

    return { score, segment, upgradePropensity: propensity, churnRisk: churn, signals };
  }

  async recomputeAllScores(limit = 500): Promise<{ updated: number }> {
    const { data: users } = await this.client()
      .from('profiles')
      .select('id')
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    let updated = 0;
    for (const u of users || []) {
      try {
        await this.computeHealthScore(u.id);
        updated++;
      } catch (e) {
        console.warn('[al_mukhadram] score failed for', u.id, e);
      }
    }
    return { updated };
  }

  /** Send an approved welcome/rescue/support task via whatsapp+email. */
  async sendApprovedMessage(taskId: string): Promise<{ sent: number; errors: string[] }> {
    const { data: task } = await this.client()
      .from('agent_tasks')
      .select('id, payload, edited_payload, status')
      .eq('id', taskId)
      .single();
    if (!task) throw new Error('Task not found');
    const payload = task.edited_payload || task.payload;
    const errors: string[] = [];
    let sent = 0;

    const userId = payload.user_id;
    const { data: user } = await this.client()
      .from('profiles')
      .select('phone, email, language')
      .eq('id', userId)
      .maybeSingle();

    const lang = (payload.language || user?.language || 'ar') as 'ar' | 'en';

    // WhatsApp
    if (user?.phone && payload.whatsapp_body_ar) {
      const body = lang === 'en' ? (payload.whatsapp_body_en || payload.whatsapp_body_ar) : payload.whatsapp_body_ar;
      const r = await whatsapp.sendText({ toPhone: user.phone, body });
      await this.client().from('whatsapp_messages').insert({
        user_id: userId,
        agent_id: this.id,
        task_id: taskId,
        direction: 'outbound',
        to_phone: user.phone,
        message_type: 'text',
        language: lang,
        body,
        whatsapp_message_id: r.whatsappMessageId || null,
        status: r.ok ? (r.stub ? 'queued' : 'sent') : 'failed',
        error_message: r.error || null,
        sent_at: r.ok && !r.stub ? new Date().toISOString() : null,
      });
      if (r.ok) sent++;
      else errors.push(`whatsapp: ${r.error}`);
    }

    // Email — write to email_messages; actual send goes through email lib
    if (user?.email && (payload.email_subject_ar || payload.body)) {
      const subject = lang === 'en' ? (payload.email_subject_en || payload.email_subject_ar) : payload.email_subject_ar;
      const bodyHtml = lang === 'en' ? (payload.email_body_en || payload.email_body_ar || payload.body) : (payload.email_body_ar || payload.body);
      await this.client().from('email_messages').insert({
        user_id: userId,
        agent_id: this.id,
        task_id: taskId,
        to_email: user.email,
        from_email: 'hello@wasselhub.com',
        subject: subject || 'Wassel',
        body_html: bodyHtml || '',
        language: lang,
        status: 'queued',
      });
      sent++;
    }

    return { sent, errors };
  }
}

export const alMukhadram = new AlMukhadramAgent();
