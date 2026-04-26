import { useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import NumDisplay from '@/components/v2/NumDisplay';
import Input from '@/components/v2/Input';
import Pill from '@/components/v2/Pill';
import Toggle from '@/components/v2/Toggle';

type Tab = 'profile' | 'plan' | 'notif' | 'security';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
}

interface SecurityRow {
  id: string;
  title: string;
  description: string;
  kind: 'link' | 'toggle';
  danger?: boolean;
}

const NOTIFICATIONS: NotificationSetting[] = [
  { id: 'analyses',     title: 'تحليلات جديدة',   description: 'عند اكتمال تحليل بروفايل' },
  { id: 'weekly',       title: 'اقتراحات أسبوعية', description: 'ملخص أسبوعي بالتوصيات' },
  { id: 'scheduled',    title: 'منشورات مجدولة',  description: 'تذكير قبل النشر' },
  { id: 'product',      title: 'تحديثات المنتج',  description: 'ميزات جديدة وإعلانات' },
  { id: 'promotions',   title: 'عروض ترويجية',    description: 'خصومات وعروض الباقات' },
];

const SECURITY: SecurityRow[] = [
  { id: 'password',  title: 'تغيير كلمة المرور', description: 'آخر تغيير قبل 3 أشهر',           kind: 'link' },
  { id: '2fa',       title: 'المصادقة الثنائية',  description: 'مفعّلة · رسالة نصية',           kind: 'toggle' },
  { id: 'sessions',  title: 'الجلسات النشطة',     description: '2 أجهزة · iPhone, Mac',           kind: 'link' },
  { id: 'delete',    title: 'حذف الحساب',         description: 'حذف نهائي للحساب والبيانات',  kind: 'link', danger: true },
];

const tabs: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'الملف' },
  { id: 'plan',     label: 'الباقة' },
  { id: 'notif',    label: 'الإشعارات' },
  { id: 'security', label: 'الأمان' },
];

function StatCell({ label, value, end = false }: { label: string; value: ReactNode; end?: boolean }) {
  return (
    <div className={`text-center ${end ? '' : 'border-e border-v2-line'}`}>
      <NumDisplay className="block text-[22px] font-bold leading-none text-v2-ink">
        {value}
      </NumDisplay>
      <Eyebrow className="mt-1 block">{label}</Eyebrow>
    </div>
  );
}

