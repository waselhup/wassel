import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import Pill from '@/components/v2/Pill';
import EmptyState from '@/components/v2/EmptyState';
import Skeleton, { useInitialLoading } from '@/components/v2/Skeleton';
import { useIsDesktop } from '@/components/v2/ResponsiveShell';

type FilterId = 'all' | 'analysis' | 'post' | 'billing';
type ItemKind = Exclude<FilterId, 'all'>;
type IconName = 'radar' | 'send' | 'edit' | 'token' | 'sync' | 'card' | 'clock' | 'trophy';

interface ActivityItem {
  id: string;
  kind: ItemKind;
  title: string;
  description: string;
  time: string;
  icon: IconName;
}

interface ActivityGroup {
  label: string;
  items: ActivityItem[];
}

const GROUPS: ActivityGroup[] = [
  {
    label: 'اليوم',
    items: [
      { id: 'a1', kind: 'analysis', title: 'اكتمل تحليل البروفايل',     description: 'الدرجة: 88/100 · 3 توصيات جديدة',       time: '14:32', icon: 'radar' },
      { id: 'a2', kind: 'post',     title: 'تم نشر منشور',              description: '"القيادة في عصر AI" · 42 تفاعل',        time: '11:20', icon: 'send' },
      { id: 'a3', kind: 'post',     title: 'منشور بحاجة مراجعة',        description: '"دروس من 5 سنوات"',                      time: '09:45', icon: 'edit' },
    ],
  },
  {
    label: 'أمس',
    items: [
      { id: 'a4', kind: 'billing',  title: 'تم خصم 20 توكن',            description: 'صياغة منشور · "كيف غيّرت 3 عادات"',     time: '16:10', icon: 'token' },
      { id: 'a5', kind: 'analysis', title: 'تم رفع البروفايل من LinkedIn', description: 'تحديث تلقائي · أسبوعي',                time: '06:00', icon: 'sync' },
    ],
  },
  {
    label: 'هذا الأسبوع',
    items: [
      { id: 'a6', kind: 'billing',  title: 'تجديد الباقة · برو',         description: '99 ر.س · فيزا تنتهي 4242',              time: 'الإثنين', icon: 'card' },
      { id: 'a7', kind: 'post',     title: 'منشور قابل للجدولة',         description: 'اقتراح: نشر يوم الثلاثاء 9 صباحاً',     time: 'الأحد',    icon: 'clock' },
      { id: 'a8', kind: 'analysis', title: 'إنجاز جديد',                 description: 'وصلت 10 تحليلات هذا الشهر',             time: 'الأحد',    icon: 'trophy' },
    ],
  },
];

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',      label: 'الكل' },
  { id: 'analysis', label: 'تحليلات' },
  { id: 'post',     label: 'منشورات' },
  { id: 'billing',  label: 'مدفوعات' },
];

const KIND_LABEL: Record<ItemKind, string> = {
  analysis: 'تحليل',
  post:     'منشور',
  billing:  'فاتورة',
};

