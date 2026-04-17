import { telegramHandler } from './telegram';
import { postsRouter } from './routes/posts';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc';
import { createContext } from './context';
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail, sendTestEmail } from './lib/email';

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://wassel.vercel.app',
        'https://wassel-alpha.vercel.app',
        'https://wassel-waselhupsas-projects.vercel.app',
        'https://wassel-git-master-waselhupsas-projects.vercel.app',
        'https://wassel.sa',
      ]
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.post('/api/telegram', telegramHandler);

// ===== Posts Routes =====
app.use('/api/posts', postsRouter);

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
const GOOGLE_REDIRECT_URI = 'https://wassel-alpha.vercel.app/api/auth/google/callback';

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
    return res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
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
      return res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
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
      return res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
    }
    res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=connected');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect('https://wassel-alpha.vercel.app/app/campaigns?gmail=error');
  }
});

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
