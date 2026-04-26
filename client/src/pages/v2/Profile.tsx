import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const PLAN_LABELS: Record<string, string> = {
  free: 'مجاني',
  starter: 'بداية',
  pro: 'برو',
  elite: 'إيليت',
};

function initialOf(name: string | null | undefined, fallback: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return fallback;
  return Array.from(trimmed)[0]!;
}

function linkedinHandleFrom(url: string | null | undefined): string {
  if (!url) return '';
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (m && m[1]) return m[1];
  return url;
}

function memberSinceLabel(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `عضو منذ ${months[d.getMonth()]} ${d.getFullYear()}`;
}

type Tab = 'profile' | 'plan' | 'notif' | 'security';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  group: 'activity' | 'product' | 'marketing';
}

interface SecurityRow {
  id: string;
  title: string;
  description: string;
  kind: 'link' | 'toggle';
  group: 'access' | 'sessions' | 'danger';
  danger?: boolean;
}

const NOTIFICATIONS: NotificationSetting[] = [
  { id: 'analyses',     title: 'تحليلات جديدة',   description: 'عند اكتمال تحليل بروفايل',  group: 'activity' },
  { id: 'weekly',       title: 'اقتراحات أسبوعية', description: 'ملخص أسبوعي بالتوصيات',     group: 'activity' },
  { id: 'scheduled',    title: 'منشورات مجدولة',  description: 'تذكير قبل النشر',            group: 'activity' },
  { id: 'product',      title: 'تحديثات المنتج',  description: 'ميزات جديدة وإعلانات',       group: 'product' },
  { id: 'promotions',   title: 'عروض ترويجية',    description: 'خصومات وعروض الباقات',      group: 'marketing' },
];

const NOTIF_GROUPS: { id: NotificationSetting['group']; label: string }[] = [
  { id: 'activity',   label: 'النشاط' },
  { id: 'product',    label: 'المنتج' },
  { id: 'marketing',  label: 'التسويق' },
];

const SECURITY: SecurityRow[] = [
  { id: 'password',  title: 'تغيير كلمة المرور', description: 'آخر تغيير قبل 3 أشهر',           kind: 'link',   group: 'access' },
  { id: '2fa',       title: 'المصادقة الثنائية',  description: 'مفعّلة · رسالة نصية',           kind: 'toggle', group: 'access' },
  { id: 'sessions',  title: 'الجلسات النشطة',     description: '2 أجهزة · iPhone, Mac',           kind: 'link',   group: 'sessions' },
  { id: 'delete',    title: 'حذف الحساب',         description: 'حذف نهائي للحساب والبيانات',  kind: 'link',   group: 'danger', danger: true },
];

const SECURITY_GROUPS: { id: SecurityRow['group']; label: string }[] = [
  { id: 'access',   label: 'الوصول' },
  { id: 'sessions', label: 'الجلسات' },
  { id: 'danger',   label: 'منطقة خطرة' },
];

const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'profile',  label: 'الملف',     icon: (<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M3 16 a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>) },
  { id: 'plan',     label: 'الباقة',    icon: (<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="2" y="4" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M2 8 H16" stroke="currentColor" strokeWidth="1.4" /></svg>) },
  { id: 'notif',    label: 'الإشعارات', icon: (<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 7 a6 6 0 0112 0 v4 l1.5 2 H1.5 L3 11 Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 15 a2 2 0 004 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>) },
  { id: 'security', label: 'الأمان',    icon: (<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 2 L15 5 V9 c0 4 -3 6 -6 7 c-3 -1 -6 -3 -6 -7 V5 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>) },
];

function StatCell({ label, value, end = false }: { label: string; value: ReactNode; end?: boolean }) {
  return (
    <div className={`text-center lg:text-start ${end ? '' : 'border-e border-v2-line lg:border-e-0'}`}>
      <NumDisplay className="block text-[22px] font-bold leading-none text-v2-ink lg:text-[32px]">
        {value}
      </NumDisplay>
      <Eyebrow className="mt-1 block lg:mt-2">{label}</Eyebrow>
    </div>
  );
}

function NotifRow({ n, on, onChange }: { n: NotificationSetting; on: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-v2-line py-4 last:border-b-0 lg:py-3.5">
      <div className="flex-1">
        <div className="font-ar text-[14px] font-medium text-v2-ink">{n.title}</div>
        <div className="mt-0.5 font-ar text-[12px] text-v2-dim">{n.description}</div>
      </div>
      <Toggle checked={on} onChange={onChange} label={n.title} />
    </div>
  );
}

function SecurityCardRow({ row, twoFA, setTwoFA }: { row: SecurityRow; twoFA: boolean; setTwoFA: (n: boolean) => void }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-v2-line py-4 last:border-b-0">
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
  );
}

