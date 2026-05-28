import { initSentryServer, captureException as sentryCapture } from './lib/sentry-server';
initSentryServer();
import { telegramHandler } from './telegram';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc';
import { createContext } from './context';
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail, sendTestEmail, sendAnalysisReportEmail } from './lib/email';
import { muyassarWebhookHandler } from './lib/muyassar-webhook';
import * as whatsapp from './lib/whatsapp';
import { alMukhadram } from './agents/al-mukhadram';
import { hassan } from './agents/hassan';
import { fatima } from './agents/fatima';
import { dhai } from './agents/dhai';
import { hussein } from './agents/hussein';
import { mohammed } from './agents/mohammed';
import { generateWeeklyJournal as warRoomGenerateWeeklyJournal } from './lib/war-room-engine';
import { generateSuggestions as dashboardGenerateSuggestions, snapshotPulse as dashboardSnapshotPulse } from './lib/dashboard-engine';
import { processEmailQueue as notificationsProcessEmailQueue, enqueueNotification as notificationsEnqueue } from './lib/notification-engine';

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://wasselhub.com',
        'https://www.wasselhub.com',
        'https://wassel.vercel.app',
        'https://wassel-alpha.vercel.app',
        'https://wassel-waselhupsas-projects.vercel.app',
        'https://wassel-git-master-waselhupsas-projects.vercel.app',
        'https://wassel.sa',
      ]
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    // Stash the raw body for routes that need to verify HMAC signatures
    // (Muyassar webhook). Only stored as a string for the signature check.
    if (req.url && req.url.startsWith('/api/webhooks/')) {
      req.rawBody = buf.toString('utf8');
    }
  },
}));

app.post('/api/telegram', telegramHandler);

// Moyasar webhook — mount under both spellings so existing dashboard
// configurations (muyassar) keep working while new ones use the correct
// 'moyasar' spelling.
app.post('/api/webhooks/moyasar', muyassarWebhookHandler);
app.post('/api/webhooks/muyassar', muyassarWebhookHandler);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

app.post('/api/log-error', (req, res) => {
  try {
    const { message, stack, type, url, componentStack } = req.body || {};
    console.error('[CLIENT_ERROR]', {
      message,
      type: type || 'react',
      url,
      stack: typeof stack === 'string' ? stack.slice(0, 1500) : '',
      componentStack: typeof componentStack === 'string' ? componentStack.slice(0, 1500) : '',
      ts: new Date().toISOString(),
    });
  } catch {}
  res.json({ ok: true });
});


app.get('/api/test-route', (_req, res) => { res.json({ok:true,routes:'working'}); });

// ===== Cron: Anthropic health check =====
// Vercel calls this on a schedule (see vercel.json crons). Sends Telegram alert
// only on failure so a healthy ping is a no-op. Auth via CRON_SECRET header
// (Vercel includes `Authorization: Bearer <CRON_SECRET>` automatically).
app.get('/api/cron/anthropic-health', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (expected && auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY missing' });
  }

  const t0 = Date.now();
  let status = 0;
  let bodyText = '';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    status = r.status;
    bodyText = await r.text();
  } catch (e: any) {
    bodyText = e?.message || 'fetch failed';
  }

  const latencyMs = Date.now() - t0;
  const creditOut = /credit balance is too low|insufficient credit/i.test(bodyText);
  const healthy = status === 200;

  if (!healthy) {
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    if (tgToken) {
      const ALI_CHAT = '1205315908';
      const msg = '🔴 *Anthropic API DOWN*\n\n' +
        `HTTP: \`${status || 'network_error'}\`\n` +
        `Latency: ${latencyMs}ms\n` +
        (creditOut ? '*السبب*: انتهت الكريديتس\n' : '') +
        `Body: \`${bodyText.slice(0, 180).replace(/`/g, "'")}\`\n\n` +
        '🔗 https://console.anthropic.com/settings/billing';
      try {
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: ALI_CHAT, text: msg, parse_mode: 'Markdown' }),
        });
      } catch (e: any) {
        console.error('[cron/anthropic-health] Telegram send failed:', e?.message);
      }
    }
  }

  return res.json({
    ok: healthy,
    status,
    latencyMs,
    creditExhausted: creditOut,
    timestamp: new Date().toISOString(),
  });
});

// ===== Cron: subscription renewal check (daily @06:00) =====
// Finds subscriptions whose current_period_end is within the next 7 days and
// logs the count to api_logs so the Operations portal can chart it. Also
// creates an incident if any active subscription is past_due without renewal.
async function _opsCronSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Alias — the dashboard-suggestions, expire-bonuses and subscription-renewals
// crons reference `_supa()` (legacy short name) but only `_opsCronSupabase`
// was ever defined. Without this alias every invocation throws a
// ReferenceError that the cron's catch handler can't recover from (the
// catch path also fails on wrong api_logs column names), leaving the
// connection hung until Vercel kills it at 300s. One-line alias unblocks
// all three crons.
const _supa = _opsCronSupabase;

