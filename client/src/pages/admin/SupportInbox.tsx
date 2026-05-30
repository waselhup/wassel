import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Inbox, RefreshCw, User as UserIcon, Globe, AlertCircle, CheckCircle2,
  MessageSquare, ShieldCheck, Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

/**
 * SupportInbox — admin-only customer-service inbox (Part 2).
 *
 * Lists support conversations (support.admin.listConversations), opens a full
 * transcript (support.admin.getConversation), and toggles the per-conversation
 * extended-cap flag (support.admin.setAllowExtended). awaiting_admin (handoff)
 * conversations are surfaced first and badged — these are the notifications.
 *
 * Admin-only is enforced SERVER-SIDE: every endpoint here runs under the
 * support router's adminProcedure (is_admin → FORBIDDEN). A non-admin who
 * reaches this component sees an error/empty state, never data.
 */

type Status = 'active' | 'awaiting_admin' | 'closed';
type Mode = 'visitor' | 'user';

interface ConvRow {
  id: string;
  mode: Mode;
  user_id: string | null;
  status: Status;
  ai_reply_count: number;
  allow_extended: boolean;
  last_message_at: string;
  created_at: string;
}

interface MsgRow {
  id: string;
  role: 'user' | 'assistant' | 'admin';
  source: 'user' | 'faq' | 'ai' | 'handoff' | 'admin';
  content: string;
  faq_id: string | null;
  created_at: string;
}

const STATUS_FILTERS: Array<{ key: Status | 'all'; labelKey: string; fallback: string }> = [
  { key: 'awaiting_admin', labelKey: 'support.admin.filterAwaiting', fallback: 'بانتظار الرد' },
  { key: 'active', labelKey: 'support.admin.filterActive', fallback: 'نشطة' },
  { key: 'closed', labelKey: 'support.admin.filterClosed', fallback: 'مغلقة' },
  { key: 'all', labelKey: 'support.admin.filterAll', fallback: 'الكل' },
];

