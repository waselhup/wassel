import { telegramHandler } from './telegram';
import { postsRouter } from './routes/posts';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc';
import { createContext } from './context';
import type { IncomingMessage, ServerResponse } from 'http';

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

app.use(express.json());

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


app.get('/api/test-route', (_req, res) => { res.json({ok:true,routes:'working'}); });

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
