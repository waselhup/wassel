import type { ReactElement } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import Button from '@/components/v2/Button';
import Skeleton, { useInitialLoading } from '@/components/v2/Skeleton';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  cost: number;
  href: string;
  icon: ReactElement;
}

interface RecentItem {
  id: string;
  kind: string;
  title: string;
  meta: string;
}

const RadarIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="10" cy="10" r="1.4" fill="currentColor" />
  </svg>
);
const PostIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 4 H14 M3 8 H17 M3 12 H14 M3 16 H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const CvIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="4" y="2" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 7 H13 M7 10 H13 M7 13 H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const ChevronStart = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="rtl:rotate-180">
    <path d="M4 3 L8 6 L4 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Home() {
  const [, navigate] = useLocation();
  // i18n prep — namespace v2.home.*. Translations TBD; AR inline.
  // TODO(i18n): wrap mock data labels (NBA/recent kinds) once they come from API.
  const { t } = useTranslation();
  const loading = useInitialLoading(800);

  const balance = 240;
  const total = 300;
  const used = total - balance;
  const usedPct = Math.round((used / total) * 100);

  const actions: QuickAction[] = [
    { id: 'analyze', title: 'تحليل البروفايل', description: 'رادار شامل مقابل دور هدف', cost: 25, href: '/v2/analyze', icon: RadarIcon },
    { id: 'post',    title: 'صياغة منشور',     description: 'AI · بصوتك أنت',           cost: 20, href: '/v2/home', icon: PostIcon },
    { id: 'cv',      title: 'منشئ السيرة',      description: 'CV احترافي مخصّص',         cost: 40, href: '/v2/home', icon: CvIcon  },
  ];

  const recent: RecentItem[] = [
    { id: 'r1', kind: 'RADAR', title: 'تحليل البروفايل · 88/100', meta: 'أمس · 14:32' },
    { id: 'r2', kind: 'POST',  title: 'منشور · القيادة في الفرق', meta: 'قبل 3 أيام' },
    { id: 'r3', kind: 'EDIT',  title: 'تحسين العنوان المهني',    meta: 'قبل أسبوع' },
  ];

  return (
    <Phone>
      <Topbar
        sticky={false}
        bg="canvas"
        leading={
          <span className="flex items-center gap-1.5 px-2 py-1">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="9"   stroke="var(--teal-700)" strokeWidth="1.4" />
              <circle cx="11" cy="11" r="5"   stroke="var(--teal-700)" strokeWidth="1.4" />
              <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
            </svg>
            <span className="font-ar text-[15px] font-bold text-v2-ink">وصّل</span>
          </span>
        }
        trailing={
          // The JobsIndicator (auto-injected by Topbar when showJobsIndicator=true,
          // which is the default) replaces the previous standalone bell — no need
          // to render our own here.
          <button
            type="button"
            aria-label="بحث"
            className="relative flex h-9 w-9 items-center justify-center rounded-v2-pill text-v2-ink hover:bg-v2-canvas-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M12 12 L15 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 px-[22px] pb-[110px]">

        <div className="mt-5 mb-6">
          <Eyebrow className="mb-1.5 block">
            <NumDisplay>14:32</NumDisplay> · الأربعاء
          </Eyebrow>
          <h1 className="font-ar text-[28px] font-bold leading-tight text-v2-ink">
            {t('v2.home.greeting', 'مساء الخير، محمد.')}
          </h1>
        </div>

        {loading ? (
          <Card padding="lg" radius="lg" elevated className="mb-6">
            <Skeleton variant="text" width={100} className="mb-3" />
            <Skeleton variant="text" lines={2} />
          </Card>
        ) : (
        <Card padding="lg" radius="lg" elevated className="mb-6">
          <div className="flex items-start justify-between mb-1">
            <Eyebrow>TOKEN BALANCE</Eyebrow>
            <button
              type="button"
              onClick={() => navigate('/v2/home')}
              className="font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
            >
              شحن +
            </button>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <NumDisplay className="text-[36px] font-bold text-v2-ink leading-none">
              {balance}
            </NumDisplay>
            <span className="font-ar text-[13px] text-v2-dim">توكن</span>
            <span className="ms-auto font-ar text-[12px] text-v2-dim">
              من <NumDisplay>{total}</NumDisplay>
            </span>
          </div>
          <div className="mt-3 h-[3px] w-full rounded-full bg-v2-line">
            <div
              className="h-full rounded-full bg-teal-500"
              style={{ width: `${100 - usedPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Eyebrow>USED · <NumDisplay>{used}</NumDisplay></Eyebrow>
            <Eyebrow>RENEWS · <NumDisplay>JAN 1</NumDisplay></Eyebrow>
          </div>
        </Card>
        )}

        <div className="mb-6">
          <h2 className="mb-3 font-ar text-[17px] font-semibold text-v2-ink">إجراءات سريعة</h2>
          <div className="flex flex-col">
            {actions.map((action, i) => (
              <button
                key={action.id}
                type="button"
                onClick={() => navigate(action.href)}
                className={`grid grid-cols-[36px_1fr_auto_12px] items-center gap-3 px-1 py-4 text-start cursor-pointer
                  border-b border-v2-line ${i === 0 ? 'border-t' : ''}
                  hover:bg-v2-canvas-2 transition-colors duration-200 ease-out`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-v2-md bg-v2-canvas-2 text-v2-ink">
                  {action.icon}
                </span>
                <span className="font-ar">
                  <span className="block text-[14px] font-semibold text-v2-ink">{action.title}</span>
                  <span className="block text-[12px] text-v2-dim">{action.description}</span>
                </span>
                <NumDisplay className="text-[12px] text-v2-body">
                  {action.cost} توكن
                </NumDisplay>
                <span className="text-v2-mute">{ChevronStart}</span>
              </button>
            ))}
          </div>
        </div>

        <Card padding="md" radius="lg" className="mb-6 bg-teal-50 border-teal-100">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1 L8.5 5 L13 5.5 L9.5 8.5 L10.5 13 L7 10.5 L3.5 13 L4.5 8.5 L1 5.5 L5.5 5 Z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="flex-1">
              <Eyebrow className="text-teal-700">TIP · TODAY</Eyebrow>
              <p className="mt-1 font-ar text-[14px] leading-relaxed text-v2-ink-2">
                المنشورات يومَي الثلاثاء والأربعاء صباحاً تحقق ظهوراً أعلى بـ <span className="font-semibold text-teal-700">3x</span> في السوق السعودي.
              </p>
            </div>
          </div>
        </Card>

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-ar text-[17px] font-semibold text-v2-ink">آخر النشاط</h2>
            <button
              type="button"
              onClick={() => navigate('/v2/home')}
              className="font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
            >
              السجل ←
            </button>
          </div>
          <div className="flex flex-col">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-[60px_1fr_12px] items-center gap-3 px-1 py-3.5 border-b border-v2-line ${i === 0 ? 'border-t' : ''}`}
                  >
                    <Skeleton variant="text" width={50} />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="text" width="50%" />
                    </div>
                    <Skeleton variant="text" width={12} />
                  </div>
                ))
              : recent.map((item, i) => (
              <div
                key={item.id}
                className={`grid grid-cols-[60px_1fr_12px] items-center gap-3 px-1 py-3.5
                  border-b border-v2-line ${i === 0 ? 'border-t' : ''}`}
              >
                <Eyebrow>{item.kind}</Eyebrow>
                <div className="font-ar">
                  <span className="block text-[14px] font-medium text-v2-ink">{item.title}</span>
                  <span className="block text-[12px] text-v2-dim">{item.meta}</span>
                </div>
                <span className="text-v2-mute">{ChevronStart}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 mb-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/v2/analyze')}
          >
            {t('v2.home.startAnalysis', 'ابدأ تحليلاً جديداً')}
          </Button>
        </div>
      </div>

      <BottomNav
        active="home"
        items={[
          { id: 'home',    label: 'الرئيسية', icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: 'الرادار',  icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'tools',   label: 'الأدوات',  icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'profile', label: 'حسابي',    icon: <span /> , onSelect: () => navigate('/v2/home') },
        ]}
        fabIcon="plus"
        onFabClick={() => navigate('/v2/analyze')}
      />
    </Phone>
  );
}

export default Home;
