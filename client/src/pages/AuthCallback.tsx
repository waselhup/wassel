import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
// IMPORTANT: always use the shared client — never create a second createClient()
// Multiple Supabase instances on the same page cause "Lock broken by another
// request with the 'steal' option" errors that corrupt the session.
import { supabase } from '@/contexts/AuthContext';

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

        // Step 1: fast path — session may already be stored from the hash
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (existing?.user) {
          finish(next);
          return;
        }

        // Step 2: subscribe to catch the SIGNED_IN event from hash processing
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

        // Step 3: poll at 1.5s — covers the case where the event fired before subscribe
        setTimeout(async () => {
          if (handled) return;
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s?.user) { subscription.unsubscribe(); finish(next); }
        }, 1500);

        // Step 4: hard timeout at 8s
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertCircle className="w-7 h-7" style={{ color: '#ef4444' }} />
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
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}
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
