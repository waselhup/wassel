import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let handled = false;

    const finish = (destination: string) => {
      if (handled) return;
      handled = true;
      window.location.href = destination;
    };

    const fail = (msg: string) => {
      if (handled) return;
      handled = true;
      setError(msg);
      setIsProcessing(false);
    };

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next') || '/app';

        // Step 1: check if Supabase already processed the hash (fast path)
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (existing?.user) {
          finish(next);
          return;
        }

        // Step 2: subscribe BEFORE we might miss the event
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            subscription.unsubscribe();
            if (session?.user) {
              finish(next);
            } else {
              fail('لم نتمكن من إنشاء جلسة. الرجاء محاولة تسجيل الدخول مرة أخرى.');
            }
          }
        );

        // Step 3: poll fallback — onAuthStateChange can fire before subscribe in some Supabase versions
        // so we check again after a short delay
        setTimeout(async () => {
          if (handled) return;
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            subscription.unsubscribe();
            finish(next);
          }
        }, 1500);

        // Step 4: hard timeout — if nothing worked in 8s, show error
        setTimeout(() => {
          if (!handled) {
            subscription.unsubscribe();
            fail('انتهت مهلة التحقق. الرجاء المحاولة مرة أخرى.');
          }
        }, 8000);

      } catch (err) {
        console.error('[AuthCallback] error:', err);
        fail('حدث خطأ غير متوقع. الرجاء محاولة تسجيل الدخول مرة أخرى.');
      }
    };

    handleCallback();
  }, []);

  if (isProcessing && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>جاري تسجيل دخولك...</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>يرجى الانتظار قليلاً</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#fef2f2' }}>
                <AlertCircle className="w-7 h-7" style={{ color: '#dc2626' }} />
              </div>
            </div>
            <h1 className="text-xl font-bold text-center mb-3" style={{ color: 'var(--text-primary)' }}>
              حدث خطأ في تسجيل الدخول
            </h1>
            <p className="text-center mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {error}
            </p>
            <Button
              onClick={() => { window.location.href = '/login'; }}
              className="w-full text-white font-semibold"
              style={{ background: 'var(--gradient-primary)' }}
            >
              العودة إلى تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
