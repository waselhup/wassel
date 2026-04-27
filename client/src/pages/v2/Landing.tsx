import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import SpinningLogo from '@/components/v2/SpinningLogo';
import PublicFooter from '@/components/v2/PublicFooter';

interface Feature {
  num: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  { num: '01', title: 'الرادار',     description: 'تحليل ذكي لبروفايلك مع 3 توصيات بأعلى أثر، مرتّبة بحسب التأثير على دور هدف.' },
  { num: '02', title: 'الاستوديو',   description: 'صياغة منشورات احترافية بصوتك ولهجتك، بنبرات مختلفة وقوالب جاهزة.' },
  { num: '03', title: 'سيرة ذكية',   description: 'CV مخصّص يستخرج تلقائياً من بروفايلك ومُعدَّل لكل وظيفة.' },
];

const BrandMark = () => (
  <span className="flex items-center gap-2 px-2 py-1">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="9"   stroke="var(--teal-700)" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="5"   stroke="var(--teal-700)" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
    </svg>
    <span className="font-ar text-[16px] font-bold text-v2-ink">وصّل</span>
  </span>
);

/** Decorative concentric-rings illustration used in the desktop hero,
 * with the V2 SpinningLogo centered on top of it for added motion. */
function HeroVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-square w-full max-w-[480px]"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-50 to-v2-canvas-2" />
      <svg viewBox="0 0 400 400" className="relative h-full w-full">
        <g fill="none" stroke="var(--teal-700)" strokeOpacity="0.18">
          <circle cx="200" cy="200" r="180" strokeWidth="1" />
          <circle cx="200" cy="200" r="140" strokeWidth="1" />
          <circle cx="200" cy="200" r="100" strokeWidth="1" />
          <circle cx="200" cy="200" r="60"  strokeWidth="1" />
        </g>
        <g fill="var(--teal-500)">
          <circle cx="320" cy="160" r="4" opacity="0.85" />
          <circle cx="80"  cy="240" r="3" opacity="0.7" />
          <circle cx="260" cy="320" r="3.5" opacity="0.75" />
          <circle cx="120" cy="100" r="3" opacity="0.6" />
        </g>
        <g stroke="var(--teal-500)" strokeWidth="1" strokeOpacity="0.4">
          <line x1="200" y1="200" x2="320" y2="160" />
          <line x1="200" y1="200" x2="80"  y2="240" />
          <line x1="200" y1="200" x2="260" y2="320" />
          <line x1="200" y1="200" x2="120" y2="100" />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <SpinningLogo size="xl" speed="slow" />
      </div>
    </div>
  );
}

function Landing() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <Phone>
      <Topbar
        bg="canvas"
        leading={<BrandMark />}
        showPulse={false}
        showJobsIndicator={false}
        trailing={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/v2/login')}
          >
            {t('v2.landing.signIn', 'دخول')}
          </Button>
        }
      />

      <div className="flex-1 px-[22px] pb-12 lg:px-0 lg:pb-0">

        {/* HERO */}
        <section className="mb-9 mt-2 lg:mb-0 lg:mt-0 lg:py-24">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="lg:order-1">
              <Eyebrow className="mb-3 block !text-teal-700">AI · LINKEDIN GROWTH</Eyebrow>
              <h1 className="font-ar font-bold leading-[1.15] -tracking-[0.01em] text-v2-ink text-[36px] lg:text-[56px]">
                بروفايل لينكد إن<br />
                يجلب الفرص<br />
                <span className="font-semibold text-teal-700">تلقائياً.</span>
              </h1>
              <p className="mt-3.5 font-ar leading-relaxed text-v2-body text-[15px] lg:mt-5 lg:max-w-[520px] lg:text-[17px]">
                تحليل ذكي ببروفايلك، توصيات قابلة للتطبيق، ومنشورات بصوتك أنت — مصمَّم للسوق السعودي والخليجي.
              </p>

              {/* CTAs — stacked on mobile, side-by-side on desktop */}
              <div className="mt-6 flex flex-col gap-2.5 lg:mt-8 lg:flex-row lg:gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => navigate('/v2/signup')}
                  className="lg:w-auto lg:px-7"
                >
                  {t('v2.landing.startFree', 'ابدأ مجاناً')}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => navigate('/v2/login')}
                  className="lg:w-auto lg:px-7"
                >
                  {t('v2.landing.login', 'تسجيل الدخول')}
                </Button>
              </div>
              <p className="mt-2.5 text-center font-ar text-[13px] text-v2-dim lg:text-start">
                <NumDisplay>100</NumDisplay> توكن مجاني · بدون بطاقة ائتمان
              </p>
            </div>

            <div className="hidden lg:order-2 lg:block">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* FEATURES — stacked rows on mobile, 3-card grid on desktop */}
        <section className="mb-10 lg:mb-0 lg:py-24">
          <Eyebrow className="mb-3.5 block lg:mb-3 lg:text-center">المنتج</Eyebrow>
          <h2 className="hidden font-ar font-bold text-v2-ink lg:mx-auto lg:mb-12 lg:block lg:max-w-[640px] lg:text-center lg:text-[36px] lg:leading-tight">
            ثلاث أدوات مترابطة، نتيجة واحدة.
          </h2>

          <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.num}
                className={`grid grid-cols-[40px_1fr] gap-3.5 border-b border-v2-line px-1 py-5
                  ${i === 0 ? 'border-t' : ''}
                  lg:flex lg:flex-col lg:gap-4 lg:rounded-v2-lg lg:border lg:border-v2-line lg:bg-v2-surface lg:px-6 lg:py-7
                  lg:[grid-template-columns:none]`}
              >
                <NumDisplay className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-teal-700 lg:text-[12px]">
                  {f.num}
                </NumDisplay>
                <div>
                  <div className="mb-1 font-ar text-[14px] font-semibold text-v2-ink lg:mb-2 lg:text-[18px]">
                    {f.title}
                  </div>
                  <div className="font-ar leading-relaxed text-v2-body text-[13px] lg:text-[14px]">
                    {f.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING TEASER */}
        <section className="mb-10 lg:mb-0 lg:py-24">
          <button
            type="button"
            onClick={() => navigate('/v2/pricing')}
            className="flex w-full items-center justify-between rounded-v2-md border border-v2-line bg-v2-surface px-4 py-4 text-start hover:bg-v2-canvas-2 transition-colors duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30
              lg:mx-auto lg:max-w-[720px] lg:rounded-v2-xl lg:px-10 lg:py-10 lg:shadow-card"
          >
            <div>
              <Eyebrow className="mb-1 block !text-teal-700 lg:mb-2">PRICING</Eyebrow>
              <div className="font-ar text-[14px] font-semibold text-v2-ink lg:text-[24px]">
                من <NumDisplay>99</NumDisplay> ر.س / شهر
              </div>
              <div className="mt-0.5 font-ar text-[12px] text-v2-dim lg:mt-2 lg:text-[14px]">
                <NumDisplay>3</NumDisplay> باقات · ابدأ مجاناً
              </div>
            </div>
            <span className="font-ar text-[13px] font-semibold text-teal-700 lg:text-[15px]">
              الأسعار ←
            </span>
          </button>
        </section>

        <PublicFooter />
      </div>
    </Phone>
  );
}

export default Landing;
