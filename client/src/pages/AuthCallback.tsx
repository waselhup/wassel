import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Give Supabase a moment to process the callback
        await new Promise(resolve => setTimeout(resolve, 500));

        // Supabase automatically handles the callback from the URL
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Auth callback error:', sessionError);
          setError('فشل التحقق من جلستك. الرجاء محاولة تسجيل الدخول مرة أخرى.');
          setIsProcessing(false);
          return;
        }

        if (session?.user) {
          // Session is established, redirect to dashboard
          navigate('/dashboard');
        } else {
          setError('لم نتمكن من إنشاء جلسة. الرجاء محاولة تسجيل الدخول مرة أخرى.');
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Callback handling failed:', error);
        setError('حدث خطأ غير متوقع. الرجاء محاولة تسجيل الدخول مرة أخرى.');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (isProcessing && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-gray-700 font-medium mb-2">جاري تسجيل دخولك...</p>
          <p className="text-sm text-gray-500">يرجى الانتظار قليلاً</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-3">
              حدث خطأ في تسجيل الدخول
            </h1>

            <p className="text-gray-600 text-center mb-8">
              {error}
            </p>

            <Button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5"
            >
              العودة إلى تسجيل الدخول
            </Button>

            <p className="text-center text-xs text-gray-500 mt-6">
              إذا استمرت المشكلة، يرجى التواصل مع الدعم
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
