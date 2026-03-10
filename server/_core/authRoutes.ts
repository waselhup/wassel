import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * POST /api/auth/magic-link
 * Request magic link for email
 */
router.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }

    // Get the origin from the request for redirect URL
    const origin = req.get('origin') || process.env.VITE_FRONTEND_URL || process.env.APP_URL || 'https://wassel-alpha.vercel.app';
    const redirectUrl = `${origin}/auth/callback`;

    // Send magic link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('Magic link error:', error);

      // Detect rate limit errors from Supabase
      const errMsg = (error.message || '').toLowerCase();
      if (errMsg.includes('rate') || errMsg.includes('exceeded') || errMsg.includes('too many') || error.status === 429) {
        return res.status(429).json({
          error: 'تم تجاوز الحد الأقصى لعدد المحاولات. الرجاء الانتظار دقيقة قبل المحاولة مرة أخرى.',
          rateLimited: true,
        });
      }

      return res.status(400).json({ error: error.message || 'فشل إرسال رابط تسجيل الدخول' });
    }

    res.json({ success: true, message: 'تم إرسال رابط تسجيل الدخول' });
  } catch (error) {
    console.error('Magic link endpoint error:', error);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP token from magic link
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, token, type = 'magiclink' } = req.body;

    if (!email || !token) {
      return res.status(400).json({ error: 'البريد الإلكتروني والرمز مطلوبان' });
    }

    // Verify the OTP
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: (type === 'magiclink' ? 'magiclink' : 'email') as 'magiclink' | 'email',
    });

    if (error) {
      console.error('OTP verification error:', error);
      return res.status(400).json({ error: error.message || 'فشل التحقق من الرمز' });
    }

    if (!data.session) {
      return res.status(400).json({ error: 'فشل إنشاء جلسة' });
    }

    // Session is created, return session info
    res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      },
    });
  } catch (error) {
    console.error('OTP verification endpoint error:', error);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

/**
 * POST /api/auth/extension-token
 * Generate a short-lived signed token for the Chrome extension.
 * Requires: Authorization: Bearer <supabase_jwt>
 * Body (optional): { target_client_id?: string } — for admin operate-as-client mode
 * Returns: { token, expiresAt, userId, role, teamId }
 */
router.post('/extension-token', async (req, res) => {
  try {
    // Extract user from JWT
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !authUser) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Load profile role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    const role = profile?.role || 'client_user';

    // Load team ID
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', authUser.id)
      .limit(1)
      .single();

    const teamId = membership?.team_id || null;

    // Optional: admin can provide target_client_id for operate-as-client
    const { target_client_id } = req.body || {};
    if (target_client_id && role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can use operate-as-client mode' });
    }

    // Create signed extension token (1 hour expiry)
    const crypto = require('crypto');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const payload = {
      userId: authUser.id,
      email: authUser.email,
      role,
      teamId,
      targetClientId: target_client_id || null,
      exp: expiresAt,
      iss: 'wassel-ext',
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'wassel-ext-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');

    const extensionToken = `${payloadBase64}.${signature}`;

    console.log(`[Auth] EXTENSION_TOKEN_OK user=${authUser.id.substring(0, 8)}... role=${role} target_client=${target_client_id || 'none'}`);

    res.json({
      token: extensionToken,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      userId: authUser.id,
      email: authUser.email,
      role,
      teamId,
      targetClientId: target_client_id || null,
    });
  } catch (error: any) {
    console.error('[Auth] Extension token error:', error.message || error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
