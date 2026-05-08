import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc } from '@/lib/trpc';

interface SubscriptionRow {
  id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'annual';
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  amount_paid_sar: string;
  auto_renew: boolean;
  cancelled_at: string | null;
  plan?: {
    name_ar: string;
    name_en: string;
    monthly_tokens: number;
  };
}

interface TokenTx {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  metadata: any;
  created_at: string;
}

interface PaymentTx {
  id: string;
  amount_sar: string;
  currency: string;
  type: string;
  status: string;
  payment_method: string | null;
  metadata: any;
  created_at: string;
  completed_at: string | null;
}

function Billing() {
  const [, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [balance, setBalance] = useState<{ balance: number; totalPurchased: number; totalUsed: number } | null>(null);
  const [transactions, setTransactions] = useState<{ tokenTransactions: TokenTx[]; paymentTransactions: PaymentTx[] }>({
    tokenTransactions: [], paymentTransactions: [],
  });
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpQty, setTopUpQty] = useState(100);
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);
  const [topUpFeedback, setTopUpFeedback] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [sub, bal, hist] = await Promise.all([
        trpc.pricing.getCurrentSubscription(),
        trpc.pricing.getTokenBalance(),
        trpc.pricing.getTransactionHistory({ limit: 10 }),
      ]);
      setSubscription(sub as SubscriptionRow | null);
      setBalance(bal);
      setTransactions(hist);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelSubscription = async () => {
    if (!confirm(t('هل أنت متأكد من إلغاء التجديد التلقائي؟ ستظل قادراً على استخدام الاشتراك حتى نهاية الفترة الحالية.', 'Cancel auto-renewal? Your subscription stays active until the current period ends.'))) {
      return;
    }
    setCancelling(true);
    try {
      await trpc.pricing.cancelSubscription();
      await reload();
    } catch (e: any) {
      alert(e?.message || t('فشل الإلغاء', 'Cancellation failed'));
    } finally {
      setCancelling(false);
    }
  };

  const handleTopUp = async () => {
    if (topUpQty < 10 || topUpQty > 10000) {
      setTopUpFeedback(t('الكمية يجب أن تكون بين 10 و 10000', 'Quantity must be between 10 and 10000'));
      return;
    }
    setTopUpSubmitting(true);
    setTopUpFeedback(null);
    try {
      const res = await trpc.pricing.purchaseTokens({ quantity: topUpQty });
      if (res.muyassarCheckoutUrl) {
        window.location.href = res.muyassarCheckoutUrl;
        return;
      }
      setTopUpFeedback(t(
        `تم إنشاء طلب دفع بقيمة ${topUpQty} ر.س. الدفع قيد التهيئة.`,
        `Payment request created for ${topUpQty} SAR. Checkout is being configured.`
      ));
    } catch (e: any) {
      setTopUpFeedback(e?.message || t('فشلت العملية', 'Top-up failed'));
    } finally {
      setTopUpSubmitting(false);
    }
  };

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const balancePct = balance && subscription?.plan?.monthly_tokens
    ? Math.min(100, Math.round((balance.balance / subscription.plan.monthly_tokens) * 100))
    : null;

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/home')}
        title={t('الفوترة والاشتراك', 'Billing & Subscription')}
        bg="canvas"
        showPulse={false}
        showJobsIndicator={false}
      />

      <div className="flex-1 px-[22px] pb-12 pt-5 lg:mx-auto lg:max-w-[960px] lg:px-0 lg:pt-6 lg:pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-v2-md border border-red-200 bg-red-50 p-4 text-center font-ar text-red-700 text-[13px]">
            {error}
          </div>
        ) : (
          <>
            {/* Current Subscription Card */}
            <section className="mb-5 rounded-v2-lg border border-v2-line bg-v2-surface p-5 lg:p-7">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-ar font-bold text-v2-ink text-[16px] lg:text-[18px]">
                  {t('اشتراكك الحالي', 'Your subscription')}
                </h2>
                {subscription && (
                  <span className="rounded-v2-pill bg-teal-50 px-2 py-0.5 font-ar text-[11px] font-semibold text-teal-700">
                    {subscription.status === 'active' ? t('نشط', 'Active') : subscription.status}
                  </span>
                )}
              </div>

              {subscription ? (
                <>
                  <div className="font-ar text-[20px] font-bold text-v2-ink lg:text-[24px]">
                    {isAr ? subscription.plan?.name_ar : subscription.plan?.name_en}
                  </div>
                  <div className="mt-1 font-ar text-[13px] text-v2-dim">
                    {subscription.billing_cycle === 'annual'
                      ? t('فوترة سنوية', 'Annual billing')
                      : t('فوترة شهرية', 'Monthly billing')}
                    {' · '}
                    <NumDisplay className="tabular-nums">{subscription.amount_paid_sar}</NumDisplay>
                    {' '}{t('ر.س', 'SAR')}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-v2-line pt-3">
                    <div>
                      <div className="font-ar text-[11px] text-v2-mute">{t('بدأ في', 'Started')}</div>
                      <div className="font-ar text-[13px] text-v2-ink">{formatDate(subscription.current_period_start)}</div>
                    </div>
                    <div>
                      <div className="font-ar text-[11px] text-v2-mute">
                        {subscription.auto_renew ? t('يجدّد في', 'Renews on') : t('ينتهي في', 'Ends on')}
                      </div>
                      <div className="font-ar text-[13px] text-v2-ink">{formatDate(subscription.current_period_end)}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => navigate('/v2/pricing')}
                    >
                      {t('ترقية الاشتراك', 'Upgrade plan')}
                    </Button>
                    {subscription.auto_renew && !subscription.cancelled_at && (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                      >
                        {cancelling
                          ? t('جارٍ الإلغاء…', 'Cancelling…')
                          : t('إلغاء التجديد', 'Cancel auto-renew')}
                      </Button>
                    )}
                    {subscription.cancelled_at && (
                      <div className="rounded-v2-md border border-amber-200 bg-amber-50 px-3 py-2 font-ar text-[12px] text-amber-800">
                        {t('تم إلغاء التجديد التلقائي. الاشتراك يبقى نشطاً حتى نهاية الفترة.', 'Auto-renewal cancelled. Subscription stays active until period end.')}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-ar text-[14px] text-v2-body">
                    {t('لا يوجد اشتراك نشط حالياً.', 'No active subscription.')}
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate('/v2/pricing')}
                    className="mt-4"
                  >
                    {t('شاهد الباقات', 'View plans')}
                  </Button>
                </>
              )}
            </section>

            {/* Token Balance Widget */}
            <section className="mb-5 rounded-v2-lg border border-v2-line bg-v2-surface p-5 lg:p-7">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-ar font-bold text-v2-ink text-[16px] lg:text-[18px]">
                  {t('رصيد التوكن', 'Token balance')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowTopUp((v) => !v)}
                  className="font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  {showTopUp ? t('إخفاء', 'Hide') : t('شحن توكنات', 'Top up')}
                </button>
              </div>

              <div className="flex items-baseline gap-2">
                <NumDisplay className="font-ar text-[36px] font-bold text-v2-ink tabular-nums lg:text-[44px]">
                  {balance?.balance ?? 0}
                </NumDisplay>
                {subscription?.plan?.monthly_tokens && (
                  <span className="font-ar text-[13px] text-v2-dim">
                    {' / '}
                    <NumDisplay className="tabular-nums">{subscription.plan.monthly_tokens}</NumDisplay>
                    {' '}{t('شهرياً', 'monthly')}
                  </span>
                )}
              </div>

              {balancePct !== null && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-v2-canvas-2">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${balancePct}%` }}
                  />
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-v2-line pt-3 text-center">
                <div>
                  <div className="font-ar text-[11px] text-v2-mute">{t('شراء إجمالي', 'Total purchased')}</div>
                  <NumDisplay className="font-ar text-[15px] font-semibold text-v2-ink tabular-nums">
                    {balance?.totalPurchased ?? 0}
                  </NumDisplay>
                </div>
                <div>
                  <div className="font-ar text-[11px] text-v2-mute">{t('استُخدم', 'Used')}</div>
                  <NumDisplay className="font-ar text-[15px] font-semibold text-v2-ink tabular-nums">
                    {balance?.totalUsed ?? 0}
                  </NumDisplay>
                </div>
              </div>

              {showTopUp && (
                <div className="mt-4 rounded-v2-md border border-v2-line bg-v2-canvas-2 p-3">
                  <div className="font-ar text-[13px] font-semibold text-v2-ink mb-2">
                    {t('شحن توكنات (1 توكن = 1 ر.س)', 'Top up tokens (1 token = 1 SAR)')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {[100, 500, 1000].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setTopUpQty(q)}
                        className={`rounded-v2-pill px-3 py-1.5 font-ar text-[12px] font-semibold cursor-pointer ${
                          topUpQty === q
                            ? 'bg-v2-ink text-white'
                            : 'bg-v2-surface text-v2-body border border-v2-line hover:border-v2-ink/30'
                        }`}
                      >
                        <NumDisplay className="tabular-nums">{q}</NumDisplay>
                      </button>
                    ))}
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={topUpQty}
                      onChange={(e) => setTopUpQty(Number(e.target.value) || 0)}
                      className="w-24 rounded-v2-md border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[13px] text-v2-ink focus:border-teal-500 focus:outline-none tabular-nums"
                    />
                    <span className="font-ar text-[12px] text-v2-dim">
                      = <NumDisplay className="tabular-nums">{topUpQty}</NumDisplay> {t('ر.س', 'SAR')}
                    </span>
                  </div>
                  {topUpFeedback && (
                    <div className="mb-2 rounded-v2-md border border-teal-200 bg-teal-50 px-3 py-2 font-ar text-[12px] text-teal-800">
                      {topUpFeedback}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleTopUp}
                    disabled={topUpSubmitting}
                    className="w-full rounded-v2-md bg-v2-ink px-4 py-2.5 font-ar text-[13px] font-semibold text-white cursor-pointer transition-opacity duration-200 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                  >
                    {topUpSubmitting
                      ? t('جارٍ المعالجة…', 'Processing…')
                      : t('تأكيد الشحن', 'Confirm top-up')}
                  </button>
                </div>
              )}
            </section>

            {/* Transactions */}
            <section className="rounded-v2-lg border border-v2-line bg-v2-surface p-5 lg:p-7">
              <h2 className="font-ar font-bold text-v2-ink text-[16px] mb-3 lg:text-[18px]">
                {t('آخر المعاملات', 'Recent transactions')}
              </h2>

              {transactions.paymentTransactions.length === 0 && transactions.tokenTransactions.length === 0 ? (
                <div className="py-6 text-center font-ar text-[13px] text-v2-dim">
                  {t('لا توجد معاملات بعد.', 'No transactions yet.')}
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.paymentTransactions.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between border-b border-v2-line py-2 last:border-b-0">
                      <div>
                        <div className="font-ar text-[13px] font-semibold text-v2-ink">
                          {p.type === 'subscription' ? t('اشتراك', 'Subscription')
                            : p.type === 'token_topup' ? t('شحن توكنات', 'Token top-up')
                            : t('شراء منتج', 'Product purchase')}
                        </div>
                        <div className="font-ar text-[11px] text-v2-mute">{formatDate(p.created_at)}</div>
                      </div>
                      <div className="text-end">
                        <div className="flex items-baseline gap-1">
                          <NumDisplay className="font-ar text-[14px] font-semibold text-v2-ink tabular-nums">
                            {p.amount_sar}
                          </NumDisplay>
                          <span className="font-ar text-[11px] text-v2-dim">{t('ر.س', 'SAR')}</span>
                        </div>
                        <div className={`font-ar text-[10px] font-semibold ${
                          p.status === 'completed' ? 'text-teal-700'
                            : p.status === 'pending' ? 'text-amber-700'
                            : p.status === 'failed' ? 'text-red-700'
                            : 'text-v2-mute'
                        }`}>
                          {p.status === 'completed' ? t('مكتمل', 'Completed')
                            : p.status === 'pending' ? t('قيد الدفع', 'Pending')
                            : p.status === 'failed' ? t('فشل', 'Failed')
                            : p.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  {transactions.tokenTransactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between border-b border-v2-line py-2 last:border-b-0">
                      <div>
                        <div className="font-ar text-[13px] font-semibold text-v2-ink">
                          {tx.description || t('عملية توكن', 'Token operation')}
                        </div>
                        <div className="font-ar text-[11px] text-v2-mute">{formatDate(tx.created_at)}</div>
                      </div>
                      <div className={`font-ar text-[14px] font-bold tabular-nums ${
                        tx.amount > 0 ? 'text-teal-700' : 'text-v2-body'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}<NumDisplay>{tx.amount}</NumDisplay>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Phone>
  );
}

export default Billing;