function Profile() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Sync form state from profile when it loads / changes.
  useEffect(() => {
    setName(profile?.full_name ?? '');
    setEmail(profile?.email ?? user?.email ?? '');
    setLinkedin(linkedinHandleFrom(profile?.linkedin_url));
    setBio(profile?.title ?? '');
  }, [profile, user?.email]);

  const planLabel = PLAN_LABELS[profile?.plan ?? 'free'] ?? 'مجاني';
  const memberSince = useMemo(() => memberSinceLabel(profile?.created_at), [profile?.created_at]);
  const avatarInitial = initialOf(profile?.full_name ?? user?.email, '?');

  // mock device-level prefs (not yet persisted) — clearly local-only
  const [notif, setNotif] = useState<Record<string, boolean>>({
    analyses: true, weekly: true, scheduled: true, product: false, promotions: false,
  });
  const setNotifKey = (id: string) => (next: boolean) =>
    setNotif((prev) => ({ ...prev, [id]: next }));

  const [twoFA, setTwoFA] = useState(false);

  const handleSave = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const linkedinUrl = linkedin.trim()
        ? (linkedin.startsWith('http') ? linkedin.trim() : `https://linkedin.com/in/${linkedin.trim()}`)
        : null;
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name.trim() || null,
          linkedin_url: linkedinUrl,
          title: bio.trim() || null,
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setSaveMsg({ tone: 'ok', text: 'تم حفظ التغييرات.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ التغييرات.';
      setSaveMsg({ tone: 'err', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/v2', { replace: true });
  };

  return (
    <Phone>
      <Topbar
        title={t('v2.profile.title', 'حسابي')}
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

      {/* HEADER BAND — full-width on desktop with subtle teal-50 wash */}
      <div className="border-b border-v2-line px-[22px] py-5 lg:rounded-v2-lg lg:border lg:bg-gradient-to-br lg:from-teal-50 lg:to-v2-canvas-2 lg:px-8 lg:py-7">
        <div className="mb-4 flex items-center gap-3.5 lg:mb-6 lg:gap-5">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name || 'avatar'}
              className="h-14 w-14 rounded-full object-cover lg:h-20 lg:w-20"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full font-ar text-[22px] font-bold text-white lg:h-20 lg:w-20 lg:text-[32px]"
              style={{ background: 'linear-gradient(135deg, var(--teal-300), var(--teal-700))' }}
              aria-hidden="true"
            >
              {avatarInitial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-ar text-[16px] font-semibold text-v2-ink lg:text-[22px] lg:font-bold">
              {name || email || '—'}
            </div>
            <div className="mt-0.5 font-en text-[12px] text-v2-dim lg:text-[14px]">{email}</div>
            <div className="mt-1.5 flex items-center gap-1.5 lg:mt-2.5">
              <span className="rounded-full bg-teal-50 px-2 py-0.5 font-ar text-[10px] font-semibold text-teal-700 lg:bg-v2-surface lg:px-2.5 lg:py-1 lg:text-[11px]">
                {planLabel}
              </span>
              {memberSince && (
                <span className="font-ar text-[11px] text-v2-dim lg:text-[12px]">{memberSince}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-v2-line pt-3.5 lg:grid-cols-3 lg:border-t-0 lg:pt-0 lg:gap-12">
          <StatCell label="التحليلات" value={profile?.cvs_generated ?? 0} />
          <StatCell label="المنشورات" value={profile?.campaigns_sent ?? 0} />
          <StatCell label="درجة البروفايل" value={profile?.linkedin_score ?? 0} end />
        </div>
      </div>

      {/* MOBILE TAB BAR — pills, sticky. Hidden on lg. */}
      <div className="sticky top-[52px] z-[5] flex gap-1.5 overflow-x-auto border-b border-v2-line bg-v2-canvas px-[22px] py-3 lg:hidden">
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

      {/* Mobile: single column. Desktop: vertical sidebar tabs (right in RTL) + content. */}
      <div className="flex-1 px-[22px] pb-[110px] pt-5 lg:px-0 lg:pb-0 lg:pt-8 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">

        {/* Vertical sidebar tabs — desktop only */}
        <aside className="hidden lg:block" aria-label="أقسام الملف الشخصي">
          <nav className="sticky top-[88px] flex flex-col gap-1 rounded-v2-lg border border-v2-line bg-v2-surface p-2">
            {tabs.map((tb) => {
              const active = tab === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-v2-sm px-3 py-2.5 text-start cursor-pointer
                    transition-colors duration-200 ease-out font-ar text-[14px]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30
                    ${active ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-v2-body hover:bg-v2-canvas-2 hover:text-v2-ink'}`}
                >
                  <span className={active ? 'text-teal-700' : 'text-v2-mute'}>{tb.icon}</span>
                  <span className="flex-1">{tb.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content column */}
        <div className="lg:min-w-0">
          {tab === 'profile' && (
            <div className="flex flex-col gap-3.5 lg:gap-5 lg:max-w-[640px]">
              <Input label="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                label="البريد الإلكتروني"
                dir="ltr"
                type="email"
                value={email}
                readOnly
                disabled
              />
              <Input
                label="رابط لينكد إن"
                dir="ltr"
                leadingSlot="linkedin.com/in/"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
              <div>
                <label htmlFor="bio" className="mb-1.5 block font-ar text-[12px] font-medium text-v2-body">
                  المسمى الوظيفي
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-v2-md border border-v2-line bg-v2-surface px-3.5 py-3 font-ar text-[14px] leading-relaxed text-v2-ink outline-none placeholder:text-v2-mute focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 lg:min-h-[120px]"
                />
              </div>
              {saveMsg && (
                <div
                  role={saveMsg.tone === 'err' ? 'alert' : 'status'}
                  className={`rounded-v2-md px-3.5 py-2.5 font-ar text-[13px] ${
                    saveMsg.tone === 'ok'
                      ? 'border border-teal-200 bg-teal-50 text-teal-700'
                      : 'border border-v2-rose/30 bg-v2-rose-50 text-v2-rose'
                  }`}
                >
                  {saveMsg.text}
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleSave}
                disabled={saving}
                className="mt-2 lg:w-auto lg:self-start lg:px-8"
              >
                {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
              </Button>
            </div>
          )}

          {tab === 'plan' && (
            <div className="lg:grid lg:grid-cols-2 lg:gap-5">
              {/* Current plan card */}
              <div>
                <Card padding="lg" radius="md" className="mb-4 border-0 bg-v2-ink text-white lg:mb-0 lg:h-full">
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

                  {/* Usage strip — moved into the card on desktop too */}
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <Eyebrow className="!text-teal-300 mb-2 block">الاستهلاك</Eyebrow>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="font-ar text-[13px] opacity-80">التوكن المستخدم</span>
                      <NumDisplay className="text-[12px] font-semibold">
                        1,760 / 2,000
                      </NumDisplay>
                    </div>
                    <div className="h-1 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-teal-400" style={{ width: '88%' }} />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Upgrade options panel — desktop only mirrors actions, mobile keeps under usage */}
              <div className="hidden lg:block">
                <Card padding="lg" radius="md" elevated className="h-full">
                  <Eyebrow className="!text-teal-700">الترقية إلى أعمال</Eyebrow>
                  <p className="mt-2 font-ar text-[13px] leading-relaxed text-v2-body">
                    حسابات متعددة، إدارة فريق، تقارير شهرية، ومدير حساب مخصّص.
                  </p>
                  <ul className="mt-3 m-0 list-none p-0 flex flex-col gap-1.5">
                    {[
                      'حتى 5 حسابات',
                      '10,000 توكن شهرياً',
                      'تقارير الفريق',
                      'دعم بأولوية',
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2 font-ar text-[13px] text-v2-body">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="mt-1 shrink-0">
                          <path d="M2 6 L5 9 L10 3" stroke="var(--teal-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button variant="primary" size="md" fullWidth>
                      الترقية إلى أعمال
                    </Button>
                    <Button variant="secondary" size="md" fullWidth>
                      إدارة الفواتير
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Mobile usage + actions strip */}
              <div className="lg:hidden">
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
            </div>
          )}

          {tab === 'notif' && (
            // Mobile: flat list. Desktop: grouped by category in a card.
            <>
              <div className="flex flex-col lg:hidden">
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
              <div className="hidden flex-col gap-5 lg:flex lg:max-w-[760px]">
                {NOTIF_GROUPS.map((g) => {
                  const items = NOTIFICATIONS.filter((n) => n.group === g.id);
                  if (items.length === 0) return null;
                  return (
                    <Card key={g.id} padding="lg" radius="lg">
                      <Eyebrow className="mb-3 block">{g.label}</Eyebrow>
                      <div className="flex flex-col">
                        {items.map((n) => (
                          <NotifRow
                            key={n.id}
                            n={n}
                            on={notif[n.id] ?? false}
                            onChange={setNotifKey(n.id)}
                          />
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'security' && (
            // Mobile: flat list. Desktop: 2-col grouped cards.
            <>
              <div className="flex flex-col lg:hidden">
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
              <div className="hidden lg:grid lg:grid-cols-2 lg:gap-5">
                {SECURITY_GROUPS.map((g) => {
                  const items = SECURITY.filter((row) => row.group === g.id);
                  if (items.length === 0) return null;
                  const isDanger = g.id === 'danger';
                  return (
                    <Card
                      key={g.id}
                      padding="lg"
                      radius="lg"
                      className={isDanger ? 'border-v2-rose/30 bg-v2-rose-50/40' : ''}
                    >
                      <Eyebrow className={`mb-3 block ${isDanger ? '!text-v2-rose' : ''}`}>{g.label}</Eyebrow>
                      <div className="flex flex-col">
                        {items.map((row) => (
                          <SecurityCardRow key={row.id} row={row} twoFA={twoFA} setTwoFA={setTwoFA} />
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 lg:max-w-[320px]">
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={handleSignOut}
                >
                  تسجيل الخروج
                </Button>
              </div>
            </>
          )}
        </div>
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
