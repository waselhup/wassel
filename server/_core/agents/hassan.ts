// Hassan (حسن) — Revenue Lab agent.
// Upgrade pitches, A/B experiments, referrals, conversion attribution.
// Approval mode: approval_required (every pitch + experiment gated).

import { BaseAgent } from './base';

function safeJsonParse<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(trimmed) as T; } catch { return fallback; }
}

function randomCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export class HassanAgent extends BaseAgent {
  readonly id = 'hassan';
  readonly nameAr = 'حسن';
  readonly nameEn = 'Hassan';

  async computeUpgradePropensity(userId: string): Promise<number> {
    const { data: profile } = await this.client()
      .from('profiles')
      .select('plan, token_balance, last_active_at, created_at, linkedin_url')
      .eq('id', userId)
      .maybeSingle();
    if (!profile) return 0;
    const signupAgeDays = profile.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
      : 0;
    const [{ count: radar }, { count: cv }, { count: posts }] = await Promise.all([
      this.client().from('linkedin_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      this.client().from('cv_versions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      this.client().from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    const featuresTried = ((radar || 0) > 0 ? 1 : 0) + ((cv || 0) > 0 ? 1 : 0) + ((posts || 0) > 0 ? 1 : 0);
    let p = 0;
    if (profile.plan === 'free' && (profile.token_balance ?? 0) <= 0) p += 0.30;
    if (featuresTried >= 2) p += 0.25;
    if (signupAgeDays <= 7) p += 0.20;
    if (profile.linkedin_url) p += 0.10;
    return Math.max(0, Math.min(1, p));
  }

  async draftHotUpgradePitches(opts?: { limit?: number; minPropensity?: number }): Promise<{ tasksCreated: number }> {
    const limit = opts?.limit ?? 10;
    const minProp = opts?.minPropensity ?? 0.5;

    // Pull candidates ranked by propensity (uses health table populated by Al-Mukhadram).
    const { data: candidates } = await this.client()
      .from('user_health_scores')
      .select('user_id, score, upgrade_propensity, segment, signals')
      .gte('upgrade_propensity', minProp)
      .order('upgrade_propensity', { ascending: false })
      .limit(limit);

    let tasksCreated = 0;
    for (const c of candidates || []) {
      const r = await this.draftPitchForUser({
        userId: c.user_id,
        trigger: c.segment === 'hot_lead' ? 'free_tokens_consumed' : 'high_engagement',
        surface: 'in_app_modal',
      });
      if (r.pitchId) tasksCreated++;
    }
    return { tasksCreated };
  }

  async draftPitchForUser(opts: { userId: string; trigger: string; surface: string; experimentId?: string }): Promise<{ pitchId: string | null; taskId: string | null }> {
    const { data: user } = await this.client()
      .from('profiles')
      .select('full_name, plan, token_balance, language')
      .eq('id', opts.userId)
      .maybeSingle();
    if (!user) return { pitchId: null, taskId: null };

    const result = await this.callClaude({
      task: 'campaign_message',
      purpose: `pitch_${opts.trigger}`,
      system: `You are ${this.nameEn} (${this.nameAr}), Wassel's revenue copywriter. You write upgrade pitches that pull, never push. Saudi Arabic primary. Output STRICT JSON.`,
      userContent: `Draft an upgrade pitch.

User: ${user.full_name || opts.userId} · plan: ${user.plan} · tokens: ${user.token_balance ?? 0}
Trigger: ${opts.trigger}
Surface: ${opts.surface}

Return JSON:
{
  "headline_ar": "max 60 chars",
  "headline_en": "max 60 chars",
  "body_ar": "max 240 chars, concrete value",
  "body_en": "max 240 chars",
  "cta_label_ar": "max 20 chars",
  "cta_label_en": "max 20 chars",
  "recommended_plan": "pro" | "starter" | null,
  "recommended_token_pack": "500" | "1000" | "5000" | null
}`,
      maxTokens: 1000,
      temperature: 0.7,
    });

    const pitch = safeJsonParse<any>(result.text, {});
    const variant = opts.experimentId ? (Math.random() < 0.5 ? 'A' : 'B') : 'A';

    const { data: pitchRow } = await this.client()
      .from('upgrade_pitches')
      .insert({
        user_id: opts.userId,
        trigger: opts.trigger,
        surface: opts.surface,
        experiment_id: opts.experimentId || null,
        variant,
        headline_ar: pitch.headline_ar || 'ارفع مستواك على وصل',
        headline_en: pitch.headline_en || 'Level up on Wassel',
        body_ar: pitch.body_ar || 'تجربتك في وصل تستحق أكثر.',
        body_en: pitch.body_en || 'Your time on Wassel deserves more.',
        cta_label_ar: pitch.cta_label_ar || 'ترقية الآن',
        cta_label_en: pitch.cta_label_en || 'Upgrade',
        cta_url: '/v2/pricing',
        recommended_plan: pitch.recommended_plan || null,
        recommended_token_pack: pitch.recommended_token_pack || null,
        status: 'pending_approval',
      })
      .select('id')
      .single();

    const taskId = await this.queueTask({
      taskType: 'upgrade_pitch',
      title: `Upgrade pitch → ${user.full_name || opts.userId}`,
      payload: { user_id: opts.userId, pitch_id: pitchRow?.id, ...pitch, variant },
      preview: {
        surface: opts.surface,
        headline_ar: pitch.headline_ar,
        recommended_plan: pitch.recommended_plan,
      },
      estimatedMoneyCostSar: result.costSar,
      expectedImpact: pitch.recommended_plan
        ? `Free → ${pitch.recommended_plan} conversion`
        : 'Token pack sale',
      relatedResourceId: pitchRow?.id || null,
    });

    return { pitchId: pitchRow?.id || null, taskId };
  }

  async proposeExperiment(opts: { surface: string; hypothesis: string }): Promise<{ experimentId: string | null; taskId: string }> {
    const result = await this.callClaude({
      task: 'campaign_message',
      purpose: 'experiment_design',
      system: `You are ${this.nameEn} (${this.nameAr}), revenue experimenter. Output STRICT JSON.`,
      userContent: `Design an A/B test.

Surface: ${opts.surface}
Hypothesis: ${opts.hypothesis}

Return JSON:
{
  "name": "short_snake_case_name",
  "variants": { "A": { ... }, "B": { ... } },
  "traffic_allocation": { "A": 0.5, "B": 0.5 },
  "primary_metric": "upgrade_conversion" | "click_through" | "revenue_per_user",
  "min_sample_size": 100,
  "expected_lift_pct": 10
}`,
      maxTokens: 1200,
      temperature: 0.5,
    });
    const exp = safeJsonParse<any>(result.text, {});
    const { data: row } = await this.client()
      .from('ab_experiments')
      .insert({
        agent_id: this.id,
        name: exp.name || `exp_${Date.now()}`,
        hypothesis: opts.hypothesis,
        surface: opts.surface,
        variants: exp.variants || { A: {}, B: {} },
        traffic_allocation: exp.traffic_allocation || { A: 0.5, B: 0.5 },
        primary_metric: exp.primary_metric || 'upgrade_conversion',
        status: 'awaiting_approval',
      })
      .select('id')
      .single();

    const taskId = await this.queueTask({
      taskType: 'ab_experiment',
      title: `Experiment: ${exp.name || opts.surface}`,
      payload: { experiment_id: row?.id, ...exp, hypothesis: opts.hypothesis, surface: opts.surface },
      preview: { surface: opts.surface, primary_metric: exp.primary_metric, min_sample: exp.min_sample_size },
      estimatedMoneyCostSar: result.costSar,
      expectedImpact: `Expected lift ${exp.expected_lift_pct || '?'}%`,
      relatedResourceId: row?.id || null,
    });
    return { experimentId: row?.id || null, taskId };
  }

  async generateReferralCode(userId: string, opts?: { rewardInviter?: number; rewardInvitee?: number; maxUses?: number }): Promise<{ code: string }> {
    const code = `${randomCode(4)}-${randomCode(4)}`;
    await this.client().from('referral_codes').insert({
      owner_user_id: userId,
      code,
      reward_tokens_inviter: opts?.rewardInviter ?? 100,
      reward_tokens_invitee: opts?.rewardInvitee ?? 100,
      max_uses: opts?.maxUses ?? null,
      active: true,
    });
    return { code };
  }

  /** Find an approved pitch for the user on the given surface. */
  async servePitch(userId: string, surface: string): Promise<any | null> {
    const { data } = await this.client()
      .from('upgrade_pitches')
      .select('*')
      .eq('user_id', userId)
      .eq('surface', surface)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    await this.client()
      .from('upgrade_pitches')
      .update({ status: 'served', served_at: new Date().toISOString() })
      .eq('id', data.id);
    return data;
  }

  async recordPitchClick(pitchId: string): Promise<void> {
    await this.client()
      .from('upgrade_pitches')
      .update({ status: 'clicked', clicked_at: new Date().toISOString() })
      .eq('id', pitchId);
  }

  async recordConversion(opts: { userId: string; amountSar: number; pitchId?: string }): Promise<void> {
    if (opts.pitchId) {
      await this.client()
        .from('upgrade_pitches')
        .update({ status: 'converted', converted_at: new Date().toISOString(), conversion_value_sar: opts.amountSar })
        .eq('id', opts.pitchId);
    }
    // Update most recent assignment too
    await this.client()
      .from('ab_assignments')
      .update({ converted: true, converted_at: new Date().toISOString(), conversion_value_sar: opts.amountSar })
      .eq('user_id', opts.userId)
      .eq('converted', false);
  }
}

export const hassan = new HassanAgent();