function _cronAuthOk(req: any): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${expected}`;
}

app.get('/api/cron/check-renewals', async (req, res) => {
  if (!_cronAuthOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const t0 = Date.now();
  try {
    const supa = await _opsCronSupabase();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { count: expiringCount } = await supa
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('current_period_end', now.toISOString())
      .lte('current_period_end', in7.toISOString());

    const { data: pastDue } = await supa
      .from('subscriptions')
      .select('id, user_id, plan, current_period_end')
      .eq('status', 'active')
      .lt('current_period_end', now.toISOString());

    let incidentId: string | null = null;
    if ((pastDue || []).length > 0) {
      const { data: inc } = await supa
        .from('incidents')
        .insert({
          severity: 'warning',
          source: 'cron/check-renewals',
          title: `${(pastDue || []).length} subscriptions past period end`,
          description: `Found ${(pastDue || []).length} active subs whose current_period_end has passed without renewal.`,
          affected_service: 'subscriptions',
        })
        .select('id')
        .single();
      incidentId = inc?.id || null;
    }

    await supa.from('api_logs').insert({
      service: 'cron',
      endpoint: '/api/cron/check-renewals',
      status_code: 200,
      response_time_ms: Date.now() - t0,
      error_msg: null,
    });
    return res.json({
      ok: true,
      expiring_in_7d: expiringCount || 0,
      past_due_count: (pastDue || []).length,
      incident_id: incidentId,
      latencyMs: Date.now() - t0,
    });
  } catch (e: any) {
    try {
      const supa = await _opsCronSupabase();
      await supa.from('api_logs').insert({
        service: 'cron',
        endpoint: '/api/cron/check-renewals',
        status_code: 500,
        response_time_ms: Date.now() - t0,
        error_msg: (e?.message || 'error').slice(0, 500),
      });
    } catch { /* swallow */ }
    return res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
});

// ===== Cron: detect abandoned signups (hourly) =====
// Marks any user whose latest signup_event is >1h old and not 'first_action'
// as 'abandoned'. Avoids double-marking — won't insert 'abandoned' twice
// for the same user.
app.get('/api/cron/check-abandoned-signups', async (req, res) => {
  if (!_cronAuthOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const t0 = Date.now();
  try {
    const supa = await _opsCronSupabase();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: signups } = await supa
      .from('signup_events')
      .select('user_id, created_at, event_type')
      .gte('created_at', oneDayAgo)
      .eq('event_type', 'signup_started');

    const { data: completed } = await supa
      .from('signup_events')
      .select('user_id')
      .gte('created_at', oneDayAgo)
      .in('event_type', ['first_action', 'onboarding_completed']);

    const { data: already } = await supa
      .from('signup_events')
      .select('user_id')
      .gte('created_at', oneDayAgo)
      .eq('event_type', 'abandoned');

    const completedSet = new Set((completed || []).map((r: any) => r.user_id));
    const alreadySet = new Set((already || []).map((r: any) => r.user_id));

    const toMark = (signups || [])
      .filter((s: any) => {
        if (!s.user_id) return false;
        if (s.created_at > oneHourAgo) return false; // too recent
        if (completedSet.has(s.user_id)) return false;
        if (alreadySet.has(s.user_id)) return false;
        return true;
      })
      .map((s: any) => ({ user_id: s.user_id, event_type: 'abandoned', metadata: { source: 'cron/check-abandoned-signups' } }));

    let inserted = 0;
    if (toMark.length) {
      const { error } = await supa.from('signup_events').insert(toMark);
      if (!error) inserted = toMark.length;
    }

    await supa.from('api_logs').insert({
      service: 'cron',
      endpoint: '/api/cron/check-abandoned-signups',
      status_code: 200,
      response_time_ms: Date.now() - t0,
    });
    return res.json({ ok: true, abandoned_marked: inserted, latencyMs: Date.now() - t0 });
  } catch (e: any) {
    try {
      const supa = await _opsCronSupabase();
      await supa.from('api_logs').insert({
        service: 'cron',
        endpoint: '/api/cron/check-abandoned-signups',
        status_code: 500,
        response_time_ms: Date.now() - t0,
        error_msg: (e?.message || 'error').slice(0, 500),
      });
    } catch { /* swallow */ }
    return res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
});

// ===== Cron: services heartbeat (every 15m) =====
// Auto-creates a 'warning' incident if Anthropic OR Apify error-rate in the
// last 30 minutes exceeds 30%. Always logs to api_logs so the Operations
// portal can show last heartbeat time.
app.get('/api/cron/services-heartbeat', async (req, res) => {
  if (!_cronAuthOk(req)) return res.status(401).json({ error: 'Unauthorized' });
  const t0 = Date.now();
  try {
    const supa = await _opsCronSupabase();
    const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    async function failureRate(service: string): Promise<{ rate: number; total: number; errors: number }> {
      const { data } = await supa
        .from('api_logs')
        .select('status_code')
        .eq('service', service)
        .gte('created_at', halfHourAgo);
      const rows = (data || []) as Array<{ status_code: number }>;
      const total = rows.length;
      const errors = rows.filter((r) => (r.status_code || 0) >= 400).length;
      return { rate: total > 0 ? errors / total : 0, total, errors };
    }

    async function alreadyIncident(service: string): Promise<boolean> {
      const { count } = await supa
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('affected_service', service)
        .eq('source', 'cron/services-heartbeat')
        .gte('created_at', oneHourAgo);
      return (count || 0) > 0;
    }

    const created: string[] = [];
    for (const service of ['anthropic', 'apify']) {
      const { rate, total, errors } = await failureRate(service);
      if (total > 0 && rate > 0.3 && !(await alreadyIncident(service))) {
        await supa.from('incidents').insert({
          severity: 'error',
          source: 'cron/services-heartbeat',
          title: `${service} error rate ${(rate * 100).toFixed(0)}% in last 30m`,
          description: `${errors}/${total} calls failed in the last 30 minutes.`,
          affected_service: service,
        });
        created.push(service);
      }
    }

    await supa.from('api_logs').insert({
      service: 'cron',
      endpoint: '/api/cron/services-heartbeat',
      status_code: 200,
      response_time_ms: Date.now() - t0,
    });
    return res.json({ ok: true, incidents_created: created, latencyMs: Date.now() - t0 });
  } catch (e: any) {
    try {
      const supa = await _opsCronSupabase();
      await supa.from('api_logs').insert({
        service: 'cron',
        endpoint: '/api/cron/services-heartbeat',
        status_code: 500,
        response_time_ms: Date.now() - t0,
        error_msg: (e?.message || 'error').slice(0, 500),
      });
    } catch { /* swallow */ }
    return res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
});

// ===== Avatar proxy =====
// LinkedIn (media.licdn.com), Google (lh3.googleusercontent.com), and other
// CDNs sometimes return 403 to browsers loading <img src="..."> directly
// because of strict Referer/origin checks. Proxy server-side to bypass.
const ALLOWED_AVATAR_HOSTS = new Set([
  'media.licdn.com',
  'static.licdn.com',
  'media-exp1.licdn.com',
  'media-exp2.licdn.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'avatars.githubusercontent.com',
  'pbs.twimg.com',
]);

app.get('/api/avatar-proxy', async (req, res) => {
  try {
    const url = (req.query.url as string) || '';
    if (!url) return res.status(400).send('url required');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).send('bad url');
    }
    if (!ALLOWED_AVATAR_HOSTS.has(parsed.hostname)) {
      return res.status(403).send('host not allowed');
    }

    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
        Referer: parsed.hostname.includes('licdn') ? 'https://www.linkedin.com/' : `https://${parsed.hostname}/`,
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send('upstream error');
    }

    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e: any) {
    console.error('[avatar-proxy] error:', e?.message);
    res.status(500).send('proxy error');
  }
});

