// Dhai (ضي) — Compliance & Fraud agent.
// Fraud scan on signup + checkout, content moderation pre-publish, LinkedIn ToS
// scanner, PDPL audit log. auto_with_bounds — auto-resolve low-risk, escalate
// medium+ to Faris queue.

import { BaseAgent } from './base';

const LINKEDIN_TOS_BAD_TERMS = [
  /scrap(?:e|ing|er|ed)/i,
  /automate connection/i,
  /bulk message/i,
  /auto[- ]connect/i,
  /extract data/i,
  /\bspam\b/i,
  /mass invitation/i,
  /استخراج/i,            // Arabic "extract"
  /سحب البيانات/i,        // Arabic "data pulling"
  /إرسال مجمع/i,          // Arabic "bulk send"
];

const THROWAWAY_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'yopmail.com', 'trashmail.com', 'throwawaymail.com', 'maildrop.cc',
];

function isThrowawayEmail(email: string): boolean {
  const d = email.split('@')[1]?.toLowerCase() || '';
  return THROWAWAY_EMAIL_DOMAINS.some(td => d === td || d.endsWith('.' + td));
}

interface ScanResult {
  signalsCreated: number;
  highestSeverity: 'low' | 'medium' | 'high' | 'critical' | null;
}

export class DhaiAgent extends BaseAgent {
  readonly id = 'dhai';
  readonly nameAr = 'ضي';
  readonly nameEn = 'Dhai';

  async scanNewSignup(opts: { userId: string }): Promise<ScanResult> {
    const { data: profile } = await this.client()
      .from('profiles')
      .select('email, phone, linkedin_url, created_at, signup_ip')
      .eq('id', opts.userId)
      .maybeSingle();
    if (!profile) return { signalsCreated: 0, highestSeverity: null };

    let signalsCreated = 0;
    let highest: ScanResult['highestSeverity'] = null;
    const upgrade = (s: ScanResult['highestSeverity']) => {
      const rank = { low: 1, medium: 2, high: 3, critical: 4 } as const;
      if (!highest || (s && rank[s] > rank[highest])) highest = s;
    };

    const insert = async (type: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any) => {
      await this.client().from('fraud_signals').insert({
        user_id: opts.userId, signal_type: type, severity, details, status: 'open',
      });
      signalsCreated++;
      upgrade(severity);
    };

    // Throwaway email
    if (profile.email && isThrowawayEmail(profile.email)) {
      await insert('test_email_pattern', 'medium', { email: profile.email });
    }

    // Duplicate linkedin URL across accounts
    if (profile.linkedin_url) {
      const { data: dupes } = await this.client()
        .from('profiles')
        .select('id')
        .eq('linkedin_url', profile.linkedin_url)
        .neq('id', opts.userId);
      if ((dupes || []).length >= 1) {
        await insert('profile_data_mismatch', 'high', { linkedin_url: profile.linkedin_url, also_used_by: (dupes || []).map((d: any) => d.id) });
      }
    }

    // Same-IP signup burst (last 1 hour, ≥5 accounts)
    if (profile.signup_ip) {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count } = await this.client()
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('signup_ip', profile.signup_ip)
        .gte('created_at', oneHourAgo);
      if ((count || 0) >= 5) {
        await insert('multiple_accounts_same_ip', 'high', { ip: profile.signup_ip, count });
      }
    }

