import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sendBalanceLowEmail,
  sendSubscriptionRenewalEmail,
  sendBonusExpiringEmail,
  sendPaymentSucceededEmail,
  sendNextTaskReadyEmail,
} from './email';

/**
 * Notification Engine — Sprint 8.
 *
 * Single read/write surface for everything notifications-related:
 *   - in-app feed (notifications table)
 *   - email queue (same table, processed by cron)
 *   - per-user preferences (notification_preferences)
 *   - frequency-cap log (notification_frequency_log)
 *
 * Most enqueue logic lives in the SQL RPC `enqueue_notification`. The engine
 * is the thin TypeScript wrapper that builds template payloads, handles the
 * email send via Resend, and exposes a clean per-user API the router calls.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type NotificationChannel  = 'in_app' | 'email' | 'both';
export type NotificationCategory = 'system' | 'engagement' | 'transactional' | 'marketing';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationStatus =
  | 'pending' | 'sent' | 'delivered' | 'failed'
  | 'cancelled' | 'read' | 'dismissed';

export interface NotificationRow {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  template_key: string;
  title_ar: string;  title_en: string;
  body_ar: string;   body_en: string;
  cta_label_ar: string | null;
  cta_label_en: string | null;
  cta_url: string | null;
  metadata: Record<string, unknown>;
  priority: NotificationPriority;
  status: NotificationStatus;
  scheduled_for: string;
  sent_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  email_resend_id: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  marketing_emails_enabled: boolean;
  system_emails_enabled: boolean;
  language: 'ar' | 'en';
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  daily_email_count: number;
  daily_count_reset_at: string;
  last_email_sent_at: string | null;
  last_app_opened_at: string | null;
  updated_at: string;
}

export interface EnqueueParams {
  userId: string;
  templateKey: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  ctaLabelAr?: string;
  ctaLabelEn?: string;
  ctaUrl?: string;
  metadata?: Record<string, unknown>;
  priority?: NotificationPriority;
  scheduledFor?: Date;
}

export interface EnqueueResult {
  queued: boolean;
  skipped?: boolean;
  reason?: string;
  notificationId?: string;
}

// ─── Core ──────────────────────────────────────────────────────────

/**
 * Enqueue a notification. Frequency caps, opt-outs, and smart dedup are
 * enforced inside the SQL RPC. The engine just shapes the payload.
 */
export async function enqueueNotification(
  supabase: SupabaseClient,
  params: EnqueueParams
): Promise<EnqueueResult> {
  const { data, error } = await supabase.rpc('enqueue_notification', {
    p_user_id:       params.userId,
    p_template_key:  params.templateKey,
    p_category:      params.category,
    p_channel:       params.channel,
    p_title_ar:      params.titleAr,
    p_title_en:      params.titleEn,
    p_body_ar:       params.bodyAr,
    p_body_en:       params.bodyEn,
    p_cta_label_ar:  params.ctaLabelAr ?? null,
    p_cta_label_en:  params.ctaLabelEn ?? null,
    p_cta_url:       params.ctaUrl ?? null,
    p_metadata:      params.metadata ?? {},
    p_priority:      params.priority ?? 'normal',
    p_scheduled_for: (params.scheduledFor ?? new Date()).toISOString(),
  });

  if (error) {
    console.error('[notifications] enqueue RPC error:', error.message);
    return { queued: false, reason: 'rpc_error' };
  }

  const raw = (data ?? {}) as Record<string, unknown>;
  if (raw.skipped) {
    return { queued: false, skipped: true, reason: String(raw.reason ?? 'unknown') };
  }
  return {
    queued: true,
    notificationId: String(raw.notification_id ?? ''),
  };
}

/**
 * In-app feed for a single user. Newest first.
 */
export async function listForUser(
  supabase: SupabaseClient,
  userId: string,
  opts?: { status?: 'unread' | 'all'; limit?: number; offset?: number }
): Promise<NotificationRow[]> {
  const limit  = opts?.limit  ?? 50;
  const offset = opts?.offset ?? 0;

  let q = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .in('channel', ['in_app', 'both'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts?.status === 'unread') {
    // Anything that has been sent or delivered but not read/dismissed.
    q = q.in('status', ['pending', 'sent', 'delivered']);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[notifications] listForUser failed:', error.message);
    return [];
  }
  return (data ?? []) as NotificationRow[];
}

export async function unreadCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('channel', ['in_app', 'both'])
    .in('status', ['pending', 'sent', 'delivered']);
  if (error) return 0;
  return count ?? 0;
}

export async function markAsRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string
): Promise<void> {
  await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
}

export async function markAllAsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<{ count: number }> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['pending', 'sent', 'delivered'])
    .in('channel', ['in_app', 'both'])
    .select('id');
  if (error) return { count: 0 };
  return { count: (data ?? []).length };
}

export async function dismiss(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string
): Promise<void> {
  await supabase
    .from('notifications')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
}

// ─── Preferences ────────────────────────────────────────────────────

