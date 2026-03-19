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
    const handleCallback = async () => {
      try {
        // Read the intended destination from ?next= query param
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next') || '/app';

        // Give Supabase time to process the hash fragment (#access_token=...)
        // onAuthStateChange will fire when the session is established
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            subscription.unsubscribe();

            if (session?.user) {
              // Session established — navigate to intended destination
              window.location.href = next;
            } else {
              // No session came through — check manually one more time
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession?.user) {
                window.location.href = next;
              } else {
                setError('لم نتمكن من إنشاء جلسة. الرجاء محاولة تسجيل الدخول مرة أخرى.');
                setIsProcessing(false);
              }
            }
          }
        );

        // Fallback: if onAuthStateChange doesn't fire within 5s, check session directly
        setTimeout(async () => {
          subscription.unsubscribe();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const next2 = new URLSearchParams(window.location.search).get('next') || '/app';
            window.location.href = next2;
          } else if (isProcessing) {
            setError('انتهت مهلة التحقق. الرجاء محاولة تسجيل الدخول مرة أخرى.');
            setIsProcessing(false);
          }
        }, 5000);

      } catch (err) {
        console.error('Callback handling failed:', err);
        setError('حدث خطأ غير متوقع. الرجاء محاولة تسجيل الدخول مرة أخرى.');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, []);

  if (isProcessing && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>جاري تسجيل دخولك...</p>
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
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#fef2f2' }}>
                <AlertCircle className="w-8 h-8" style={{ color: '#dc2626' }} />
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
              className="w-full text-white font-semibold py-2.5"
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
