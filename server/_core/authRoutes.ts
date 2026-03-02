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
    const origin = req.get('origin') || process.env.VITE_FRONTEND_URL || 'http://localhost:3000';
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

export default router;
