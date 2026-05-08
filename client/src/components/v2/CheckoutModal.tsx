import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';
import Button from './Button';
import NumDisplay from './NumDisplay';

interface Plan {
  id: string;
  name_ar: string; name_en: string;
  monthly_price_sar: string; annual_price_sar: string | null;
  monthly_tokens: number;
}

interface CheckoutModalProps {
  plan: Plan;
  billingCycle: 'monthly' | 'annual';
  onClose: () => void;
}

/**
 * Checkout modal: shows plan summary + total + billing cycle, then calls
 * pricing.subscribeToPlan to create a pending payment row, then redirects
 * to the Muyassar checkout URL when wired up. For now without Muyassar
 * keys, we show a status message after creating the pending row.
 */
function CheckoutModal({ plan, billingCycle, onClose }: CheckoutModalProps) {
  const { i18n } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const isAr = i18n.language === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const monthly = Number(plan.monthly_price_sar);
  const annual = Number(plan.annual_price_sar ?? 0);
  const total = billingCycle === 'annual' ? annual : monthly;
  const monthlyEquiv = billingCycle === 'annual' && annual > 0
    ? Math.round(annual / 12)
    : monthly;
  const savings = billingCycle === 'annual' && annual > 0 && annual < monthly * 12
    ? monthly * 12 - annual
    : 0;

  const planName = isAr ? plan.name_ar : plan.name_en;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await trpc.pricing.subscribeToPlan({
        planId: plan.id,
        billingCycle,
      });
      setPendingPaymentId(res.paymentId);
      // When Muyassar is wired, redirect:
      if (res.muyassarCheckoutUrl) {
        window.location.href = res.muyassarCheckoutUrl;
      }
    } catch (e: any) {
      setError(e?.message || t('فشلت العملية', 'Checkout failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      {/* Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-v2-ink/50 backdrop-blur-[2px] animate-in fade-in duration-200"
      />

      {/* Card */}
      <div className="relative w-full max-w-[440px] rounded-v2-lg border border-v2-line bg-v2-surface shadow-lift">
        <div className="flex items-center justify-between border-b border-v2-line px-5 py-4">
          <h2 className="font-ar text-[17px] font-bold text-v2-ink">
            {t('تأكيد الاشتراك', 'Confirm subscription')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('إغلاق', 'Close')}
            className="rounded-v2-sm p-1 text-v2-mute hover:bg-v2-canvas-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5 L15 15 M5 15 L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5">
          {pendingPaymentId ? (
            <div className="text-center py-6">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12 L10 17 L19 7" stroke="var(--teal-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-ar text-[16px] font-semibold text-v2-ink">
                {t('تم إنشاء طلب الدفع', 'Payment request created')}
              </h3>
              <p className="mt-2 font-ar text-[13px] text-v2-body">
                {t(
                  'سنوجّهك إلى بوّابة الدفع قريباً. حالياً، الدفع عبر Moyasar قيد التهيئة.',
                  'You will be redirected to the payment gateway. Moyasar checkout is being configured.'
                )}
              </p>
              <div className="mt-3 font-en text-[11px] text-v2-mute">
                Payment ID: {pendingPaymentId.slice(0, 8)}…
              </div>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={onClose}
                className="mt-5"
              >
                {t('إغلاق', 'Close')}
              </Button>
            </div>
          ) : (
            <>
              {/* Plan summary */}
              <div className="mb-5 rounded-v2-md border border-v2-line bg-v2-canvas-2 p-4">
                <div className="flex items-baseline justify-between">
                  <div className="font-ar text-[14px] font-semibold text-v2-ink">{planName}</div>
                  <div className="font-ar text-[11px] text-v2-dim">
                    {billingCycle === 'annual' ? t('فوترة سنوية', 'Annual billing') : t('فوترة شهرية', 'Monthly billing')}
                  </div>
                </div>
                <div className="mt-1 font-ar text-[12px] text-v2-body">
                  {t(`${plan.monthly_tokens} توكن/شهر`, `${plan.monthly_tokens} tokens / month`)}
                </div>
              </div>

              {/* Total */}
              <div className="space-y-2 border-b border-v2-line pb-4 mb-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-ar text-[13px] text-v2-body">
                    {billingCycle === 'annual' ? t('الإجمالي السنوي', 'Annual total') : t('الإجمالي الشهري', 'Monthly total')}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <NumDisplay className="font-ar text-[22px] font-bold text-v2-ink">
                      {total}
                    </NumDisplay>
                    <span className="font-ar text-[12px] text-v2-dim">{t('ر.س', 'SAR')}</span>
                  </div>
                </div>
                {billingCycle === 'annual' && (
                  <div className="flex items-baseline justify-between text-[12px] text-v2-dim">
                    <span className="font-ar">{t('ما يعادل', 'Equivalent to')}</span>
                    <NumDisplay className="font-ar tabular-nums">
                      {monthlyEquiv} {t('ر.س / شهر', 'SAR / mo')}
                    </NumDisplay>
                  </div>
                )}
                {savings > 0 && (
                  <div className="flex items-baseline justify-between text-[12px] text-teal-700">
                    <span className="font-ar">{t('وفّرت', 'You save')}</span>
                    <NumDisplay className="font-ar font-semibold tabular-nums">
                      {savings} {t('ر.س / سنة', 'SAR / yr')}
                    </NumDisplay>
                  </div>
                )}
              </div>

              {/* Payment placeholder */}
              <div className="mb-4 rounded-v2-md border border-amber-200 bg-amber-50 px-3 py-2.5 font-ar text-[12px] text-amber-800">
                {t(
                  'الدفع عبر Moyasar (مدى، فيزا، Apple Pay) قيد التهيئة. اضغط "تأكيد" لإنشاء طلب دفع.',
                  'Moyasar payments (Mada, Visa, Apple Pay) are being configured. Click Confirm to create a pending payment.'
                )}
              </div>

              {error && (
                <div className="mb-3 rounded-v2-md border border-red-200 bg-red-50 px-3 py-2 font-ar text-[12px] text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="w-full rounded-v2-md bg-v2-ink px-4 py-3 font-ar text-[14px] font-semibold text-white cursor-pointer transition-opacity duration-200 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                >
                  {submitting
                    ? t('جارٍ المعالجة…', 'Processing…')
                    : t('تأكيد الدفع', 'Confirm payment')}
                </button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={onClose}
                  disabled={submitting}
                >
                  {t('إلغاء', 'Cancel')}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CheckoutModal;
