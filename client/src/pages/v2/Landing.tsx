import { useLocation } from 'wouter';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';

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

const SOCIAL_PROOF = ['ARAMCO', 'STC', 'SABIC', 'NEOM', 'KFUPM'];

const FOOTER_LINKS = [
  { label: 'من نحن',   href: '/v2' },
  { label: 'الشروط',  href: '/v2' },
  { label: 'الخصوصية', href: '/v2' },
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

function Landing() {
  const [, navigate] = useLocation();

  return (
    <Phone>
      <Topbar
        bg="canvas"
        leading={<BrandMark />}
        trailing={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/v2/login')}
          >
            دخول
          </Button>
        }
      />

      <div className="flex-1 px-[22px] pb-12">

        <section className="mb-9 mt-2">
          <Eyebrow className="mb-3 block !text-teal-700">AI · LINKEDIN GROWTH</Eyebrow>
          <h1 className="font-ar text-[36px] font-bold leading-[1.15] -tracking-[0.01em] text-v2-ink">
            بروفايل لينكد إن<br />
            يجلب الفرص<br />
            <span className="font-semibold text-teal-700">تلقائياً.</span>
          </h1>
          <p className="mt-3.5 font-ar text-[15px] leading-relaxed text-v2-body">
            تحليل ذكي ببروفايلك، توصيات قابلة للتطبيق، ومنشورات بصوتك أنت — مصمَّم للسوق السعودي والخليجي.
          </p>
        </section>

        <section className="mb-10">
          <div className="flex flex-col gap-2.5">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/v2/signup')}
            >
              ابدأ مجاناً
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => navigate('/v2/login')}
            >
              تسجيل الدخول
            </Button>
          </div>
          <p className="mt-2.5 text-center font-ar text-[13px] text-v2-dim">
            <NumDisplay>100</NumDisplay> توكن مجاني · بدون بطاقة ائتمان
          </p>
        </section>

        <section className="mb-10 border-y border-v2-line py-5">
          <Eyebrow className="mb-3.5 block text-center">موثوق به من</Eyebrow>
          <div className="grid grid-cols-5 items-center gap-2.5">
            {SOCIAL_PROOF.map((name) => (
              <div
                key={name}
                className="text-center font-en text-[11px] font-bold tracking-[0.08em] text-v2-mute"
              >
                {name}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <Eyebrow className="mb-3.5 block">المنتج</Eyebrow>
          <div className="flex flex-col">
            {FEATURES.map((f, i) => (
              <div
                key={f.num}
                className={`grid grid-cols-[40px_1fr] gap-3.5 border-b border-v2-line px-1 py-5 ${
                  i === 0 ? 'border-t' : ''
                }`}
              >
                <NumDisplay className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-teal-700">
                  {f.num}
                </NumDisplay>
                <div>
                  <div className="mb-1 font-ar text-[14px] font-semibold text-v2-ink">{f.title}</div>
                  <div className="font-ar text-[13px] leading-relaxed text-v2-body">{f.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <button
            type="button"
            onClick={() => navigate('/v2/pricing')}
            className="flex w-full items-center justify-between rounded-v2-md border border-v2-line bg-v2-surface px-4 py-4 text-start hover:bg-v2-canvas-2 transition-colors duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <div>
              <div className="font-ar text-[14px] font-semibold text-v2-ink">
                من <NumDisplay>99</NumDisplay> ر.س / شهر
              </div>
              <div className="mt-0.5 font-ar text-[12px] text-v2-dim">
                <NumDisplay>3</NumDisplay> باقات · ابدأ مجاناً
              </div>
            </div>
            <span className="font-ar text-[13px] font-semibold text-teal-700">
              الأسعار ←
            </span>
          </button>
        </section>

        <footer className="flex items-center justify-between border-t border-v2-line pt-5">
          <Eyebrow>© WASSEL · <NumDisplay>2025</NumDisplay></Eyebrow>
          <div className="flex gap-3.5 font-ar text-[11px] text-v2-dim">
            {FOOTER_LINKS.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => navigate(l.href)}
                className="hover:text-v2-body cursor-pointer transition-colors duration-200 ease-out"
              >
                {l.label}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </Phone>
  );
}

export default Landing;