function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  const map: Record<Status, { cls: string; label: string; Icon: typeof AlertCircle }> = {
    awaiting_admin: {
      cls: 'border-amber-300 bg-amber-50 text-amber-800',
      label: t('support.admin.statusAwaiting', 'بانتظار الرد'),
      Icon: AlertCircle,
    },
    active: {
      cls: 'border-teal-200 bg-teal-50 text-teal-800',
      label: t('support.admin.statusActive', 'نشطة'),
      Icon: MessageSquare,
    },
    closed: {
      cls: 'border-v2-line bg-v2-canvas-2 text-v2-mute',
      label: t('support.admin.statusClosed', 'مغلقة'),
      Icon: CheckCircle2,
    },
  };
  const { cls, label, Icon } = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold', cls)}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function fmtTime(iso: string, lang: 'ar' | 'en'): string {
  try {
    // Western digits regardless of locale (per product rule).
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function SupportInbox() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'ar') as 'ar' | 'en';

  const [filter, setFilter] = useState<Status | 'all'>('awaiting_admin');
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conv, setConv] = useState<ConvRow | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [togglingExtended, setTogglingExtended] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await trpc.support.admin.listConversations(
        filter === 'all' ? {} : { status: filter },
      );
      setConvs(res.conversations as ConvRow[]);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'error');
    } finally {
      setLoadingList(false);
    }
  }, [filter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function openConversation(id: string) {
    setSelectedId(id);
    setLoadingThread(true);
    try {
      const res = await trpc.support.admin.getConversation({ conversationId: id });
      setConv(res.conversation as ConvRow);
      setMessages(res.messages as MsgRow[]);
    } catch {
      setConv(null);
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }

  async function toggleExtended() {
    if (!conv) return;
    setTogglingExtended(true);
    try {
      const res = await trpc.support.admin.setAllowExtended({
        conversationId: conv.id,
        allow: !conv.allow_extended,
      });
      setConv((c) => (c ? { ...c, allow_extended: res.allowExtended } : c));
      setConvs((list) =>
        list.map((c) => (c.id === conv.id ? { ...c, allow_extended: res.allowExtended } : c)),
      );
    } catch {
      /* surface nothing destructive; admin can retry */
    } finally {
      setTogglingExtended(false);
    }
  }

  return (
    <div className="font-ar">
      {/* Header + filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-[20px] font-bold text-v2-ink">
          <Inbox size={20} className="text-teal-700" />
          {t('support.admin.title', 'محادثات الدعم')}
        </h1>
        <button
          type="button"
          onClick={loadList}
          className="inline-flex items-center gap-1.5 rounded-v2-md border border-v2-line bg-v2-surface px-3 py-2 text-[13px] font-semibold text-v2-ink hover:bg-v2-canvas-2"
        >
          <RefreshCw size={15} />
          {t('support.admin.refresh', 'تحديث')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              filter === f.key
                ? 'bg-teal-600 text-white'
                : 'border border-v2-line bg-v2-surface text-v2-ink hover:bg-v2-canvas-2',
            )}
          >
            {t(f.labelKey, f.fallback)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* List pane */}
        <div className="rounded-v2-lg border border-v2-line bg-v2-surface">
          {loadingList ? (
            <div className="flex items-center justify-center py-16 text-v2-mute">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : listError ? (
            <div className="px-4 py-10 text-center text-[13px] text-red-600">
              {t('support.admin.listError', 'تعذّر تحميل المحادثات.')}
            </div>
          ) : convs.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-v2-mute">
              {t('support.admin.empty', 'لا توجد محادثات في هذا التصنيف.')}
            </div>
          ) : (
            <ul className="divide-y divide-v2-line">
              {convs.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      'flex w-full flex-col gap-1.5 px-4 py-3 text-start transition-colors',
                      selectedId === c.id ? 'bg-teal-50' : 'hover:bg-v2-canvas-2',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-v2-ink">
                        {c.mode === 'visitor' ? <Globe size={14} /> : <UserIcon size={14} />}
                        {c.mode === 'visitor'
                          ? t('support.admin.visitor', 'زائر')
                          : t('support.admin.user', 'مستخدم')}
                      </span>
                      <StatusBadge status={c.status} />
                    </span>
                    <span className="flex items-center justify-between text-[11.5px] text-v2-mute">
                      <span>
                        {t('support.admin.replies', 'ردود آلية')}: {c.ai_reply_count}
                        {c.allow_extended ? ' · ' + t('support.admin.extendedShort', 'موسّع') : ''}
                      </span>
                      <span>{fmtTime(c.last_message_at, lang)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Transcript pane */}
        <div className="rounded-v2-lg border border-v2-line bg-v2-surface">
          {!selectedId ? (
            <div className="flex h-full min-h-[300px] items-center justify-center px-6 text-center text-[13px] text-v2-mute">
              {t('support.admin.selectPrompt', 'اختر محادثة لعرض تفاصيلها.')}
            </div>
          ) : loadingThread ? (
            <div className="flex items-center justify-center py-16 text-v2-mute">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : conv ? (
            <div className="flex flex-col">
              {/* Thread header + extended toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-v2-line px-4 py-3">
                <span className="flex items-center gap-2">
                  {conv.mode === 'visitor' ? <Globe size={16} /> : <UserIcon size={16} />}
                  <span className="text-[14px] font-bold text-v2-ink">
                    {conv.mode === 'visitor'
                      ? t('support.admin.visitor', 'زائر')
                      : t('support.admin.user', 'مستخدم')}
                  </span>
                  <StatusBadge status={conv.status} />
                </span>

                {/* Allow-extended toggle — only meaningful for logged-in users
                    (visitors are always capped at 5), so disable for visitors. */}
                <button
                  type="button"
                  onClick={toggleExtended}
                  disabled={togglingExtended || conv.mode === 'visitor'}
                  title={
                    conv.mode === 'visitor'
                      ? t('support.admin.extendedVisitorHint', 'المحادثات الموسّعة للمستخدمين المسجّلين فقط')
                      : undefined
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-v2-md px-3 py-2 text-[12.5px] font-semibold transition-colors',
                    conv.allow_extended
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'border border-v2-line bg-v2-surface text-v2-ink hover:bg-v2-canvas-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {togglingExtended ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {conv.allow_extended
                    ? t('support.admin.extendedOn', 'محادثة موسّعة: مفعّلة')
                    : t('support.admin.extendedOff', 'تفعيل المحادثة الموسّعة')}
                </button>
              </div>

              {/* Meta line */}
              <div className="border-b border-v2-line px-4 py-2 text-[11.5px] text-v2-mute">
                {t('support.admin.replies', 'ردود آلية')}: {conv.ai_reply_count}
                {' · '}
                {t('support.admin.started', 'بدأت')}: {fmtTime(conv.created_at, lang)}
              </div>

              {/* Transcript */}
              <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex flex-col gap-1', m.role === 'user' ? 'items-start' : 'items-end')}
                  >
                    <span
                      className={cn(
                        'max-w-[85%] rounded-v2-md px-3 py-2.5 text-[13px] leading-relaxed',
                        m.role === 'user'
                          ? 'bg-v2-canvas-2 text-v2-ink'
                          : m.source === 'handoff'
                            ? 'border border-amber-300 bg-amber-50 text-amber-900'
                            : m.source === 'admin'
                              ? 'bg-teal-600 text-white'
                              : 'bg-teal-50 text-v2-ink',
                      )}
                    >
                      {m.content}
                    </span>
                    <span className="px-1 text-[10.5px] text-v2-mute">
                      {t(`support.admin.source.${m.source}`, m.source)} · {fmtTime(m.created_at, lang)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-[13px] text-red-600">
              {t('support.admin.threadError', 'تعذّر تحميل المحادثة.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
