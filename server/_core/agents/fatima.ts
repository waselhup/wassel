// Fatima (فاطمة) — Product Intelligence agent.
// Suggest-only. Detects friction patterns, generates weekly intel reports,
// computes funnels, digests user voice. NEVER queues approval tasks — she
// posts to friction_patterns / weekly_intel_reports tables and surfaces
// suggestion-tasks in agent_tasks with status='suggested'.

import { BaseAgent } from './base';

function safeJsonParse<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(trimmed) as T; } catch { return fallback; }
}

export class FatimaAgent extends BaseAgent {
  readonly id = 'fatima';
  readonly nameAr = 'فاطمة';
  readonly nameEn = 'Fatima';

  async detectFrictionPatterns(opts?: { lookbackDays?: number }): Promise<{ patternsFound: number }> {
    const lookback = opts?.lookbackDays ?? 7;
    const since = new Date(Date.now() - lookback * 86400000).toISOString();

    // Pull a sample of recent events; cluster via Claude.
    const { data: events } = await this.client()
      .from('analytics_events')
      .select('event, properties, user_id, created_at')
      .gte('created_at', since)
      .limit(2000);

    if (!events || events.length === 0) return { patternsFound: 0 };

    // Aggregate event counts to feed Claude lightweight context
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.event] = (counts[e.event] || 0) + 1;
    const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 50);

    const result = await this.callClaude({
      task: 'analytics_summary',
      purpose: 'friction_detection',
      system: `You are ${this.nameEn} (${this.nameAr}), Wassel's product intelligence. Identify friction patterns from event aggregates. Be conservative — only flag patterns with clear signals. Output STRICT JSON.`,
      userContent: `Last ${lookback} days, top events:
${summary.map(([e, c]) => `${e}: ${c}`).join('\n')}

Return JSON:
{
  "patterns": [
    {
      "pattern_key": "snake_case_unique_key",
      "feature": "radar"|"cv"|"campaigns"|"posts"|"signup"|"checkout"|"other",
      "step": "step_name"|null,
      "description_ar": "...",
      "description_en": "...",
      "severity": "low"|"medium"|"high"|"critical",
      "recommendation_ar": "...",
      "recommendation_en": "...",
      "affected_users_estimate": 0
    }
  ]
}

Return [] if no clear patterns. Don't invent. Max 10 patterns.`,
      maxTokens: 3000,
      temperature: 0.2,
    });

    const parsed = safeJsonParse<{ patterns: any[] }>(result.text, { patterns: [] });
    const patterns = parsed.patterns || [];
    let inserted = 0;
    for (const p of patterns) {
      const { error } = await this.client().from('friction_patterns').upsert({
        pattern_key: p.pattern_key,
        feature: p.feature,
        step: p.step || null,
        description_ar: p.description_ar,
        description_en: p.description_en,
        affected_users: p.affected_users_estimate || 0,
        total_observations: counts[p.pattern_key] || 0,
        severity: p.severity,
        fatima_recommendation_ar: p.recommendation_ar,
        fatima_recommendation_en: p.recommendation_en,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'pattern_key' });
      if (!error) inserted++;
    }
    return { patternsFound: inserted };
  }

  async generateWeeklyReport(): Promise<{ reportId: string | null }> {
    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    // Pull patterns, top dropoffs, simple metrics
    const { data: patterns } = await this.client()
      .from('friction_patterns')
      .select('feature, step, description_ar, description_en, severity, affected_users')
      .gte('last_seen', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('severity', { ascending: false })
      .limit(10);

    const { count: newSignups } = await this.client()
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const { count: activeUsers } = await this.client()
      .from('analytics_events')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const result = await this.callClaude({
      task: 'analytics_summary',
      purpose: 'weekly_intel',
      system: `You are ${this.nameEn} (${this.nameAr}), product intelligence. Write a weekly report (AR + EN). Tight, data-led, no fluff. Output STRICT JSON.`,
      userContent: `Synthesize:
- New signups: ${newSignups || 0}
- Active users (events): ${activeUsers || 0}
- Top friction patterns: ${JSON.stringify((patterns || []).slice(0, 5))}

Return JSON:
{
  "summary_ar": "1-2 paragraphs Arabic",
  "summary_en": "1-2 paragraphs English",
  "top_dropoff_points": ["...","..."],
  "top_user_quotes": [],
  "recommendations": ["...","..."]
}`,
      maxTokens: 2500,
      temperature: 0.5,
    });

    const parsed = safeJsonParse<any>(result.text, {});
    const { data: row } = await this.client()
      .from('weekly_intel_reports')
      .upsert({
        week_start: weekStartIso,
        summary_ar: parsed.summary_ar || 'لا توجد إشارات قوية هذا الأسبوع.',
        summary_en: parsed.summary_en || 'No strong signals this week.',
        top_friction_patterns: patterns || [],
        top_dropoff_points: parsed.top_dropoff_points || [],
        top_user_quotes: parsed.top_user_quotes || [],
        recommendations: parsed.recommendations || [],
        metrics: { new_signups: newSignups, active_users: activeUsers },
        generated_at: new Date().toISOString(),
      }, { onConflict: 'week_start' })
      .select('id')
      .single();
    return { reportId: row?.id || null };
  }

  async computeFunnel(opts: { feature: string; startDate: string; endDate: string }): Promise<{ stages: Array<{ name: string; users: number }> }> {
    // Simple funnel: count distinct users per stage event for the given feature.
    const stages = {
      radar: ['radar_open', 'radar_analyze_start', 'radar_analyze_success', 'radar_save'],
      cv: ['cv_open', 'cv_generate_start', 'cv_generate_success', 'cv_download'],
      campaigns: ['campaigns_open', 'campaign_create_start', 'campaign_preview', 'campaign_send'],
      checkout: ['pricing_view', 'checkout_open', 'checkout_submit', 'checkout_success'],
    }[opts.feature] || [];

    const results = [];
    for (const evt of stages) {
      const { count } = await this.client()
        .from('analytics_events')
        .select('user_id', { count: 'exact', head: true })
        .eq('event', evt)
        .gte('created_at', opts.startDate)
        .lte('created_at', opts.endDate);
      results.push({ name: evt, users: count || 0 });
    }
    return { stages: results };
  }

  async digestUserVoice(): Promise<{ themes: any[] }> {
    const { data: msgs } = await this.client()
      .from('whatsapp_messages')
      .select('body, language, created_at')
      .eq('direction', 'inbound')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(200);
    if (!msgs || msgs.length === 0) return { themes: [] };

    const result = await this.callClaude({
      task: 'analytics_summary',
      purpose: 'user_voice_digest',
      system: `You are ${this.nameEn} (${this.nameAr}). Cluster user messages into themes. Output STRICT JSON.`,
      userContent: `Cluster these inbound user messages into themes.
Messages:
${msgs.slice(0, 80).map(m => `[${m.language}] ${m.body.slice(0, 200)}`).join('\n---\n')}

Return JSON:
{ "themes": [ { "theme_ar":"...", "theme_en":"...", "count":N, "sample_quote":"..." } ] }`,
      maxTokens: 2000,
      temperature: 0.3,
    });
    const parsed = safeJsonParse<{ themes: any[] }>(result.text, { themes: [] });
    return { themes: parsed.themes || [] };
  }
}

export const fatima = new FatimaAgent();
