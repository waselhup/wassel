import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, Mail, Loader2, Clock, RefreshCw } from 'lucide-react';

const COOLDOWN_SECONDS = 60;
const COOLDOWN_KEY = 'wassel_login_cooldown';

function getCooldownRemaining(): number {
  const stored = localStorage.getItem(COOLDOWN_KEY);
  if (!stored) return 0;
  const expiry = parseInt(stored, 10);
  const remaining = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  return remaining;
}

function setCooldown() {
  localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_SECONDS * 1000));
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldownState] = useState(getCooldownRemaining());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setInterval(() => {
        const remaining = getCooldownRemaining();
        setCooldownState(remaining);
        if (remaining <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown > 0]);

  const isRateLimitError = (msg: string) => {
    const lower = msg.toLowerCase();
    return (
      lower.includes('rate limit') ||
      lower.includes('too many') ||
      lower.includes('exceeded') ||
      lower.includes('email rate') ||
      lower.includes('429')
    );
  };

  const handleMagicLink = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check cooldown
    const remaining = getCooldownRemaining();
    if (remaining > 0) {
      setCooldownState(remaining);
      setError(`الرجاء الانتظار ${remaining} ثانية قبل المحاولة مرة أخرى`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || 'حدث خطأ ما';

        // Detect rate limit and apply longer cooldown
        if (isRateLimitError(errMsg)) {
          setCooldown();
          setCooldownState(COOLDOWN_SECONDS);
          throw new Error('تم تجاوز الحد الأقصى للمحاولات. الرجاء الانتظار دقيقة واحدة قبل المحاولة مرة أخرى.');
        }

        throw new Error(errMsg);
      }

      // Success — apply cooldown to prevent spam
      setSentEmail(email);
      setCooldown();
      setCooldownState(COOLDOWN_SECONDS);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ ما');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleResend = useCallback(() => {
    setSuccess(false);
    setEmail(sentEmail);
    setError('');
  }, [sentEmail]);

  const isCoolingDown = cooldown > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">وصل</h1>
          <p className="text-gray-600">منصة ذكية لإدارة حملات LinkedIn</p>
        </div>

        {/* Card */}
        <Card className="p-8 shadow-lg">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">تحقق من بريدك الإلكتروني</h2>
              <p className="text-gray-600">
                أرسلنا رابط تسجيل الدخول إلى <span className="font-semibold">{sentEmail}</span>
              </p>
              <p className="text-sm text-gray-500">
                قد يستغرق الأمر بضع دقائق. تحقق من مجلد الرسائل غير المرغوبة إذا لم تجده.
              </p>

              {/* Resend with cooldown */}
              <div className="pt-4 space-y-3">
                {isCoolingDown ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>يمكنك إعادة الإرسال بعد {cooldown} ثانية</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleResend}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    إعادة إرسال الرابط
                  </Button>
                )}

                <Button
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                    setSentEmail('');
                    setError('');
                  }}
                  variant="ghost"
                  className="w-full text-gray-500"
                >
                  جرب بريد إلكتروني آخر
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  بريدك الإلكتروني
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ahmed@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || isCoolingDown}
                  required
                  className="w-full"
                  dir="ltr"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {isCoolingDown && !error && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    الرجاء الانتظار {cooldown} ثانية قبل إرسال رابط جديد
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email || isCoolingDown}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : isCoolingDown ? (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    انتظر {cooldown} ثانية
                  </>
                ) : (
                  'أرسل رابط تسجيل الدخول'
                )}
              </Button>

              <p className="text-center text-sm text-gray-500">
                سنرسل لك رابط تسجيل دخول آمن إلى بريدك الإلكتروني. لن نشارك بريدك مع أحد.
              </p>
            </form>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          بإنشاء حساب، فإنك توافق على شروطنا وسياستنا
        </p>
      </div>
    </div>
  );
}
