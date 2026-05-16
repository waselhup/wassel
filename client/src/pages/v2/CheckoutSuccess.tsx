import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc } from '@/lib/trpc';

type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | string;

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * /v2/checkout/success?id=<transactionId>
 *
 * Moyasar redirects the customer here after the hosted form. We don't trust
 * the URL at face value — the row only flips to 'completed' when the webhook
 * confirms it. So we poll pricing.getPaymentStatus every 2s up to 30s.
 *
 * - status=completed → success view + CTA to dashboard
 * - status=failed/cancelled → redirect to /v2/checkout/failed
 * - 30s timeout → 'still verifying' view (the webhook may still arrive — the
 *   user can refresh from /v2/billing and see it land)
 */
function CheckoutSuccess() {
  const [, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const transactionId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('id')
      : null;

  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [type, setType] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [tokensGranted, setTokensGranted] = useState<number>(0);
  const [planNameAr, setPlanNameAr] = useState<string | null>(null);
  const [planNameEn, setPlanNameEn] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!transactionId) {
      setError(t('معرّف الدفع مفقود', 'Missing payment ID'));
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const row = await trpc.pricing.getPaymentStatus({ transactionId });
        if (cancelled) return;
        setStatus(row.status as PaymentStatus);
        setType(row.type);
        setAmount(typeof row.amount_sar === 'number' ? row.amount_sar : Number(row.amount_sar));
        const meta = row.metadata || {};
        setTokensGranted(Number(meta.tokens_granted ?? 0));
        setPlanNameAr(meta.plan_name_ar ?? null);
        setPlanNameEn(meta.plan_name_en ?? null);

        if (row.status === 'completed') {
          // Final state — stop polling.
          return;
        }
        if (row.status === 'failed' || row.status === 'cancelled') {
          navigate(`/v2/checkout/failed?id=${encodeURIComponent(transactionId)}`, {
            replace: true,
          });
          return;
        }
        // Still pending — schedule next poll if we haven't hit the budget.
        if (Date.now() - startedAt.current < POLL_TIMEOUT_MS) {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setTimedOut(true);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || t('فشل التحقق من حالة الدفع', 'Could not verify payment'));
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [transactionId, navigate, t]);

  const completed = status === 'completed';
  const stillPolling = !completed && !timedOut && !error;

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/home')}
        title={t('حالة الدفع', 'Payment status')}
        bg="canvas"
        showPulse={false}
        showJobsIndicator={false}
      />

      <div className="flex-1 px-[22px] pb-12 pt-6 lg:mx-auto lg:max-w-[640px]">
        {/* PENDING STATE */}
        {stillPolling && (
          <div className="rounded-v2-md border border-v2-line bg-v2-surface p-6 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
            <h1 className="font-ar text-[18px] font-bold text-v2-ink">
              {t('جارٍ تأكيد الدفع…', 'Confirming your payment…')}
            </h1>
            <p className="mt-2 font-ar text-[13px] text-v2-body">
              {t(
                'لا تغلق هذه الصفحة. سنخبرك بمجرد وصول التأكيد من بوّابة الدفع',
                'Please don\'t close this page. We\'ll confirm as soon as the gateway responds.'
              )}
            </p>
          </div>
        )}

        {/* COMPLETED STATE */}
        {completed && (
          <div className="rounded-v2-md border border-teal-200 bg-teal-50 p-6 text-center">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path
                  d="M6 14 L12 20 L22 8"
                  stroke="var(--teal-700)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="font-ar text-[20px] font-bold text-v2-ink">
              {t('تم الدفع بنجاح', 'Payment successful')}
            </h1>
            <p className="mt-2 font-ar text-[13px] text-v2-body">
              {type === 'subscription' && (planNameAr || planNameEn)
                ? t(
                    `تم تفعيل اشتراك ${planNameAr || planNameEn}`,
                    `Your ${planNameEn || planNameAr} subscription is now active.`
                  )
                : type === 'token_topup'
                  ? t('تمت إضافة التوكن إلى رصيدك', 'Tokens have been added to your balance.')
                  : t('تم تفعيل المنتج', 'Your purchase has been activated.')}
            </p>

            <div className="mt-5 flex items-center justify-around border-y border-teal-200 py-4 text-center">
              <div>
                <div className="font-ar text-[11px] text-v2-dim">{t('المبلغ', 'Amount')}</div>
                <NumDisplay className="font-ar text-[18px] font-bold text-v2-ink">
                  {amount}
                </NumDisplay>
                <div className="font-ar text-[11px] text-v2-dim">{t('ر.س', 'SAR')}</div>
              </div>
              {tokensGranted > 0 && (
                <div>
                  <div className="font-ar text-[11px] text-v2-dim">{t('التوكن المضافة', 'Tokens added')}</div>
                  <NumDisplay className="font-ar text-[18px] font-bold text-v2-ink">
                    {tokensGranted}
                  </NumDisplay>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" size="md" fullWidth onClick={() => navigate('/v2/home')}>
                {t('الانتقال إلى لوحة التحكم', 'Go to dashboard')}
              </Button>
              <Button variant="secondary" size="md" fullWidth onClick={() => navigate('/v2/billing')}>
                {t('عرض الفاتورة', 'View billing')}
              </Button>
            </div>
          </div>
        )}

        {/* TIMEOUT STATE */}
        {timedOut && !completed && (
          <div className="rounded-v2-md border border-amber-200 bg-amber-50 p-6 text-center">
            <h1 className="font-ar text-[18px] font-bold text-v2-ink">
              {t('نتحقق من حالة الدفع', 'We\'re still verifying')}
            </h1>
            <p className="mt-2 font-ar text-[13px] text-v2-body">
              {t(
                'تأخّر تأكيد بوّابة الدفع قليلاً. سنرسل لك إيميلاً فور اكتمال التحقق، ويمكنك متابعة الحالة من صفحة الفواتير',
                'The gateway is taking longer than usual. We\'ll email you as soon as it confirms, and you can also check the billing page.'
              )}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" size="md" fullWidth onClick={() => navigate('/v2/billing')}>
                {t('فتح صفحة الفواتير', 'Open billing')}
              </Button>
              <Button variant="secondary" size="md" fullWidth onClick={() => navigate('/v2/home')}>
                {t('العودة إلى الرئيسية', 'Back to home')}
              </Button>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="rounded-v2-md border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="font-ar text-[18px] font-bold text-v2-ink">
              {t('تعذّر التحقق من الدفع', 'Could not verify payment')}
            </h1>
            <p className="mt-2 font-ar text-[13px] text-red-700">{error}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" size="md" fullWidth onClick={() => navigate('/v2/billing')}>
                {t('فتح صفحة الفواتير', 'Open billing')}
              </Button>
              <Button variant="secondary" size="md" fullWidth onClick={() => navigate('/v2/pricing')}>
                {t('العودة إلى الأسعار', 'Back to pricing')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Phone>
  );
}

export default CheckoutSuccess;
