import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Skeleton from '@/components/v2/Skeleton';
import { trpc, type NotificationRowShape } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type FilterKind = 'all' | 'unread';

function Notifications() {
  const { i18n, t } = useTranslation();
  const isAr = (i18n.language || 'ar').startsWith('ar');
  const [, navigate] = useLocation();

  const [items, setItems] = useState<NotificationRowShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>('all');

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await trpc.notifications.list({ status: filter, limit: 100 });
      setItems(r.notifications);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const visible = useMemo(() => items, [items]);

  const titleFor = (n: NotificationRowShape) => isAr ? n.title_ar : n.title_en;
  const bodyFor  = (n: NotificationRowShape) => isAr ? n.body_ar  : n.body_en;
  const isUnread = (n: NotificationRowShape) =>
    n.status === 'pending' || n.status === 'sent' || n.status === 'delivered';

  async function open(n: NotificationRowShape) {
    try { await trpc.notifications.markAsRead({ notificationId: n.id }); } catch { /* ignore */ }
    if (n.cta_url) {
      try {
        const url = new URL(n.cta_url, window.location.origin);
        if (url.origin === window.location.origin) {
          navigate(url.pathname + url.search + url.hash);
        } else {
          window.location.href = n.cta_url;
        }
      } catch {
        navigate(n.cta_url);
      }
    } else {
      // mark-read in place
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, status: 'read' as const } : x));
    }
  }

  async function dismissOne(n: NotificationRowShape, e: React.MouseEvent) {
    e.stopPropagation();
    try { await trpc.notifications.dismiss({ notificationId: n.id }); } catch { /* ignore */ }
    setItems((prev) => prev.filter((x) => x.id !== n.id));
  }

  async function markAllRead() {
    try { await trpc.notifications.markAllAsRead(); } catch { /* ignore */ }
    setItems((prev) => prev.map((n) => isUnread(n) ? { ...n, status: 'read' as const } : n));
  }

  return (
    <Phone>
      <Topbar
        back
        onBack={() => navigate('/v2/home')}
        title={t('notifications.list.title', { defaultValue: isAr ? 'الإشعارات' : 'Notifications' })}
        bg="canvas"
      />

      <div className="flex-1 px-[18px] pb-12 pt-4 lg:mx-auto lg:max-w-[720px]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-v2-pill bg-v2-canvas-2 p-1">
            <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
              {t('notifications.list.filter.all', { defaultValue: isAr ? 'الكل' : 'All' })}
            </FilterTab>
            <FilterTab active={filter === 'unread'} onClick={() => setFilter('unread')}>
              {t('notifications.list.filter.unread', { defaultValue: isAr ? 'غير مقروء' : 'Unread' })}
            </FilterTab>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              className="font-ar text-[12px] font-medium text-teal-700 hover:underline"
            >
              {t('notifications.bell.markAllRead', { defaultValue: isAr ? 'تعليم الكل كمقروء' : 'Mark all as read' })}
            </button>
            <button
              type="button"
              onClick={() => navigate('/v2/settings/notifications')}
              className="rounded-v2-pill p-1.5 text-v2-body hover:bg-v2-canvas-2 hover:text-v2-ink"
              aria-label={isAr ? 'إعدادات' : 'Settings'}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6.4-2l1.4 2.1-2 3.4-2.4-.8a6.9 6.9 0 0 1-1.8 1L11 19H9l-.6-2.3a6.9 6.9 0 0 1-1.8-1L4.2 16.5l-2-3.4L3.6 11a7 7 0 0 1 0-2L2.2 6.9l2-3.4 2.4.8a6.9 6.9 0 0 1 1.8-1L9 1h2l.6 2.3a6.9 6.9 0 0 1 1.8 1l2.4-.8 2 3.4L16.4 9a7 7 0 0 1 0 2z" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-v2-md border border-v2-line bg-v2-surface p-10 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-v2-canvas-2 text-v2-mute">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 2c-3.31 0-6 2.69-6 6v3l-1.5 1.5v.5h15v-.5L16 11V8c0-3.31-2.69-6-6-6zM8 16a2 2 0 1 0 4 0H8z" fill="currentColor" />
              </svg>
            </div>
            <div className="font-ar text-[14px] font-medium text-v2-body">
              {t('notifications.list.empty', { defaultValue: isAr ? 'لا إشعارات بعد' : 'No notifications yet' })}
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-v2-md border bg-v2-surface px-4 py-3 text-start',
                    'transition-colors duration-150 cursor-pointer',
                    isUnread(n)
                      ? 'border-teal-200 bg-teal-50/40 hover:bg-teal-50/70'
                      : 'border-v2-line hover:bg-v2-canvas-2',
                  )}
                >
                  {isUnread(n) && (
                    <span className="mt-2 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-ar text-[14px] font-semibold text-v2-ink">{titleFor(n)}</div>
                    <div className="mt-1 font-ar text-[13px] text-v2-body">{bodyFor(n)}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="font-en text-[10px] text-v2-mute">
                        {new Date(n.created_at).toLocaleString(isAr ? 'ar-SA' : 'en-GB', {
                          dateStyle: 'medium', timeStyle: 'short',
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => dismissOne(n, e)}
                        className="font-ar text-[11px] text-v2-mute hover:text-red-600"
                      >
                        {isAr ? 'حذف' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Phone>
  );
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-v2-pill px-3 py-1 font-ar text-[12px] cursor-pointer transition-colors duration-150',
        active
          ? 'bg-v2-surface font-semibold text-v2-ink shadow-sm'
          : 'text-v2-body hover:text-v2-ink',
      )}
    >
      {children}
    </button>
  );
}

export default Notifications;