// ===== Email Routes =====
const SUPABASE_URL_EMAIL = process.env.VITE_SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
const SUPABASE_SERVICE_KEY_EMAIL = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAILS_LIST = ['waselhup@gmail.com', 'almodhih.1995@gmail.com', 'alhashimali649@gmail.com'];

async function getUserFromAuthHeader(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const sb = createClient(SUPABASE_URL_EMAIL, SUPABASE_SERVICE_KEY_EMAIL);
  const { data: { user } } = await sb.auth.getUser(token);
  return user || null;
}

// Triggered by client right after signup completes — idempotent via welcome_email_sent flag
app.post('/api/email/welcome', async (req, res) => {
  try {
    const user = await getUserFromAuthHeader(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Followup Sweep #3: Dhai fraud-scan on new signup.
    // Fire-and-forget — never blocks welcome email even if Dhai is slow.
    // scanNewSignup reads signup_ip/email from profiles by user_id.
    (async () => {
      try {
        const { DhaiAgent } = await import('./agents/dhai');
        const dhai = new DhaiAgent();
        await dhai.scanNewSignup({ userId: user.id });
      } catch (err) {
        console.warn('[Dhai] signup scan failed (non-blocking):', err);
      }
    })();

    const sb = createClient(SUPABASE_URL_EMAIL, SUPABASE_SERVICE_KEY_EMAIL);
    const { data: profile } = await sb
      .from('profiles')
      .select('email, full_name, locale, welcome_email_sent')
      .eq('id', user.id)
      .single();

    if (!profile?.email) {
      return res.status(400).json({ error: 'Profile missing email' });
    }
    if (profile.welcome_email_sent) {
      return res.json({ ok: true, skipped: true, reason: 'already_sent' });
    }

    const result = await sendWelcomeEmail({
      email: profile.email,
      fullName: profile.full_name,
      language: profile.locale,
    });

    if (result.success) {
      await sb.from('profiles').update({ welcome_email_sent: true }).eq('id', user.id);
    }
    return res.json({ ok: result.success, ...result });
  } catch (e: any) {
    console.error('[email/welcome] error:', e?.message);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// Send analysis report by email — auth required
app.post('/api/analyzer/send-email', async (req, res) => {
  try {
    const user = await getUserFromAuthHeader(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { recipientEmail, language, result, linkedinUrl } = req.body || {};
    if (!recipientEmail || !result) {
      return res.status(400).json({ error: 'Missing recipientEmail or result' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const r = await sendAnalysisReportEmail({
      to: recipientEmail,
      language: language === 'en' ? 'en' : 'ar',
      overallScore: Number(result.overall_score ?? result.score ?? 0),
      headlineVerdict: typeof result.headline_verdict === 'string' ? result.headline_verdict : undefined,
      quickWinsCount: Array.isArray(result.quick_wins) ? result.quick_wins.length : 0,
      linkedinUrl: typeof linkedinUrl === 'string' ? linkedinUrl : undefined,
    });
    return res.json({ ok: r.success, ...r });
  } catch (e: any) {
    console.error('[analyzer/send-email] error:', e?.message);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// Admin-only test endpoint — sends a smoke-test email
app.post('/api/email/test', async (req, res) => {
  try {
    const user = await getUserFromAuthHeader(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!user.email || !ADMIN_EMAILS_LIST.includes(user.email)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const to = (req.body?.to as string) || user.email;
    const result = await sendTestEmail(to);
    return res.json({ ok: result.success, ...result });
  } catch (e: any) {
    console.error('[email/test] error:', e?.message);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
});

// ===== Gmail OAuth Routes =====
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = 'https://wasselhub.com/api/auth/google/callback';

app.get('/api/auth/google', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.send');
  const state = encodeURIComponent(userId);
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=${scopes}&state=${state}&access_type=offline&prompt=consent`;
  res.redirect(authUrl);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const userId = decodeURIComponent(req.query.state as string);
  if (!code || !userId) {
    return res.redirect('https://wasselhub.com/app/coming-soon?feature=campaigns');
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; refresh_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error('Google OAuth token error:', tokenData);
      return res.redirect('https://wasselhub.com/app/coming-soon?feature=campaigns');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hiqotmimlgsrsnovtopd.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    const updateData = { google_oauth_token: tokenData.access_token };
    if (tokenData.refresh_token) { updateData.google_refresh_token = tokenData.refresh_token; }
    const { error: dbError } = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (dbError) {
      console.error('Supabase update error:', dbError);
      return res.redirect('https://wasselhub.com/app/coming-soon?feature=campaigns');
    }
    res.redirect('https://wasselhub.com/app/coming-soon?feature=campaigns');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect('https://wasselhub.com/app/coming-soon?feature=campaigns');
  }
});

// ===== Unsubscribe (CAN-SPAM / PDPL compliance) =====
// One-click unsubscribe — /unsubscribe?t=<token>
app.get('/unsubscribe', async (req, res) => {
  const token = (req.query.t as string) || '';
  if (!token || token.length < 16) {
    return res.status(404).send('<h1>Not found</h1>');
  }
  try {
    const sb = createClient(SUPABASE_URL_EMAIL, SUPABASE_SERVICE_KEY_EMAIL);
    const { data: tok } = await sb
      .from('unsubscribe_tokens')
      .select('token, email, campaign_id, used_at')
      .eq('token', token)
      .single();
    if (!tok) return res.status(404).send('<h1>Not found</h1>');

    if (!tok.used_at) {
      await sb.from('unsubscribe_tokens').update({ used_at: new Date().toISOString() }).eq('token', token);
      await sb
        .from('email_suppressions')
        .upsert(
          [
            {
              email: tok.email,
              reason: 'unsubscribed',
              source_campaign_id: tok.campaign_id,
            },
          ],
          { onConflict: 'email' }
        );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>body{font-family:-apple-system,Cairo,Arial,sans-serif;background:#F9FAFB;color:#111827;margin:0;padding:48px 16px;text-align:center;}
.card{max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.06);}
h1{font-size:22px;margin:0 0 12px;}p{font-size:14px;line-height:1.7;color:#374151;margin:0 0 16px;}a{color:#0A8F84;}</style>
</head><body><div class="card">
<h1>You have been unsubscribed ✓</h1>
<p>The email <strong>${tok.email}</strong> will no longer receive outreach from Wassel.</p>
<p>If you unsubscribed by mistake, <a href="mailto:support@wasselhub.com">let us know</a>.</p>
<p style="font-size:11px;color:#9CA3AF;margin-top:24px;">© 2026 Wassel · Made in Saudi Arabia</p>
</div></body></html>`);
  } catch (e: any) {
    console.error('[unsubscribe] error:', e?.message);
    res.status(500).send('<h1>Something went wrong</h1>');
  }
});

// ============================================================
// WhatsApp Business Cloud API webhook (Meta v20.0)
// ============================================================
app.get('/api/webhooks/whatsapp', (req, res) => {
  const mode = (req.query['hub.mode'] as string) || null;
  const token = (req.query['hub.verify_token'] as string) || null;
  const challenge = (req.query['hub.challenge'] as string) || null;
  const ok = whatsapp.verifyWebhookChallenge(mode, token, challenge);
  if (ok) return res.status(200).send(ok);
  return res.status(403).json({ error: 'verify_failed' });
});

app.post('/api/webhooks/whatsapp', async (req: any, res) => {
  const sig = req.headers['x-hub-signature-256'] as string | undefined;
  const raw = req.rawBody || JSON.stringify(req.body);
  if (!whatsapp.verifyWebhookSignature(raw, sig)) {
    return res.status(401).json({ error: 'bad_signature' });
  }
  try {
    const messages = whatsapp.parseInboundWebhook(req.body);
    const sb = await _supa();
    for (const m of messages) {
      await sb.from('whatsapp_messages').insert({
        agent_id: 'al_mukhadram',
        direction: 'inbound',
        to_phone: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        from_phone: m.fromPhone,
        message_type: m.type,
        body: m.body,
        whatsapp_message_id: m.whatsappMessageId,
        status: 'delivered',
        raw_payload: m.raw,
      });
      // best-effort: queue Al-Mukhadram support reply task (admin will review/approve)
      try {
        const { data: user } = await sb.from('profiles').select('id, language').eq('phone', m.fromPhone).maybeSingle();
        if (user?.id) {
          await alMukhadram.draftSupportReply({ userId: user.id, inboundMessage: m.body, channel: 'whatsapp' });
        }
      } catch (e: any) {
        console.warn('[whatsapp webhook] reply draft failed:', e?.message);
      }
    }
    res.status(200).json({ ok: true, count: messages.length });
  } catch (e: any) {
    console.error('[whatsapp webhook] failed:', e?.message);
    sentryCapture(e, { route: '/api/webhooks/whatsapp' });
    res.status(500).json({ error: 'webhook_processing_failed' });
  }
});

// ============================================================
// New batch 2+3 crons — Al-Mukhadram / Hassan / Fatima / Dhai / Hussein / Mohammed
// ============================================================
function _cronWrap(name: string, fn: () => Promise<any>) {
  return async (req: any, res: any) => {
    if (!_cronAuthOk(req)) return res.status(401).json({ error: 'Unauthorized' });
    const t0 = Date.now();
    try {
      const result = await fn();
      // Use actual api_logs schema columns (status_code, response_time_ms,
      // error_msg) — the previous version used severity/latency_ms/etc.
      // which silently rejected, so no cron observability ever worked.
      try {
        const sb = await _supa();
        await sb.from('api_logs').insert({
          service: 'cron',
          endpoint: `/api/cron/${name}`,
          status_code: 200,
          response_time_ms: Date.now() - t0,
          error_msg: null,
        });
      } catch (logErr: any) {
        console.warn(`[cron/${name}] log insert failed (non-fatal):`, logErr?.message);
      }
      res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error(`[cron/${name}] failed:`, e?.message);
      sentryCapture(e, { cron: name });
      // Catch-of-catch: even if the log insert blows up, we still want to
      // respond 500 to the client so the connection doesn't hang.
      try {
        const sb = await _supa();
        await sb.from('api_logs').insert({
          service: 'cron',
          endpoint: `/api/cron/${name}`,
          status_code: 500,
          response_time_ms: Date.now() - t0,
          error_msg: String(e?.message || e).slice(0, 500),
        });
      } catch (logErr: any) {
        console.warn(`[cron/${name}] error log insert failed:`, logErr?.message);
      }
      res.status(500).json({ error: 'cron_failed', message: e?.message });
    }
  };
}

app.get('/api/cron/al-mukhadram-daily', _cronWrap('al-mukhadram-daily', async () => {
  const rescues = await alMukhadram.draftDailyRescues(15);
  const vips = await alMukhadram.flagVipsForOutreach();
  return { rescues, vips };
}));
app.get('/api/cron/hassan-hot-leads', _cronWrap('hassan-hot-leads', async () => {
  return hassan.draftHotUpgradePitches({ limit: 10, minPropensity: 0.5 });
}));
app.get('/api/cron/fatima-friction-scan', _cronWrap('fatima-friction-scan', async () => {
  return fatima.detectFrictionPatterns({ lookbackDays: 7 });
}));
app.get('/api/cron/fatima-weekly-report', _cronWrap('fatima-weekly-report', async () => {
  return fatima.generateWeeklyReport();
}));
app.get('/api/cron/email-sequences-runner', _cronWrap('email-sequences-runner', async () => {
  // Send any scheduled enrollment messages whose next_send_at has passed.
  const sb = await _supa();
  const { data: due } = await sb.from('user_sequence_enrollments')
    .select('id, user_id, sequence_id, current_step')
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(50);
  let processed = 0;
  for (const e of due || []) {
    await sb.from('user_sequence_enrollments').update({
      current_step: (e.current_step || 0) + 1,
      last_sent_at: new Date().toISOString(),
      next_send_at: new Date(Date.now() + 86400 * 1000).toISOString(),
    }).eq('id', e.id);
    processed++;
  }
  return { processed };
}));
app.get('/api/cron/recompute-health-scores', _cronWrap('recompute-health-scores', async () => {
  return alMukhadram.recomputeAllScores(500);
}));
app.get('/api/cron/dhai-daily-sweep', _cronWrap('dhai-daily-sweep', async () => {
  return dhai.dailyComplianceSweep();
}));
app.get('/api/cron/hussein-auto-resolve', _cronWrap('hussein-auto-resolve', async () => {
  return hussein.autoResolveKnownErrors();
}));
app.get('/api/cron/mohammed-reconcile', _cronWrap('mohammed-reconcile', async () => {
  return mohammed.reconcileMoyasarDaily();
}));
app.get('/api/cron/mohammed-snapshot', _cronWrap('mohammed-snapshot', async () => {
  return mohammed.computeFinanceSnapshot();
}));
app.get('/api/cron/war-room-weekly-journal', _cronWrap('war-room-weekly-journal', async () => {
  // Generate Faris's weekly synthesis for each admin user.
  const sb = await _supa();
  const { data: admins } = await sb.from('profiles').select('id').eq('is_admin', true);
  const results: Array<{ userId: string; ok: boolean; created?: boolean; error?: string }> = [];
  for (const row of (admins || []) as Array<{ id: string }>) {
    try {
      const r = await warRoomGenerateWeeklyJournal(row.id, 'ar');
      results.push({ userId: row.id, ok: true, created: r.created });
    } catch (e: any) {
      results.push({ userId: row.id, ok: false, error: e?.message || String(e) });
    }
  }
  return { processed: results.length, results };
}));

// ===== Cron: dashboard suggestions (nightly at 02:00 AST = 23:00 UTC) =====
// For every user active in the last 30 days:
//   1. Generate a Next Task suggestion via the next-task prompt
//   2. Snapshot today's Career Pulse (radar / resume / content / wallet)
// Also expires any suggestions whose expires_at has passed.
app.get('/api/cron/dashboard-suggestions', _cronWrap('dashboard-suggestions', async () => {
  const sb = await _supa();

  // 1. Expire old suggestions in one shot
  await sb
    .from('ai_suggestions')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());

  // 2. Pick active users (logged a meaningful activity in the last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from('activity_log')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo)
    .limit(5000);

  const activeIds = Array.from(
    new Set(((recent ?? []) as Array<{ user_id: string }>).map((r) => r.user_id).filter(Boolean)),
  );

  // 3. Also include any user with a career_profile (so brand-new users get a nudge too)
  const { data: profiles } = await sb.from('career_profile').select('user_id, primary_language');
  for (const row of (profiles ?? []) as Array<{ user_id: string }>) {
    if (!activeIds.includes(row.user_id)) activeIds.push(row.user_id);
  }

  const langByUser = new Map<string, 'ar' | 'en'>();
  for (const row of (profiles ?? []) as Array<{ user_id: string; primary_language: 'ar' | 'en' }>) {
    langByUser.set(row.user_id, row.primary_language || 'ar');
  }

  let generated = 0;
  let snapshotted = 0;
  const errors: Array<{ userId: string; error: string }> = [];

  for (const userId of activeIds) {
    try {
      const lang = langByUser.get(userId) ?? 'ar';
      const r = await dashboardGenerateSuggestions(sb, userId, lang);
      generated += r.generated;
      await dashboardSnapshotPulse(sb, userId);
      snapshotted++;
    } catch (e: any) {
      errors.push({ userId, error: e?.message || String(e) });
    }
  }

  return {
    activeUsers: activeIds.length,
    generated,
    snapshotted,
    errors: errors.slice(0, 10),
  };
}));

// ===== Cron: expire-bonuses (Sprint 7, daily at 00:00 UTC) =====
// Sweeps goal_completion_bonuses where expires_at < NOW() AND status='active'.
// The wallet_bonus.expires_at column gates availability via deduct_tokens_v2,
// so the visible balance "drops" automatically the moment the timestamp
// passes. This cron just marks the bonus row as expired and writes an audit
// trail so admin/finance can attribute the wallet drop.
app.get('/api/cron/expire-bonuses', _cronWrap('expire-bonuses', async () => {
  const sb = await _supa();
  const { data, error } = await sb.rpc('expire_bonuses');
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>) ?? {};
}));

// ===== Cron: subscription-renewals (Sprint 7, daily at 01:00 UTC) =====
// For every active user_subscriptions row whose current_period_end is in the
// past (auto-renew=true), the cron calls grant_subscription_tokens to refill
// wallet_subscription with the plan's monthly tokens and advance the period.
//
// Scheduled downgrades (metadata.downgrade_to) are honored — we grant tokens
// for the NEW plan and update plan_id on the subscription row.
//
// Cancellations (auto_renew=false) are marked 'expired' and the user drops
// to 'free' on profile.current_plan.
//
// Moyasar charges still go through Moyasar subscriptions on its side; this
// cron only mirrors the post-charge state. For setups without Moyasar
// recurring billing (early-access manual subscriptions), this cron is the
// only renewal path.
app.get('/api/cron/subscription-renewals', _cronWrap('subscription-renewals', async () => {
  const sb = await _supa();
  const nowIso = new Date().toISOString();

  // Find subscriptions whose period has ended.
  const { data: due, error: dueErr } = await sb
    .from('user_subscriptions')
    .select('id, user_id, plan_id, billing_cycle, status, auto_renew, current_period_end, metadata')
    .in('status', ['active', 'trialing'])
    .lt('current_period_end', nowIso)
    .limit(500);

  if (dueErr) throw new Error(dueErr.message);

  let renewed = 0;
  let cancelled = 0;
  let downgraded = 0;
  const errors: Array<{ subId: string; error: string }> = [];

  for (const row of (due ?? []) as Array<{
    id: string;
    user_id: string;
    plan_id: string;
    billing_cycle: 'monthly' | 'annual';
    auto_renew: boolean;
    metadata: Record<string, unknown> | null;
  }>) {
    try {
      if (!row.auto_renew) {
        // Cancellation: mark expired, drop user to free
        await sb
          .from('user_subscriptions')
          .update({ status: 'expired', updated_at: nowIso })
          .eq('id', row.id);
        await sb
          .from('profiles')
          .update({
            current_plan: 'free',
            subscription_cancel_at_period_end: false,
            subscription_next_renewal_at: null,
            updated_at: nowIso,
          })
          .eq('id', row.user_id);
        await sb.from('activity_log').insert({
          user_id: row.user_id,
          action: 'subscription.expired',
          target: row.id,
          payload: { plan: row.plan_id },
          pillar: 'wallet',
          tokens_charged: 0,
        });
        cancelled++;
        continue;
      }

      // Scheduled downgrade?
      const downgradeTo = (row.metadata?.downgrade_to as string) || null;
      const newPlanId = downgradeTo || row.plan_id;

      const { error: grantErr } = await sb.rpc('grant_subscription_tokens', {
        p_user_id: row.user_id,
        p_plan_id: newPlanId,
        p_subscription_id: row.id,
        p_billing_cycle: row.billing_cycle || 'monthly',
        p_is_first: false,
      });
      if (grantErr) throw new Error(`grant_subscription_tokens: ${grantErr.message}`);

      // Compute new period_end and persist on the row
      const periodEnd = new Date();
      if (row.billing_cycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      const cleanedMeta = { ...(row.metadata || {}) };
      delete cleanedMeta.downgrade_to;
      delete cleanedMeta.downgrade_scheduled_at;

      await sb
        .from('user_subscriptions')
        .update({
          plan_id: newPlanId,
          current_period_start: nowIso,
          current_period_end: periodEnd.toISOString(),
          metadata: cleanedMeta,
          updated_at: nowIso,
        })
        .eq('id', row.id);

      if (downgradeTo) downgraded++;
      else renewed++;
    } catch (e: any) {
      errors.push({ subId: row.id, error: e?.message || String(e) });
    }
  }

  return { renewed, cancelled, downgraded, errors: errors.slice(0, 10) };
}));

// ===== Cron: process-email-queue (Sprint 8, every 5 minutes) =====
// Picks up pending email notifications (channel IN ('email','both') AND
// status='pending' AND scheduled_for <= NOW()) and sends them via Resend.
// Frequency caps + dedup are already enforced at enqueue time, so this cron
// is purely a sender.
app.get('/api/cron/process-email-queue', _cronWrap('process-email-queue', async () => {
  const sb = await _supa();
  return notificationsProcessEmailQueue(sb, 50);
}));

// ===== Cron: notification-triggers (Sprint 8, daily at 06:00 UTC) =====
// Scans the user base and enqueues one-shot system notifications:
//   - balance_low:           users with wallet total < 30 tokens
//   - subscription_renewal:  active subs whose current_period_end is in next 3 days
//   - bonus_expiring:        wallet_bonus rows whose expires_at is in next 7 days
// Frequency caps in the enqueue RPC make this safe to run daily (e.g. balance_low
// is capped to 1× per 7 days per user).
app.get('/api/cron/notification-triggers', _cronWrap('notification-triggers', async () => {
  const sb = await _supa();
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let balanceLow = 0;
  let renewals  = 0;
  let bonusExpiring = 0;
  let skipped = 0;
  const errors: Array<{ stage: string; userId?: string; error: string }> = [];

  // 1. balance_low — query the snapshot view if available, otherwise sum wallets per user
  try {
    const { data: users } = await sb
      .from('profiles')
      .select('id')
      .limit(5000);

    for (const row of (users ?? []) as Array<{ id: string }>) {
      try {
        const { data: walletData } = await sb.rpc('get_wallets_v2', { p_user_id: row.id });
        const total = Number((walletData as Record<string, unknown> | null)?.total ?? 0);
        if (total > 0 && total < 30) {
          const r = await notificationsEnqueue(sb, {
            userId:      row.id,
            templateKey: 'balance_low',
            category:    'system',
            channel:     'both',
            titleAr:     'رصيدك قارب على النفاد',
            titleEn:     'Your balance is running low',
            bodyAr:      `تبقى لك ${total} توكن. أضف توكنات لمتابعة رحلتك المهنية.`,
            bodyEn:      `You have ${total} tokens left. Add tokens to continue your career journey.`,
            ctaLabelAr:  'إضافة توكنات',
            ctaLabelEn:  'Add tokens',
            ctaUrl:      'https://wasselhub.com/v2/pricing',
            priority:    'normal',
            metadata:    { balance: total },
          });
          if (r.queued) balanceLow++; else if (r.skipped) skipped++;
        }
      } catch (e: any) {
        errors.push({ stage: 'balance_low', userId: row.id, error: e?.message || String(e) });
      }
    }
  } catch (e: any) {
    errors.push({ stage: 'balance_low_query', error: e?.message || String(e) });
  }

  // 2. subscription_renewal — active subs whose period ends in next 3 days
  try {
    const { data: subs } = await sb
      .from('user_subscriptions')
      .select('id, user_id, plan_id, current_period_end, auto_renew, billing_cycle')
      .eq('status', 'active')
      .gte('current_period_end', now.toISOString())
      .lte('current_period_end', in3d.toISOString())
      .limit(2000);

    for (const sub of (subs ?? []) as Array<{
      user_id: string; plan_id: string; current_period_end: string; auto_renew: boolean; billing_cycle: string;
    }>) {
      try {
        const { data: planRow } = await sb
          .from('subscription_plans')
          .select('name_ar, name_en, monthly_price_sar, annual_price_sar')
          .eq('id', sub.plan_id)
          .maybeSingle();

        const planAr   = planRow?.name_ar || 'الباقة';
        const planEn   = planRow?.name_en || 'plan';
        const amount   = sub.billing_cycle === 'annual'
          ? Number(planRow?.annual_price_sar ?? 0)
          : Number(planRow?.monthly_price_sar ?? 0);
        const dateAr   = new Date(sub.current_period_end).toLocaleDateString('en-GB');
        const dateEn   = dateAr;

        const r = await notificationsEnqueue(sb, {
          userId:      sub.user_id,
          templateKey: 'subscription_renewal',
          category:    'system',
          channel:     'both',
          titleAr:     'اشتراكك يتجدد قريباً',
          titleEn:     'Your subscription renews soon',
          bodyAr:      `اشتراك ${planAr} يتجدد في ${dateAr} بمبلغ ${amount} ر.س.`,
          bodyEn:      `Your ${planEn} subscription renews on ${dateEn} for ${amount} SAR.`,
          ctaLabelAr:  'إدارة الاشتراك',
          ctaLabelEn:  'Manage subscription',
          ctaUrl:      'https://wasselhub.com/v2/billing',
          priority:    'normal',
          metadata:    { plan: planEn, amount },
        });
        if (r.queued) renewals++; else if (r.skipped) skipped++;
      } catch (e: any) {
        errors.push({ stage: 'subscription_renewal', userId: sub.user_id, error: e?.message || String(e) });
      }
    }
  } catch (e: any) {
    errors.push({ stage: 'subscription_renewal_query', error: e?.message || String(e) });
  }

  // 3. bonus_expiring — wallet_bonus rows expiring in next 7 days with balance > 0
  try {
    const { data: bonuses } = await sb
      .from('wallet_bonus')
      .select('user_id, balance, expires_at')
      .gt('balance', 0)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', in7d.toISOString())
      .limit(2000);

    for (const b of (bonuses ?? []) as Array<{ user_id: string; balance: number; expires_at: string }>) {
      try {
        const dateStr = new Date(b.expires_at).toLocaleDateString('en-GB');
        const r = await notificationsEnqueue(sb, {
          userId:      b.user_id,
          templateKey: 'bonus_expiring',
          category:    'engagement',
          channel:     'both',
          titleAr:     'مكافأتك تنتهي قريباً',
          titleEn:     'Your bonus expires soon',
          bodyAr:      `${b.balance} توكن مكافأة تنتهي في ${dateStr}. استخدمها قبل أن تخسرها.`,
          bodyEn:      `${b.balance} bonus tokens expire on ${dateStr}. Use them before they're gone.`,
          ctaLabelAr:  'ابدأ الآن',
          ctaLabelEn:  'Start now',
          ctaUrl:      'https://wasselhub.com/v2/home',
          priority:    'normal',
          metadata:    { bonusTokens: b.balance },
        });
        if (r.queued) bonusExpiring++; else if (r.skipped) skipped++;
      } catch (e: any) {
        errors.push({ stage: 'bonus_expiring', userId: b.user_id, error: e?.message || String(e) });
      }
    }
  } catch (e: any) {
    errors.push({ stage: 'bonus_expiring_query', error: e?.message || String(e) });
  }

  return {
    balanceLow,
    renewals,
    bonusExpiring,
    skipped,
    errors: errors.slice(0, 10),
  };
}));

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Vercel serverless handler â€” export as a function that calls Express
module.exports = (req: IncomingMessage, res: ServerResponse) => {
  return app(req, res);
};