function Profile() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>('profile');

  // form state
  const [name, setName] = useState('محمد العتيبي');
  const [email, setEmail] = useState('m.alotaibi@gmail.com');
  const [linkedin, setLinkedin] = useState('mohammed-otaibi');
  const [bio, setBio] = useState('Senior Product Manager — Aramco Digital. أكتب عن المنتجات والقيادة في السوق السعودي.');

  // notification toggles
  const [notif, setNotif] = useState<Record<string, boolean>>({
    analyses: true, weekly: true, scheduled: true, product: false, promotions: false,
  });
  const setNotifKey = (id: string) => (next: boolean) =>
    setNotif((prev) => ({ ...prev, [id]: next }));

  // 2FA toggle
  const [twoFA, setTwoFA] = useState(true);

  return (
    <Phone>
      <Topbar
        title="حسابي"
        bg="canvas"
        trailing={
          <button
            type="button"
            aria-label="الإعدادات"
            className="flex h-9 w-9 items-center justify-center rounded-v2-pill text-v2-ink hover:bg-v2-canvas-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9 2 V4 M9 14 V16 M2 9 H4 M14 9 H16 M3.5 3.5 L5 5 M13 13 L14.5 14.5 M3.5 14.5 L5 13 M13 5 L14.5 3.5"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        }
      />

      <div className="border-b border-v2-line px-[22px] py-5">
        <div className="mb-4 flex items-center gap-3.5">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full font-ar text-[22px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--teal-300), var(--teal-700))' }}
            aria-hidden="true"
          >
            م
          </div>
          <div className="flex-1">
            <div className="font-ar text-[16px] font-semibold text-v2-ink">{name}</div>
            <div className="mt-0.5 font-en text-[12px] text-v2-dim">{email}</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="rounded-full bg-teal-50 px-2 py-0.5 font-ar text-[10px] font-semibold text-teal-700">
                برو
              </span>
              <span className="font-ar text-[11px] text-v2-dim">عضو منذ يناير 2025</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-v2-line pt-3.5">
          <StatCell label="التحليلات" value="12" />
          <StatCell label="المنشورات" value="38" />
          <StatCell label="درجة البروفايل" value="74" end />
        </div>
      </div>

      <div className="sticky top-[52px] z-[5] flex gap-1.5 overflow-x-auto border-b border-v2-line bg-v2-canvas px-[22px] py-3">
        {tabs.map((tb) => (
          <Pill
            key={tb.id}
            size="sm"
            tone="neutral"
            selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className="shrink-0"
          >
            {tb.label}
          </Pill>
        ))}
      </div>

      <div className="flex-1 px-[22px] pb-[110px] pt-5">
        {tab === 'profile' && (
          <div className="flex flex-col gap-3.5">
            <Input label="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="البريد الإلكتروني" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              label="رابط لينكد إن"
              dir="ltr"
              leadingSlot="linkedin.com/in/"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
            />
            <div>
              <label htmlFor="bio" className="mb-1.5 block font-ar text-[12px] font-medium text-v2-body">
                نبذة قصيرة
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3 font-ar text-[14px] leading-relaxed text-v2-ink outline-none placeholder:text-v2-mute focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <Button variant="primary" size="lg" fullWidth className="mt-2">
              حفظ التغييرات
            </Button>
          </div>
        )}

        {tab === 'plan' && (
          <div>
            <Card padding="lg" radius="md" className="mb-4 border-0 bg-v2-ink text-white">
              <Eyebrow className="!text-teal-300">الباقة الحالية</Eyebrow>
              <div className="mt-2 flex items-baseline justify-between">
                <h2 className="font-ar text-[22px] font-bold">برو</h2>
                <NumDisplay className="text-[14px] opacity-70">99 ر.س / شهر</NumDisplay>
              </div>
              <div className="my-3 h-px bg-white/10" />
              <div className="flex items-center justify-between font-ar text-[12px]">
                <span className="opacity-70">التجديد القادم</span>
                <NumDisplay>1 فبراير 2025</NumDisplay>
              </div>
            </Card>

            <Eyebrow className="mb-2.5 block">الاستهلاك</Eyebrow>
            <div className="mb-5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-ar text-[13px] text-v2-body">التوكن المستخدم</span>
                <NumDisplay className="text-[12px] font-semibold text-v2-ink">
                  1,760 / 2,000
                </NumDisplay>
              </div>
              <div className="h-1 rounded-full bg-v2-line">
                <div className="h-full rounded-full bg-teal-500" style={{ width: '88%' }} />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <Button variant="primary" size="md" fullWidth>
                الترقية إلى أعمال
              </Button>
              <Button variant="secondary" size="md" fullWidth>
                إدارة الفواتير
              </Button>
            </div>
          </div>
        )}

        {tab === 'notif' && (
          <div className="flex flex-col">
            {NOTIFICATIONS.map((n, i) => (
              <div
                key={n.id}
                className={`flex items-center gap-3.5 border-b border-v2-line py-4 ${i === 0 ? 'border-t' : ''}`}
              >
                <div className="flex-1">
                  <div className="font-ar text-[14px] font-medium text-v2-ink">{n.title}</div>
                  <div className="mt-0.5 font-ar text-[12px] text-v2-dim">{n.description}</div>
                </div>
                <Toggle
                  checked={notif[n.id] ?? false}
                  onChange={setNotifKey(n.id)}
                  label={n.title}
                />
              </div>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <div className="flex flex-col">
            {SECURITY.map((row, i) => (
              <div
                key={row.id}
                className={`flex items-center gap-3.5 border-b border-v2-line py-4 ${i === 0 ? 'border-t' : ''}`}
              >
                <div className="flex-1">
                  <div className={`font-ar text-[14px] font-medium ${row.danger ? 'text-v2-rose' : 'text-v2-ink'}`}>
                    {row.title}
                  </div>
                  <div className="mt-0.5 font-ar text-[12px] text-v2-dim">{row.description}</div>
                </div>
                {row.kind === 'toggle' ? (
                  <Toggle checked={twoFA} onChange={setTwoFA} label={row.title} />
                ) : (
                  <button
                    type="button"
                    aria-label={row.title}
                    className="flex h-9 w-9 items-center justify-center rounded-v2-pill hover:bg-v2-canvas-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="rtl:rotate-180">
                      <path d="M4 3 L8 6 L4 9" stroke="var(--mute)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav
        active="profile"
        items={[
          { id: 'home',    label: 'الرئيسية', icon: <span />, onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: 'الرادار',  icon: <span />, onSelect: () => navigate('/v2/analyze') },
          { id: 'posts',   label: 'الاستوديو', icon: <span />, onSelect: () => navigate('/v2/posts') },
          { id: 'profile', label: 'حسابي',    icon: <span />, onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="plus"
        onFabClick={() => navigate('/v2/analyze')}
      />
    </Phone>
  );
}

export default Profile;
