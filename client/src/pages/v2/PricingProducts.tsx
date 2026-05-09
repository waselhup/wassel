import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  name_ar: string; name_en: string;
  description_ar: string | null; description_en: string | null;
  price_sar: string;
  category: string;
  token_cost: number;
  is_bundle: boolean;
  bundle_items: any | null;
}

const PRODUCT_ICON: Record<string, string> = {
  radar: '📡',
  cv_builder: '📄',
  cover_letter: '✉️',
  linkedin_post: '💬',
  bundle_cv_cover: '📦',
};

function PricingProducts() {
  const [, navigate] = useLocation();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; message: string; tone: 'success' | 'error' } | null>(null);

  const isAr = i18n.language === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      trpc.pricing.getProducts(),
      user ? trpc.pricing.getTokenBalance().catch(() => null) : Promise.resolve(null),
    ])
      .then(([prods, bal]) => {
        if (cancelled) return;
        setProducts(prods as Product[]);
        if (bal) setTokenBalance(bal.balance);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Failed to load products');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const handleBuyWithSAR = async (product: Product) => {
    if (!user) {
      navigate('/v2/signup');
      return;
    }
    setPurchasing(product.id);
    setFeedback(null);
    try {
      const res = await trpc.pricing.purchaseProduct({ productId: product.id });
      if (res.muyassarCheckoutUrl) {
        window.location.href = res.muyassarCheckoutUrl;
        return;
      }
      setFeedback({
        id: product.id,
        message: t(
          'تم إنشاء طلب الدفع. الدفع قيد التهيئة.',
          'Payment request created. Checkout is being configured.'
        ),
        tone: 'success',
      });
    } catch (e: any) {
      setFeedback({
        id: product.id,
        message: e?.message || t('فشلت العملية', 'Purchase failed'),
        tone: 'error',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handleUseTokens = (product: Product) => {
    if (!user) {
      navigate('/v2/signup');
      return;
    }
    // Route to the appropriate feature page where the user spends tokens.
    const route =
      product.id === 'radar' ? '/v2/analyze'
        : product.id === 'cv_builder' ? '/v2/cvs'
        : product.id === 'cover_letter' ? '/v2/cvs'
        : product.id === 'linkedin_post' ? '/v2/posts'
        : product.id === 'bundle_cv_cover' ? '/v2/cvs'
        : '/v2/home';
    navigate(route);
  };

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/pricing')}
        title={t('شراء فردي', 'Single purchase')}
        bg="canvas"
        showPulse={false}
        showJobsIndicator={false}
      />

      <div className="flex-1 px-[22px] pb-12 pt-5 lg:mx-auto lg:max-w-[1100px] lg:px-0 lg:pt-0 lg:pb-0">
        <section className="mb-6 lg:mb-0 lg:py-16 lg:text-center">
          <Eyebrow className="mb-2 block !text-teal-700 lg:mb-3">PRODUCTS</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[42px]">
            {t('اشترِ فردياً، أو استخدم رصيد التوكن', 'Buy single, or use your token balance')}
          </h1>
          <p className="mt-2 font-ar leading-relaxed text-v2-body text-[14px] lg:mx-auto lg:mt-3 lg:max-w-[560px] lg:text-[16px]">
            {t(
              'كل منتج يأتي بسعر واضح بالريال السعودي، أو يمكنك استخدام رصيد التوكن لديك.',
              'Each product has a clear SAR price, or you can spend your existing token balance.'
            )}
          </p>
          {tokenBalance !== null && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-v2-pill border border-v2-line bg-v2-surface px-3 py-1.5 lg:mt-4">
              <span className="font-ar text-[12px] text-v2-dim">{t('رصيدك', 'Your balance')}</span>
              <NumDisplay className="font-ar text-[13px] font-semibold text-v2-ink tabular-nums">
                {tokenBalance}
              </NumDisplay>
              <span className="font-ar text-[12px] text-v2-body">{t('توكن', 'tokens')}</span>
            </div>
          )}
        </section>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-v2-md border border-red-200 bg-red-50 p-4 text-center font-ar text-red-700 text-[13px]">
            {t('تعذّر تحميل المنتجات. حاول مرة أخرى.', 'Could not load products. Please retry.')}
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {products.map((product) => {
              const name = isAr ? product.name_ar : product.name_en;
              const description = isAr ? product.description_ar : product.description_en;
              const price = Number(product.price_sar);
              const tokens = product.token_cost;
              const canUseTokens = tokenBalance !== null && tokenBalance >= tokens;
              const fb = feedback?.id === product.id ? feedback : null;
              const icon = PRODUCT_ICON[product.id] || '✨';
              const isBundle = product.is_bundle || product.id.startsWith('bundle_');

              return (
                <div
                  key={product.id}
                  className={`relative flex flex-col rounded-v2-md border bg-v2-surface p-5 lg:rounded-v2-lg lg:p-6 ${
                    isBundle ? 'border-teal-300 bg-teal-50/30' : 'border-v2-line'
                  }`}
                >
                  {isBundle && (
                    <span
                      className="absolute -top-2.5 end-4 rounded-v2-pill bg-teal-500 px-2.5 py-1 font-ar text-[10px] font-bold tracking-[0.04em]"
                      style={{ color: '#0a3530' }}
                    >
                      {t('وفّر 19 توكن', 'Save 19 tokens')}
                    </span>
                  )}

                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-[28px] leading-none lg:text-[32px]">{icon}</span>
                    <div className="flex-1">
                      <div className="font-ar text-[16px] font-bold text-v2-ink lg:text-[18px]">{name}</div>
                      {description && (
                        <p className="mt-1 font-ar text-[12px] text-v2-dim leading-relaxed lg:text-[13px]">
                          {description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-v2-line pt-3 mt-1">
                    <div>
                      <div className="font-ar text-[11px] text-v2-mute">{t('السعر', 'Price')}</div>
                      <div className="flex items-baseline gap-1">
                        <NumDisplay className="font-ar text-[20px] font-bold text-v2-ink tabular-nums">
                          {price}
                        </NumDisplay>
                        <span className="font-ar text-[11px] text-v2-dim">{t('ر.س', 'SAR')}</span>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-ar text-[11px] text-v2-mute">{t('أو', 'or')}</div>
                      <div className="flex items-baseline justify-end gap-1">
                        <NumDisplay className="font-ar text-[16px] font-semibold text-teal-700 tabular-nums">
                          {tokens}
                        </NumDisplay>
                        <span className="font-ar text-[11px] text-v2-dim">{t('توكن', 'tokens')}</span>
                      </div>
                    </div>
                  </div>

                  {fb && (
                    <div className={`mt-3 rounded-v2-md px-3 py-2 font-ar text-[12px] ${
                      fb.tone === 'success'
                        ? 'border border-teal-200 bg-teal-50 text-teal-800'
                        : 'border border-red-200 bg-red-50 text-red-700'
                    }`}>
                      {fb.message}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handleBuyWithSAR(product)}
                      disabled={purchasing === product.id}
                      className="w-full rounded-v2-md bg-v2-ink px-4 py-2.5 font-ar text-[13px] font-semibold text-white cursor-pointer transition-opacity duration-200 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                    >
                      {purchasing === product.id
                        ? t('جارٍ المعالجة…', 'Processing…')
                        : t('اشترِ الآن', 'Buy now')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUseTokens(product)}
                      disabled={!canUseTokens}
                      className={`w-full rounded-v2-md border px-4 py-2.5 font-ar text-[13px] font-semibold cursor-pointer transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                        canUseTokens
                          ? 'border-teal-500 text-teal-700 hover:bg-teal-50'
                          : 'border-v2-line text-v2-mute cursor-not-allowed bg-v2-canvas-2'
                      }`}
                    >
                      {canUseTokens
                        ? t('استخدم التوكن', 'Use tokens')
                        : tokenBalance === null
                          ? t('سجّل الدخول لاستخدام التوكن', 'Sign in to use tokens')
                          : t(`رصيد غير كافٍ (${tokens} توكن مطلوبة)`, `Insufficient (${tokens} tokens needed)`)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <section className="mt-8 rounded-v2-md border border-v2-line bg-v2-canvas-2 p-5 text-center lg:mt-16 lg:p-8">
          <h2 className="font-ar font-semibold text-v2-ink text-[16px] lg:text-[20px]">
            {t('تستخدم باستمرار؟ اشترك ووفّر.', 'Use often? Subscribe and save.')}
          </h2>
          <p className="mt-1.5 font-ar text-[13px] text-v2-body lg:text-[14px]">
            {t(
              'الباقات الشهرية أرخص من الشراء الفردي بنسبة 40% فأكثر.',
              'Monthly plans are 40%+ cheaper than buying individually.'
            )}
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/v2/pricing')}
            className="mt-3"
          >
            {t('شاهد الباقات', 'View plans')}
          </Button>
        </section>
      </div>
    </Phone>
  );
}

export default PricingProducts;
