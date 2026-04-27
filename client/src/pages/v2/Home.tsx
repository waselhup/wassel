import { useEffect, useState, type ReactElement } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useRecentActivity, relativeLabel, type ActivityKind } from '@/lib/v2/useRecentActivity';

const PLAN_QUOTAS: Record<string, number> = {
  free: 100,
  starter: 500,
  pro: 2000,
  elite: 10000,
};

function firstNameOf(profile: { full_name: string | null } | null, user: { email?: string | null } | null): string {
  const full = profile?.full_name?.trim();
  if (full) return full.split(/\s+/)[0]!;
  const email = user?.email ?? '';
  const local = email.split('@')[0];
  return local || 'صديقي';
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'مساء الخير';
  if (h < 12) return 'صباح الخير';
  if (h < 18) return 'مرحباً';
  return 'مساء الخير';
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  cost: number;
  href: string;
  icon: ReactElement;
}

const KIND_EYEBROW: Record<ActivityKind, string> = {
  analysis: 'RADAR',
  cv: 'CV',
  campaign: 'CAMPAIGN',
  post: 'POST',
  billing: 'BILL',
};

function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const WEEKDAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

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
  const { t } = useTranslation();
  const initialLoading = useInitialLoading(800);
  const { user, profile, loading: authLoading } = useAuth();

  // Wait for auth + skeleton timer so the page doesn't flash hardcoded content.
  const loading = initialLoading || authLoading;

  const now = useNow();
  const { entries: activityEntries, loading: activityLoading } = useRecentActivity();
  const recentActivity = activityEntries.slice(0, 3);

  const balance = profile?.token_balance ?? 0;
  const planKey = profile?.plan ?? 'free';
  const total = PLAN_QUOTAS[planKey] ?? PLAN_QUOTAS.free;
  const used = Math.max(0, total - balance);
  const usedPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const firstName = firstNameOf(profile, user);
  const greeting = `${greetingFor(now)}، ${firstName}.`;
  const clockHH = String(now.getHours()).padStart(2, '0');
  const clockMM = String(now.getMinutes()).padStart(2, '0');
  const weekday = WEEKDAY_AR[now.getDay()];

  const actions: QuickAction[] = [
    { id: 'analyze', title: 'تحليل البروفايل', description: 'رادار شامل مقابل دور هدف', cost: 25, href: '/v2/analyze', icon: RadarIcon },
    { id: 'post',    title: 'صياغة منشور',     description: 'AI · بصوتك أنت',           cost: 20, href: '/v2/posts', icon: PostIcon },
    { id: 'cv',      title: 'منشئ السيرة',      description: 'CV احترافي مخصّص',         cost: 40, href: '/v2/cvs',  icon: CvIcon  },
  ];


  const TokenCard = (
    loading ? (
      <Card padding="lg" radius="lg" elevated className="h-full">
        <Skeleton variant="text" width={100} className="mb-3" />
        <Skeleton variant="text" lines={2} />
      </Card>
    ) : (
      <Card padding="lg" radius="lg" elevated className="h-full">
        <div className="flex items-start justify-between mb-1">
          <Eyebrow>TOKEN BALANCE</Eyebrow>
          <button
            type="button"
            onClick={() => navigate('/v2/pricing')}
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
    )
  );

  const TipCard = (
    <Card padding="md" radius="lg" className="h-full bg-teal-50 border-teal-100">
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
  );

  const ActionsBlock = (
    <div>
      <h2 className="mb-3 font-ar text-[17px] font-semibold text-v2-ink lg:mb-4 lg:text-[19px]">
        إجراءات سريعة
      </h2>
      {/* Mobile: stacked rows, Desktop: 3-card horizontal grid */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-4">
        {actions.map((action, i) => (
          <button
            key={action.id}
            type="button"
            onClick={() => navigate(action.href)}
            className={`grid grid-cols-[36px_1fr_auto_12px] items-center gap-3 px-1 py-4 text-start cursor-pointer
              border-b border-v2-line ${i === 0 ? 'border-t' : ''}
              hover:bg-v2-canvas-2 transition-colors duration-200 ease-out
              lg:flex lg:flex-col lg:items-start lg:gap-3 lg:rounded-v2-lg lg:border lg:border-v2-line lg:bg-v2-surface lg:px-5 lg:py-5 lg:hover:shadow-card
              lg:[border-bottom-width:1px] lg:[border-top-width:1px]
              `}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-v2-md bg-v2-canvas-2 text-v2-ink lg:h-11 lg:w-11">
              {action.icon}
            </span>
            <span className="font-ar lg:flex lg:w-full lg:flex-col">
              <span className="block text-[14px] font-semibold text-v2-ink lg:text-[15px]">{action.title}</span>
              <span className="block text-[12px] text-v2-dim lg:mt-0.5 lg:text-[13px]">{action.description}</span>
            </span>
            <NumDisplay className="text-[12px] text-v2-body lg:mt-1 lg:text-[12px] lg:font-semibold lg:text-teal-700">
              {action.cost} توكن
            </NumDisplay>
            <span className="text-v2-mute lg:hidden">{ChevronStart}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const RecentBlock = (
    <div>
      <div className="mb-3 flex items-baseline justify-between lg:mb-4">
        <h2 className="font-ar text-[17px] font-semibold text-v2-ink lg:text-[19px]">آخر النشاط</h2>
        <button
          type="button"
          onClick={() => navigate('/v2/activity')}
          className="font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
        >
          السجل ←
        </button>
      </div>
      <div className="flex flex-col">
        {loading || activityLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
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
        ) : recentActivity.length === 0 ? (
          <div className="border-y border-v2-line px-1 py-8 text-center">
            <p className="font-ar text-[14px] text-v2-dim">لا توجد أنشطة حديثة بعد.</p>
            <button
              type="button"
              onClick={() => navigate('/v2/analyze')}
              className="mt-2 font-ar text-[12px] font-semibold text-teal-700 hover:text-teal-600 cursor-pointer"
            >
              ابدأ بأول تحليل ←
            </button>
          </div>
        ) : (
          recentActivity.map((item, i) => (
            <div
              key={item.id}
              className={`grid grid-cols-[60px_1fr_12px] items-center gap-3 px-1 py-3.5
                border-b border-v2-line ${i === 0 ? 'border-t' : ''}`}
            >
              <Eyebrow>{KIND_EYEBROW[item.kind]}</Eyebrow>
              <div className="font-ar">
                <span className="block text-[14px] font-medium text-v2-ink">{item.title}</span>
                <span className="block text-[12px] text-v2-dim">
                  {item.description ? `${item.description} · ` : ''}{relativeLabel(item.timestamp, now.getTime())}
                </span>
              </div>
              <span className="text-v2-mute">{ChevronStart}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

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

      {/* Mobile: vertical stack with bottom-nav padding.
          Desktop: 12-col grid dashboard, no extra padding (DesktopShell owns it). */}
      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">

        {/* Greeting — full width on both. Bigger on lg. */}
        <div className="mt-5 mb-6 lg:mt-2 lg:mb-8">
          <Eyebrow className="mb-1.5 block">
            <NumDisplay>{clockHH}:{clockMM}</NumDisplay> · {weekday}
          </Eyebrow>
          {loading ? (
            <Skeleton variant="text" width="60%" className="h-[36px] lg:h-[44px]" />
          ) : (
            <h1 className="font-ar font-bold leading-tight text-v2-ink text-[28px] lg:text-[36px]">
              {greeting}
            </h1>
          )}
        </div>

        {/* Mobile flow: TokenCard → Actions → Tip → Recent → CTA. */}
        {/* Desktop: 12-col grid, two rows of (8/4). */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">

          {/* Row 1, mobile: TokenCard. Desktop: TokenCard col-span-4 (right in RTL).
              On mobile the visual order matches the original page so we render
              it before Actions; on desktop the grid places it on the start side
              (right in RTL) thanks to col-start. */}
          <div className="mb-6 lg:order-2 lg:col-span-4 lg:mb-0">
            {TokenCard}
          </div>

          {/* Row 1: Actions — mobile under TokenCard, desktop col-span-8 */}
          <div className="mb-6 lg:order-1 lg:col-span-8 lg:mb-0">
            {ActionsBlock}
          </div>

          {/* Row 2: Recent activity (col-span-8) */}
          <div className="mb-0 lg:order-3 lg:col-span-8 lg:mt-2">
            {RecentBlock}
          </div>

          {/* Row 2: Tip card (col-span-4) */}
          <div className="mb-6 lg:order-4 lg:col-span-4 lg:mb-0 lg:mt-2">
            {TipCard}
          </div>
        </div>

        {/* Primary CTA — full-width on mobile, centered max-w on desktop */}
        <div className="mt-8 mb-2 lg:mt-12 lg:mb-0 lg:flex lg:justify-center">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/v2/analyze')}
            className="lg:w-auto lg:px-10"
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
          { id: 'tools',   label: 'الأدوات',  icon: <span /> , onSelect: () => navigate('/v2/cvs') },
          { id: 'profile', label: 'حسابي',    icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="plus"
        onFabClick={() => navigate('/v2/analyze')}
      />
    </Phone>
  );
}

export default Home;