const ICONS: Record<IconName, ReactElement> = {
  radar: (
    <>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
    </>
  ),
  send: <path d="M3 9 L15 3 L11 15 L9 11 L3 9 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />,
  edit: (
    <>
      <path d="M3 12 L3 15 L6 15 L14 7 L11 4 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M11 4 L14 7" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  token: (
    <>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 5 V13 M5 9 H13" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  sync: (
    <>
      <path d="M3 9 a6 6 0 0110-4.2 M15 9 a6 6 0 01-10 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M11 4 L13 4 L13 6 M7 14 L5 14 L5 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="4" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 7 H15.5" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 6 V9 L11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  trophy: (
    <>
      <path d="M5 4 H13 V8 a4 4 0 01-8 0 V4 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 5 H3 V7 a2 2 0 002 2 M13 5 H15 V7 a2 2 0 01-2 2 M9 12 V14 M6 14 H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
};

const KIND_BG: Record<ItemKind, string> = {
  analysis: 'bg-teal-50 text-teal-700',
  post:     'bg-v2-canvas-2 text-v2-body',
  billing:  'bg-v2-indigo-50 text-v2-indigo',
};

const PULL_THRESHOLD = 80;

/** mini sparkline-like chart showing weekly activity counts */
function WeeklyChart({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const w = 200, h = 56, gap = 4;
  const barW = (w - gap * (counts.length - 1)) / counts.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="block w-full">
      {counts.map((c, i) => {
        const bh = (c / max) * (h - 4);
        const x = i * (barW + gap);
        const y = h - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh || 1}
            rx="2"
            fill={i === counts.length - 1 ? 'var(--teal-600)' : 'var(--teal-300)'}
            opacity={i === counts.length - 1 ? 1 : 0.7}
          />
        );
      })}
    </svg>
  );
}

function Activity() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const loading = useInitialLoading(800);
  const [filter, setFilter] = useState<FilterId>('all');

  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!refreshing) return;
    const id = window.setTimeout(() => {
      setRefreshing(false);
      setPull(0);
    }, 900);
    return () => window.clearTimeout(id);
  }, [refreshing]);

  const onTouchStart = (e: React.TouchEvent) => {
    // Pull-to-refresh is mobile-only.
    if (isDesktop) return;
    const el = scrollerRef.current;
    if (!el || el.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (isDesktop) return;
    if (startY.current == null) return;
    const delta = (e.touches[0]?.clientY ?? 0) - startY.current;
    if (delta <= 0) { setPull(0); return; }
    setPull(Math.min(delta * 0.5, PULL_THRESHOLD * 1.4));
  };
  const onTouchEnd = () => {
    if (isDesktop) return;
    if (startY.current == null) return;
    if (pull >= PULL_THRESHOLD) {
      setRefreshing(true);
    } else {
      setPull(0);
    }
    startY.current = null;
  };

  const filtered: ActivityGroup[] = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => filter === 'all' || it.kind === filter),
  })).filter((g) => g.items.length > 0);

  const totalCount = filtered.reduce((sum, g) => sum + g.items.length, 0);
  // For the desktop sidebar — fixed mock counts mirroring GROUPS.
  const weeklyCounts = [3, 5, 2, 4, 6, 3, 8]; // last 7 days, today = last item
  const todayCount = GROUPS[0]?.items.length ?? 0;

  const filterSummary = FILTERS.filter((f) => f.id !== 'all').map((f) => {
    const count = GROUPS.flatMap((g) => g.items).filter((it) => it.kind === f.id).length;
    return { ...f, count };
  });

  const ListContent = (
    <>
      {loading ? (
        <div className="flex flex-col gap-4 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-v2-line pb-4">
              <Skeleton variant="card" className="!h-9 !w-9 !rounded-v2-sm" />
              <div className="flex-1">
                <Skeleton variant="text" lines={2} />
              </div>
              <Skeleton variant="text" width={36} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="search"
          title="لا يوجد نشاط"
          description="لم نجد عناصر تطابق هذا الفلتر. جرّب فلتراً آخر."
        />
      ) : (
        <>
          <div className="pt-4 pb-2 flex items-center gap-2 text-v2-mute lg:pt-2">
            <span className="font-ar text-[11px]">عرض</span>
            <NumDisplay className="text-[11px]">{totalCount}</NumDisplay>
            <span className="font-ar text-[11px]">عنصر</span>
          </div>

          {filtered.map((g) => (
            <div key={g.label}>
              <div className="flex items-center gap-2 pb-2.5 pt-5">
                <Eyebrow>{g.label}</Eyebrow>
                <div className="h-px flex-1 bg-v2-line" />
                <NumDisplay className="text-[10px] text-v2-mute">{g.items.length}</NumDisplay>
              </div>

              {g.items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[36px_1fr_auto] items-start gap-3 border-b border-v2-line py-3.5
                    lg:grid-cols-[44px_minmax(0,1fr)_100px_120px_80px] lg:items-center lg:gap-4 lg:py-4"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-v2-sm border border-v2-line ${KIND_BG[it.kind]} lg:h-11 lg:w-11`}
                    aria-hidden="true"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      {ICONS[it.icon]}
                    </svg>
                  </div>

                  {/* Mobile: title+desc stacked. Desktop: split into Type / Description columns. */}
                  <div className="min-w-0 lg:hidden">
                    <div className="font-ar text-[14px] font-medium text-v2-ink">{it.title}</div>
                    <div className="mt-0.5 font-ar text-[12px] text-v2-dim">{it.description}</div>
                  </div>
                  <div className="hidden lg:block lg:min-w-0">
                    <div className="font-ar text-[14px] font-semibold text-v2-ink truncate">{it.title}</div>
                    <div className="mt-0.5 font-ar text-[12px] text-v2-dim truncate">{it.description}</div>
                  </div>

                  {/* Desktop "Type" column — kind label as pill */}
                  <span className="hidden lg:inline-flex">
                    <span className={`rounded-full border px-2 py-0.5 font-ar text-[11px] font-semibold ${
                      it.kind === 'analysis' ? 'border-teal-100 bg-teal-50 text-teal-700' :
                      it.kind === 'billing'  ? 'border-v2-indigo/30 bg-v2-indigo-50 text-v2-indigo' :
                                               'border-v2-line bg-v2-canvas-2 text-v2-body'
                    }`}>
                      {KIND_LABEL[it.kind]}
                    </span>
                  </span>

                  {/* Desktop "Status" column — completed/info dot */}
                  <span className="hidden lg:flex lg:items-center lg:gap-2 lg:justify-end">
                    <span className="block h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
                    <span className="font-ar text-[12px] text-v2-body">مكتمل</span>
                  </span>

                  <NumDisplay className="whitespace-nowrap text-[11px] text-v2-mute lg:text-end lg:text-[12px]">
                    {it.time}
                  </NumDisplay>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </>
  );

  return (
    <Phone>
      <Topbar
        title={t('v2.activity.title', 'النشاط')}
        bg="canvas"
        trailing={
          <button
            type="button"
            aria-label="فرز"
            className="flex h-9 w-9 items-center justify-center rounded-v2-pill text-v2-ink hover:bg-v2-canvas-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 4 H13 M5 8 H11 M7 12 H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        }
      />

      {/* Filters — pill row on mobile (sticky), absolute on desktop within list column */}
      <div className="sticky top-[52px] z-[5] flex gap-1.5 overflow-x-auto border-b border-v2-line bg-v2-canvas px-[22px] py-3 lg:static lg:top-auto lg:z-auto lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0 lg:mb-3 lg:gap-2">
        {FILTERS.map((f) => (
          <Pill
            key={f.id}
            size="sm"
            tone="neutral"
            selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className="shrink-0"
          >
            {f.label}
          </Pill>
        ))}
      </div>

      {/* Pull-to-refresh indicator — mobile only */}
      <div
        className="flex items-center justify-center overflow-hidden text-teal-600 lg:hidden"
        style={{ height: pull, transition: refreshing ? 'height 200ms var(--ease-out)' : undefined }}
        aria-hidden={!refreshing}
      >
        {pull > 0 && (
          <div className={refreshing ? 'animate-spin' : ''}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 2 a8 8 0 018 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                style={{ opacity: Math.min(pull / PULL_THRESHOLD, 1) }}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Mobile: single scroller. Desktop: 70/30 split (10-col grid). */}
      <div className="flex-1 overflow-y-auto px-[22px] pb-[110px] lg:overflow-visible lg:px-0 lg:pb-0 lg:grid lg:grid-cols-10 lg:gap-8 lg:pt-2"
        ref={scrollerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* List column — col-span-7 (70%) */}
        <div className="lg:col-span-7 lg:min-w-0">
          {ListContent}
        </div>

        {/* Stats sidebar — col-span-3 (30%), sticky */}
        <aside className="hidden lg:col-span-3 lg:block" aria-label="إحصاءات النشاط">
          <div className="sticky top-[88px] flex flex-col gap-4">
            {/* This week */}
            <Card padding="lg" radius="lg" elevated>
              <Eyebrow className="!text-teal-700">نشاط هذا الأسبوع</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <NumDisplay className="text-[36px] font-bold leading-none text-v2-ink">
                  {weeklyCounts.reduce((a, b) => a + b, 0)}
                </NumDisplay>
                <span className="font-ar text-[12px] text-v2-dim">حدث</span>
              </div>
              <div className="mt-3">
                <WeeklyChart counts={weeklyCounts} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Eyebrow>اليوم</Eyebrow>
                <NumDisplay className="text-[12px] font-semibold text-teal-700">{todayCount}</NumDisplay>
              </div>
            </Card>

            {/* Filter summary */}
            <Card padding="lg" radius="lg">
              <Eyebrow className="mb-3 block">حسب النوع</Eyebrow>
              <ul className="m-0 list-none p-0 flex flex-col gap-2.5">
                {filterSummary.map((f) => (
                  <li key={f.id} className="flex items-center justify-between font-ar text-[13px]">
                    <span className="text-v2-body">{f.label}</span>
                    <NumDisplay className="text-[13px] font-semibold text-v2-ink">{f.count}</NumDisplay>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Quick actions */}
            <Card padding="md" radius="lg">
              <Eyebrow className="mb-3 block">إجراءات</Eyebrow>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="sm" fullWidth>
                  تصدير CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => setFilter('all')}
                  disabled={filter === 'all'}
                >
                  إعادة تعيين الفلتر
                </Button>
              </div>
            </Card>
          </div>
        </aside>
      </div>

      <BottomNav
        active="activity"
        items={[
          { id: 'home',     label: 'الرئيسية', icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'analyze',  label: 'الرادار',  icon: <span />, onSelect: () => navigate('/v2/analyze') },
          { id: 'activity', label: 'النشاط',   icon: <span />, onSelect: () => navigate('/v2/activity') },
          { id: 'profile',  label: 'حسابي',    icon: <span />, onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="plus"
        onFabClick={() => navigate('/v2/analyze')}
      />
    </Phone>
  );
}

export default Activity;
