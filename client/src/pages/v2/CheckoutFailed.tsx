import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';

/**
 * /v2/checkout/failed?id=<transactionId>
 *
 * Generic failure landing page. The transactionId is shown for support but
 * isn't required — Moyasar may also redirect here directly without one.
 */
function CheckoutFailed() {
  const [, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const transactionId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('id')
      : null;

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/pricing')}
        title={t('فشل الدفع', 'Payment failed')}
        bg="canvas"
        showPulse={false}
        showJobsIndicator={false}
      />

      <div className="flex-1 px-[22px] pb-12 pt-6 lg:mx-auto lg:max-w-[640px]">
        <div className="rounded-v2-md border border-red-200 bg-red-50 p-6 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                d="M9 9 L19 19 M9 19 L19 9"
                stroke="#dc2626"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="font-ar text-[20px] font-bold text-v2-ink">
            {t('لم يكتمل الدفع', 'Your payment didn\'t go through')}
          </h1>
          <p className="mt-2 font-ar text-[13px] text-v2-body">
            {t(
              'لم يتم خصم أي مبلغ من بطاقتك. يمكنك المحاولة مجدداً، أو اختيار طريقة دفع مختلفة',
              'No charge was made to your card. You can try again or use a different payment method.'
            )}
          </p>

          {transactionId && (
            <div className="mt-4 font-en text-[10px] text-v2-mute">
              Reference: {transactionId.slice(0, 8)}…
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <Button variant="primary" size="md" fullWidth onClick={() => navigate('/v2/pricing')}>
              {t('المحاولة مرة أخرى', 'Try again')}
            </Button>
            <Button variant="secondary" size="md" fullWidth onClick={() => navigate('/v2/home')}>
              {t('العودة إلى الرئيسية', 'Back to home')}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center font-ar text-[12px] text-v2-mute">
          {t('بحاجة إلى مساعدة؟ ', 'Need help? ')}
          <a
            href="mailto:support@wasselhub.com"
            className="font-ar text-teal-700 underline-offset-2 hover:underline"
          >
            support@wasselhub.com
          </a>
        </p>
      </div>
    </Phone>
  );
}

export default CheckoutFailed;
