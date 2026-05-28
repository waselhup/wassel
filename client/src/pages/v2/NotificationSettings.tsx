import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';
import Skeleton from '@/components/v2/Skeleton';
import { trpc, type NotificationPreferencesShape } from '@/lib/trpc';
import { cn } from '@/lib/utils';

function NotificationSettings() {
  const { i18n, t } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const [, navigate] = useLocation();

  const [prefs, setPrefs] = useState<NotificationPreferencesShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await trpc.notifications.getPreferences();
        if (!cancelled) setPrefs(r.preferences);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function update(patch: Partial<NotificationPreferencesShape>) {
    if (!prefs) return;
    setPrefs({ ...prefs, ...patch });
    setSaving(true);
    try {
      await trpc.notifications.updatePreferences({
        emailEnabled:           patch.email_enabled,
        inAppEnabled:           patch.in_app_enabled,
        marketingEmailsEnabled: patch.marketing_emails_enabled,
        language:               patch.language,
        quietHoursStart:        patch.quiet_hours_start ?? null,
        quietHoursEnd:          patch.quiet_hours_end ?? null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTestStatus('sending');
    try {
      await trpc.notifications.testNotification({ channel: 'in_app' });
      setTestStatus('sent');
      window.setTimeout(() => setTestStatus('idle'), 3000);
    } catch {
      setTestStatus('error');
      window.setTimeout(() => setTestStatus('idle'), 3000);
    }
  }

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/settings/privacy')}
        title={t('notifications.settings.title', { defaultValue: isAr ? 'إعدادات الإشعارات' : 'Notification settings' })}
        bg="canvas"
      />

      <div className="flex-1 px-[18px] pb-12 pt-4 lg:mx-auto lg:max-w-[640px]">
        {loading || !prefs ? (
          <div className="space-y-3">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ) : (
          <>
            {/* Channels */}
            <Section title={isAr ? 'القنوات' : 'Channels'}>
              <ToggleRow
                label={t('notifications.settings.email', { defaultValue: isAr ? 'إشعارات البريد الإلكتروني' : 'Email notifications' })}
                help={isAr ? 'تنبيهات النظام، الفوترة، تجديد الاشتراك' : 'System alerts, billing, subscription renewals'}
                checked={prefs.email_enabled}
                onChange={(v) => update({ email_enabled: v })}
              />
              <ToggleRow
                label={isAr ? 'إشعارات داخل التطبيق' : 'In-app notifications'}
                help={isAr ? 'في الجرس بأعلى الصفحة' : 'In the bell at the top of the page'}
                checked={prefs.in_app_enabled}
                onChange={(v) => update({ in_app_enabled: v })}
              />
              <ToggleRow
                label={t('notifications.settings.marketingEmails', { defaultValue: isAr ? 'نصائح ومحتوى وتحديثات' : 'Tips, content & updates' })}
                help={t('notifications.settings.marketingEmailsHelp', { defaultValue: isAr ? 'نصائح مهنية أسبوعياً. يمكنك إيقافها في أي وقت.' : 'Weekly career tips. You can stop them any time.' })}
                checked={prefs.marketing_emails_enabled}
                onChange={(v) => update({ marketing_emails_enabled: v })}
              />
            </Section>

            {/* Language */}
            <Section title={t('notifications.settings.language', { defaultValue: isAr ? 'لغة الإشعارات' : 'Notification language' })}>
              <div className="flex items-center gap-2">
                <LanguagePill active={prefs.language === 'ar'} onClick={() => update({ language: 'ar' })}>العربية</LanguagePill>
                <LanguagePill active={prefs.language === 'en'} onClick={() => update({ language: 'en' })}>English</LanguagePill>
              </div>
            </Section>

            {/* Quiet hours */}
            <Section
              title={t('notifications.settings.quietHours', { defaultValue: isAr ? 'ساعات الهدوء' : 'Quiet hours' })}
              subtitle={t('notifications.settings.quietHoursHelp', { defaultValue: isAr ? 'لن نرسل إشعارات خلال هذه الساعات' : 'We won\'t send notifications during this window' })}
            >
              <div className="grid grid-cols-2 gap-3">
                <TimeField
                  label={t('notifications.settings.from', { defaultValue: isAr ? 'من' : 'From' })}
                  value={prefs.quiet_hours_start ?? ''}
                  onChange={(v) => update({ quiet_hours_start: v || null })}
                />
                <TimeField
                  label={t('notifications.settings.to', { defaultValue: isAr ? 'إلى' : 'To' })}
                  value={prefs.quiet_hours_end ?? ''}
                  onChange={(v) => update({ quiet_hours_end: v || null })}
                />
              </div>
            </Section>

            {/* Test */}
            <Section title={isAr ? 'اختبار' : 'Test'}>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={sendTest}
                  disabled={testStatus === 'sending'}
                >
                  {testStatus === 'sending'
                    ? (isAr ? 'جارٍ الإرسال…' : 'Sending…')
                    : t('notifications.settings.testNotification', { defaultValue: isAr ? 'إرسال إشعار تجريبي' : 'Send test notification' })}
                </Button>
                {testStatus === 'sent' && (
                  <span className="font-ar text-[12px] text-teal-700">
                    {isAr ? 'تم — تحقق من الجرس' : 'Sent — check the bell'}
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="font-ar text-[12px] text-red-600">
                    {isAr ? 'فشل الإرسال' : 'Failed to send'}
                  </span>
                )}
              </div>
            </Section>

            {saving && (
              <div className="mt-4 text-center font-ar text-[11px] text-v2-mute">
                {isAr ? 'جارٍ الحفظ…' : 'Saving…'}
              </div>
            )}
          </>
        )}
      </div>
    </Phone>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-v2-md border border-v2-line bg-v2-surface p-4">
      <div className="mb-3">
        <h2 className="font-ar text-[14px] font-semibold text-v2-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 font-ar text-[12px] text-v2-mute">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label, help, checked, onChange,
}: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 py-2 cursor-pointer">
      <div className="min-w-0 flex-1">
        <div className="font-ar text-[13px] font-medium text-v2-ink">{label}</div>
        {help && <div className="mt-0.5 font-ar text-[11px] text-v2-mute">{help}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
          checked ? 'bg-teal-600' : 'bg-v2-canvas-2',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1',
          )}
        />
      </button>
    </label>
  );
}

function LanguagePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-v2-pill px-4 py-1.5 font-ar text-[13px] font-medium cursor-pointer transition-colors duration-150',
        active
          ? 'bg-teal-600 text-white'
          : 'bg-v2-canvas-2 text-v2-body hover:bg-v2-line',
      )}
    >
      {children}
    </button>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-ar text-[12px] text-v2-mute">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-v2-sm border border-v2-line bg-v2-canvas px-3 py-2 font-en text-[14px] text-v2-ink focus:border-teal-500 focus:outline-none"
      />
    </label>
  );
}

export default NotificationSettings;
