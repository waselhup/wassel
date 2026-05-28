import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import ErrorBanner from '@/components/v2/ErrorBanner';

/**
 * /v2/checkout/failed?id=<transactionId>
 *
 * Generic failure landing page after a Moyasar checkout drops back here.
 * Uses the Sprint 8 unified ErrorBanner so the user sees the same
 * "what happened / did I lose anything / what do I do" pattern that
 * the rest of the app uses.
 */
function CheckoutFailed() {
  const [, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
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
        <ErrorBanner
          messageKey="errors.payment.failed"
          category="payment"
          recovery="user_action_required"
          onRetry={() => navigate('/v2/pricing')}
        />

        {transactionId && (
          <div className="mt-3 text-center font-en text-[11px] text-v2-mute">
            {t('المرجع', 'Reference')}: {transactionId.slice(0, 8)}…
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <Button variant="secondary" size="md" fullWidth onClick={() => navigate('/v2/home')}>
            {t('العودة إلى الرئيسية', 'Back to home')}
          </Button>
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
