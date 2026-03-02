import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, Mail, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'حدث خطأ ما');
      }

      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ ما');
    } finally {
      setLoading(false);
    }
  };

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
                أرسلنا رابط تسجيل الدخول إلى <span className="font-semibold">{email}</span>
              </p>
              <p className="text-sm text-gray-500">
                قد يستغرق الأمر بضع دقائق. تحقق من مجلد الرسائل غير المرغوبة إذا لم تجده.
              </p>
              <Button
                onClick={() => setSuccess(false)}
                variant="outline"
                className="w-full mt-6"
              >
                جرب بريد إلكتروني آخر
              </Button>
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
                  disabled={loading}
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

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    جاري الإرسال...
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