    return { signalsCreated, highestSeverity: highest };
  }

  async scanCardForFraud(opts: { moyasarPaymentId: string; cardLast4: string; ip?: string; userId?: string }): Promise<ScanResult> {
    let signalsCreated = 0;
    let highest: ScanResult['highestSeverity'] = null;

    // Card across 3+ accounts (look at payment_transactions metadata)
    const { data: txs } = await this.client()
      .from('payment_transactions')
      .select('user_id, metadata')
      .filter('metadata->>card_last4', 'eq', opts.cardLast4);
    const uniqueUsers = new Set((txs || []).map((t: any) => t.user_id).filter(Boolean));
    if (uniqueUsers.size >= 3) {
      await this.client().from('fraud_signals').insert({
        user_id: opts.userId || null,
        signal_type: 'duplicate_card',
        severity: 'high',
        details: { card_last4: opts.cardLast4, account_count: uniqueUsers.size, moyasar_payment_id: opts.moyasarPaymentId },
        status: 'open',
      });
      signalsCreated++;
      highest = 'high';
    }
    return { signalsCreated, highestSeverity: highest };
  }

  async moderateContent(opts: { contentId: string; contentType: 'social_post' | 'ad_creative' | 'blog_post' | 'user_generated' | 'email'; scannedText: string; language?: string; sourceAgent?: string }): Promise<{ decision: 'approved' | 'flagged' | 'blocked'; violations: string[] }> {
    const violations: string[] = [];
    const flags: string[] = [];

    // LinkedIn ToS keywords
    const tosHits: string[] = [];
    for (const re of LINKEDIN_TOS_BAD_TERMS) {
      if (re.test(opts.scannedText)) tosHits.push(re.source);
    }
    if (tosHits.length > 0) {
      violations.push('linkedin_tos_terms');
      flags.push(...tosHits);
    }

    // Apify / Waalaxy / scraping mentions (Wassel UI policy)
    if (/apify|waalaxy/i.test(opts.scannedText)) {
      violations.push('forbidden_brand_mention');
    }

    const decision: 'approved' | 'flagged' | 'blocked' = violations.includes('linkedin_tos_terms') || violations.includes('forbidden_brand_mention')
      ? 'blocked'
      : flags.length > 0 ? 'flagged' : 'approved';

    await this.client().from('content_moderation_log').insert({
      content_id: opts.contentId,
      content_type: opts.contentType,
      source_agent: opts.sourceAgent || null,
      scanned_text: opts.scannedText.slice(0, 8000),
      language: opts.language || null,
      flags: flags.length ? { hits: flags } : null,
      violations: violations.length ? violations : null,
      decision,
      linkedin_tos_check: { hits: tosHits, terms_searched: LINKEDIN_TOS_BAD_TERMS.length },
      reasoning: decision === 'blocked'
        ? 'Contains LinkedIn ToS-forbidden language or forbidden brand mention.'
        : decision === 'flagged'
          ? 'Soft flags only — needs Ali review.'
          : 'Clean.',
    });

    return { decision, violations };
  }

  async checkLinkedinTos(opts: { text: string }): Promise<{ ok: boolean; hits: string[] }> {
    const hits: string[] = [];
    for (const re of LINKEDIN_TOS_BAD_TERMS) {
      if (re.test(opts.text)) hits.push(re.source);
    }
    return { ok: hits.length === 0, hits };
  }

  async logPdplEvent(opts: { eventType: string; userId?: string; dataCategory?: string; details?: any; performedBy?: string }): Promise<void> {
    await this.client().from('pdpl_log').insert({
      event_type: opts.eventType,
      user_id: opts.userId || null,
      data_category: opts.dataCategory || null,
      details: opts.details || null,
      performed_by: opts.performedBy || null,
    });
  }

  async dailyComplianceSweep(): Promise<{ openSignals: number; flaggedContent: number; pdplEvents: number }> {
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const { count: openSignals } = await this.client()
      .from('fraud_signals')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'investigating']);
    const { count: flaggedContent } = await this.client()
      .from('content_moderation_log')
      .select('*', { count: 'exact', head: true })
      .in('decision', ['flagged', 'blocked'])
      .gte('created_at', since24h);
    const { count: pdplEvents } = await this.client()
      .from('pdpl_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since24h);

    // Queue a single summary task if anything to look at
    if ((openSignals || 0) > 0 || (flaggedContent || 0) > 0) {
      await this.queueTask({
        taskType: 'compliance_sweep',
        title: `Daily compliance sweep: ${openSignals} fraud · ${flaggedContent} flagged content`,
        payload: { openSignals, flaggedContent, pdplEvents },
        preview: { openSignals, flaggedContent, pdplEvents },
        priority: (openSignals || 0) > 5 ? 'high' : 'normal',
        expectedImpact: 'Compliance posture',
      });
    }
    return { openSignals: openSignals || 0, flaggedContent: flaggedContent || 0, pdplEvents: pdplEvents || 0 };
  }
}

export const dhai = new DhaiAgent();
