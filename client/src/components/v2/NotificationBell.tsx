import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { trpc, type NotificationRowShape } from '@/lib/trpc';
import { cn } from '@/lib/utils';

/**
 * Bell icon + dropdown panel. Lives in DesktopTopbar's account cluster.
 * Polls unread count every 60s; loads full list on dropdown open.
 *
 * R06 + R13: "Wassel leads" — clicking a notification marks it read
 * and navigates to its CTA URL (no menu of options).
 */
function NotificationBell() {
  const { i18n, t } = useTranslation();
  const [, navigate] = useLocation();
  const isAr = (i18n.language || 'ar').startsWith('ar');

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRowShape[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count every 60s
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await trpc.notifications.unreadCount();
        if (!cancelled) setUnread(r.count);
      } catch { /* ignore */ }
    };
    fetchCount();
    const id = window.setInterval(fetchCount, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Load list when dropdown opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await trpc.notifications.list({ status: 'all', limit: 10 });
        if (!cancelled) setItems(r.notifications);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const titleFor = (n: NotificationRowShape) => isAr ? n.title_ar : n.title_en;
  const bodyFor  = (n: NotificationRowShape) => isAr ? n.body_ar  : n.body_en;
  const isUnread = (n: NotificationRowShape) =>
    n.status === 'pending' || n.status === 'sent' || n.status === 'delivered';

  async function handleClick(n: NotificationRowShape) {
    setOpen(false);
    try { await trpc.notifications.markAsRead({ notificationId: n.id }); } catch { /* ignore */ }
    setUnread((c) => Math.max(0, c - (isUnread(n) ? 1 : 0)));
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
    }
  }

  async function handleMarkAllRead() {
    try {
      await trpc.notifications.markAllAsRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, status: 'read' as const })));
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notifications.bell.title', { defaultValue: isAr ? 'الإشعارات' : 'Notifications' })}
        aria-expanded={open}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-v2-pill cursor-pointer',
          'text-v2-body hover:bg-v2-canvas-2 hover:text-v2-ink',
          'transition-colors duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
        )}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2c-3.31 0-6 2.69-6 6v3l-1.5 1.5v.5h15v-.5L16 11V8c0-3.31-2.69-6-6-6zM8 16a2 2 0 1 0 4 0H8z"
            fill="currentColor"
          />
        </svg>
        {unread > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 end-0 inline-flex h-4 min-w-[16px] items-center justify-center',
              'rounded-full bg-red-500 px-1 font-en text-[10px] font-bold text-white shadow-sm',
            )}
            aria-label={isAr ? `${unread} غير مقروء` : `${unread} unread`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('notifications.bell.title', { defaultValue: isAr ? 'الإشعارات' : 'Notifications' })}
          className={cn(
            'absolute end-0 mt-2 z-50 w-[360px] max-w-[calc(100vw-32px)]',
            'rounded-v2-md border border-v2-line bg-v2-surface shadow-lift',
            'overflow-hidden',
          )}
        >
          <div className="flex items-center justify-between border-b border-v2-line px-4 py-3">
            <div className="font-ar text-[14px] font-semibold text-v2-ink">
              {t('notifications.bell.title', { defaultValue: isAr ? 'الإشعارات' : 'Notifications' })}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="font-ar text-[12px] font-medium text-teal-700 hover:underline"
              >
                {t('notifications.bell.markAllRead', { defaultValue: isAr ? 'تعليم الكل كمقروء' : 'Mark all as read' })}
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center font-ar text-[13px] text-v2-mute">
                {isAr ? 'جارٍ التحميل…' : 'Loading…'}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-v2-canvas-2 text-v2-mute">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M10 2c-3.31 0-6 2.69-6 6v3l-1.5 1.5v.5h15v-.5L16 11V8c0-3.31-2.69-6-6-6zM8 16a2 2 0 1 0 4 0H8z" fill="currentColor" />
                  </svg>
                </div>
                <div className="font-ar text-[13px] text-v2-mute">
                  {t('notifications.bell.noUnread', { defaultValue: isAr ? 'لا إشعارات جديدة' : 'No new notifications' })}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-v2-line">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={cn(
                        'block w-full text-start px-4 py-3 cursor-pointer transition-colors duration-150',
                        isUnread(n) ? 'bg-teal-50/40 hover:bg-teal-50/70' : 'hover:bg-v2-canvas-2',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {isUnread(n) && (
                          <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-ar text-[13px] font-semibold text-v2-ink truncate">{titleFor(n)}</div>
                          <div className="mt-0.5 font-ar text-[12px] text-v2-body line-clamp-2">{bodyFor(n)}</div>
                          <div className="mt-1 font-en text-[10px] text-v2-mute">
                            {new Date(n.created_at).toLocaleString(isAr ? 'ar-SA' : 'en-GB', {
                              dateStyle: 'short', timeStyle: 'short',
                            })}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-v2-line bg-v2-canvas-2 px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/v2/notifications'); }}
              className="font-ar text-[12px] font-medium text-teal-700 hover:underline"
            >
              {t('notifications.bell.viewAll', { defaultValue: isAr ? 'عرض الكل' : 'View all' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
