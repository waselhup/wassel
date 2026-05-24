import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';
import { supabase } from '@/lib/supabase';
import Button from './Button';

interface GuestCheckoutFormProps {
  /** Heading copy — what they're about to buy. */
  title?: string;
  /** Subheading copy under the title — usually plan/product name + price. */
  subtitle?: string;
  /** Fired when guest account is provisioned and the supabase session is set. */
  onAuthenticated: () => void;
  /** Fired when the user dismisses the form. */
  onCancel: () => void;
}

/**
 * Standalone guest-checkout form modal — collects name/phone/email,
 * provisions a Supabase auth user via pricing.createGuestAccount, plants
 * the returned session on supabase-js so AuthContext flips to signed-in,
 * then calls `onAuthenticated()` so the caller can proceed with the
 * existing protected purchase flow.
 *
 * Visually mirrors the guest-form step inside CheckoutModal so the two
 * checkout entry points (plans and products) feel identical.
 */
export default function GuestCheckoutForm({
  title,
  subtitle,
  onAuthenticated,
  onCancel,
}: GuestCheckoutFormProps) {
  const { i18n } = useTranslation();
  const [, navigate] = useLocation();
  const isAr = i18n.language === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, creating]);

  async function handleSubmit() {
    setError(null);
    if (fullName.trim().length < 2) {
      setError(t('الرجاء إدخال الاسم الكامل', 'Please enter your full name'));
      return;
    }
    if (!/[0-9]/.test(phone) || phone.replace(/\D/g, '').length < 9) {
      setError(t('الرجاء إدخال رقم جوّال صحيح', 'Please enter a valid phone number'));
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError(t('الرجاء إدخال بريد إلكتروني صحيح', 'Please enter a valid email'));
      return;
    }

    setCreating(true);
    try {
      const res = await trpc.pricing.createGuestAccount({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
      });
      if (res.kind === 'existing_email') {
        setError(
          t(
            'لديك حساب بهذا البريد. سجّل الدخول للمتابعة',
            'You already have an account with this email. Please sign in to continue.',
          ),
        );
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: res.session.access_token,
        refresh_token: res.session.refresh_token,
      });
      if (setErr) {
        setError(setErr.message);
        return;
      }
      onAuthenticated();
    } catch (e: any) {
      setError(e?.message || t('فشل إنشاء الحساب', 'Could not create account'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      <div
        onClick={() => { if (!creating) onCancel(); }}
        className="absolute inset-0 bg-v2-ink/50 backdrop-blur-[2px] animate-in fade-in duration-200"
      />

      <div className="relative w-full max-w-[440px] rounded-v2-lg border border-v2-line bg-v2-surface shadow-lift">
        <div className="flex items-center justify-between border-b border-v2-line px-5 py-4">
          <h2 className="font-ar text-[17px] font-bold text-v2-ink">
            {title || t('بيانات الدفع', 'Your details')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={creating}
            aria-label={t('إغلاق', 'Close')}
            className="rounded-v2-sm p-1 text-v2-mute hover:bg-v2-canvas-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5 L15 15 M5 15 L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5">
          {subtitle && (
            <div className="mb-4 rounded-v2-md border border-v2-line bg-v2-canvas-2 px-3 py-2.5 font-ar text-[13px] text-v2-body">
              {subtitle}
            </div>
          )}
          <p className="mb-4 font-ar text-[13px] leading-relaxed text-v2-body">
            {t(
              'سننشئ لك حساباً تلقائياً ونرسل لك تفاصيل الدخول بعد إتمام الدفع',
              'We\'ll create your account automatically and email login details after payment.',
            )}
          </p>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block font-ar text-[12px] font-semibold text-v2-body">
                {t('الاسم الكامل', 'Full name')}
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                dir={isAr ? 'rtl' : 'ltr'}
                placeholder={t('عبدالعزيز السعيد', 'Abdulaziz Al-Saeed')}
                className="w-full rounded-v2-md border border-v2-line bg-v2-surface px-3 py-2.5 font-ar text-[14px] text-v2-ink placeholder-v2-mute focus:border-teal-500 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-ar text-[12px] font-semibold text-v2-body">
                {t('رقم الجوّال', 'Mobile number')}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                dir="ltr"
                placeholder="05XXXXXXXX"
                className="w-full rounded-v2-md border border-v2-line bg-v2-surface px-3 py-2.5 font-en text-[14px] text-v2-ink placeholder-v2-mute focus:border-teal-500 focus:outline-none tabular-nums"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-ar text-[12px] font-semibold text-v2-body">
                {t('البريد الإلكتروني', 'Email')}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                dir="ltr"
                placeholder="you@example.com"
                className="w-full rounded-v2-md border border-v2-line bg-v2-surface px-3 py-2.5 font-en text-[14px] text-v2-ink placeholder-v2-mute focus:border-teal-500 focus:outline-none"
              />
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-v2-md border border-red-200 bg-red-50 px-3 py-2 font-ar text-[12px] text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating}
              className="w-full rounded-v2-md bg-v2-ink px-4 py-3 font-ar text-[14px] font-semibold text-white cursor-pointer transition-opacity duration-200 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
            >
              {creating ? t('جارٍ التهيئة…', 'Setting up…') : t('متابعة إلى الدفع', 'Continue to payment')}
            </button>
            <Button variant="secondary" size="md" fullWidth onClick={onCancel} disabled={creating}>
              {t('إلغاء', 'Cancel')}
            </Button>
            <div className="text-center font-ar text-[12px] text-v2-dim">
              {t('لديك حساب بالفعل؟ ', 'Already have an account? ')}
              <button
                type="button"
                onClick={() => { onCancel(); navigate('/v2/login'); }}
                className="font-semibold text-teal-700 hover:underline"
              >
                {t('تسجيل الدخول', 'Sign in')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