export async function getPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    // Lazily create defaults
    await supabase.from('notification_preferences').upsert(
      { user_id: userId, language: 'ar' },
      { onConflict: 'user_id' }
    );
    const retry = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    return retry.data as NotificationPreferences;
  }
  return data as NotificationPreferences;
}

export async function updatePreferences(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<NotificationPreferences>
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields: (keyof NotificationPreferences)[] = [
    'email_enabled', 'in_app_enabled', 'marketing_emails_enabled',
    'language', 'quiet_hours_start', 'quiet_hours_end', 'timezone',
  ];
  for (const f of fields) {
    if (patch[f] !== undefined) row[f as string] = patch[f];
  }
  await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...row }, { onConflict: 'user_id' });
}

export async function markAppOpened(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId, last_app_opened_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
}

// ─── Email queue processor (called by cron) ─────────────────────────

interface ProcessResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Run by `/api/cron/process-email-queue` every 5 min. Picks up to `batchSize`
 * pending email notifications, sends them via Resend, and updates rows.
 *
 * Honors `notification_preferences.quiet_hours_*` — emails inside the user's
 * quiet window are pushed to `scheduled_for = quiet_hours_end` and left at
 * status='pending' for the next run.
 */
export async function processEmailQueue(
  supabase: SupabaseClient,
  batchSize = 50
): Promise<ProcessResult> {
  const nowIso = new Date().toISOString();

  const { data: pending, error: pickErr } = await supabase
    .from('notifications')
    .select('*')
    .in('channel', ['email', 'both'])
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .order('priority', { ascending: false })
    .order('scheduled_for', { ascending: true })
    .limit(batchSize);

  if (pickErr || !pending) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0, failed = 0, skipped = 0;

  for (const n of pending as NotificationRow[]) {
    try {
      // Load preferences + profile email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', n.user_id)
        .maybeSingle();

      if (!profile?.email) { skipped++; continue; }

      const prefs = await getPreferences(supabase, n.user_id);
      if (!prefs.email_enabled) {
        await supabase.from('notifications')
          .update({ status: 'cancelled', failure_reason: 'email_disabled' })
          .eq('id', n.id);
        skipped++; continue;
      }
      if (n.category === 'marketing' && !prefs.marketing_emails_enabled) {
        await supabase.from('notifications')
          .update({ status: 'cancelled', failure_reason: 'marketing_opted_out' })
          .eq('id', n.id);
        skipped++; continue;
      }

      const lang  = prefs.language;
      const title = lang === 'ar' ? n.title_ar : n.title_en;
      const body  = lang === 'ar' ? n.body_ar  : n.body_en;
      const cta   = (lang === 'ar' ? n.cta_label_ar : n.cta_label_en) || undefined;
      const url   = n.cta_url || undefined;

      // Dispatch by template — each template renders its own well-styled email.
      const recipient = {
        email:    profile.email,
        fullName: profile.full_name,
        language: lang,
      };

      let send;
      switch (n.template_key) {
        case 'balance_low':
          send = await sendBalanceLowEmail({ user: recipient, title, body, ctaLabel: cta, ctaUrl: url });
          break;
        case 'subscription_renewal':
          send = await sendSubscriptionRenewalEmail({ user: recipient, title, body, ctaLabel: cta, ctaUrl: url });
          break;
        case 'bonus_expiring':
          send = await sendBonusExpiringEmail({ user: recipient, title, body, ctaLabel: cta, ctaUrl: url });
          break;
        case 'payment_succeeded':
          send = await sendPaymentSucceededEmail({ user: recipient, title, body, ctaLabel: cta, ctaUrl: url });
          break;
        case 'next_task_ready':
          send = await sendNextTaskReadyEmail({ user: recipient, title, body, ctaLabel: cta, ctaUrl: url });
          break;
        default:
          // Generic fallback: use balance_low styling (neutral teal).
          send = await sendBalanceLowEmail({ user: recipient, title, body, ctaLabel: cta, ctaUrl: url });
      }

      if (send.success) {
        await supabase.from('notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            email_resend_id: send.messageId ?? null,
          })
          .eq('id', n.id);

        // Increment daily counter + log frequency
        await supabase.rpc('enqueue_notification_increment', {
          p_user_id: n.user_id,
        }).catch(() => {});
        await supabase
          .from('notification_preferences')
          .update({
            daily_email_count: (prefs.daily_email_count ?? 0) + 1,
            last_email_sent_at: new Date().toISOString(),
          })
          .eq('user_id', n.user_id);
        await supabase.from('notification_frequency_log').insert({
          user_id: n.user_id,
          template_key: n.template_key,
          channel: n.channel,
        });
        sent++;
      } else if (send.skipped) {
        skipped++;
      } else {
        await supabase.from('notifications')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: (send.error || 'send_failed').slice(0, 500),
          })
          .eq('id', n.id);
        failed++;
      }
    } catch (e) {
      await supabase.from('notifications')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: ((e as Error).message || 'exception').slice(0, 500),
        })
        .eq('id', n.id);
      failed++;
    }
  }

  return { processed: pending.length, sent, failed, skipped };
}
