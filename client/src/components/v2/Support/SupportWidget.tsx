import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, LifeBuoy } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

/**
 * SupportWidget — the floating customer-service chat (both visitor + user modes).
 *
 * Flow:
 *   1. Collapsed launcher (small, bottom corner). Never auto-pops.
 *   2. On open → FAQ sequence first (tappable saved questions, zero AI cost).
 *   3. Tap an FAQ → its answer appears inline (source:'faq').
 *   4. Free-text question → support.sendMessage → renders the reply. The server
 *      decides FAQ vs written answer vs handoff and enforces the AI cap; the
 *      client only renders what comes back. On source:'handoff' we show the
 *      warm "a human will follow up" state and stop offering the input.
 *
 * The widget NEVER reveals "AI"/model — written answers are just "رد".
 */

type ChatRole = 'user' | 'assistant';
type ChatSource = 'user' | 'faq' | 'ai' | 'handoff';

interface ChatMessage {
  role: ChatRole;
  source: ChatSource;
  text: string;
}

interface Faq {
  id: string;
  question_ar: string; question_en: string;
  answer_ar: string;   answer_en: string;
  display_order: number;
}

const VISITOR_KEY = 'wassel_support_visitor_id';

function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return 'v_anon';
  }
}

export default function SupportWidget({ mode }: { mode: 'visitor' | 'user' }): ReactElement {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'ar') as 'ar' | 'en';

  const [open, setOpen] = useState(false);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load FAQ list once when first opened.
  useEffect(() => {
    if (!open || faqs.length > 0) return;
    let cancelled = false;
    trpc.support
      .faqList({ audience: mode })
      .then((res) => {
        if (!cancelled) setFaqs(res.faqs ?? []);
      })
      .catch(() => {
        /* non-fatal — the input still works */
      });
    return () => {
      cancelled = true;
    };
  }, [open, faqs.length, mode]);

  // Keep the transcript scrolled to the latest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function ensureConversation(): Promise<string> {
    if (convId) return convId;
    const res = await trpc.support.startConversation(
      mode === 'visitor' ? { visitorId: getVisitorId() } : {},
    );
    setConvId(res.conversationId);
    return res.conversationId;
  }

  // Tapping a saved FAQ shows its answer locally (the server already has the
  // canonical answer; for tapped FAQs we render the stored text directly to
  // avoid a needless round-trip — still zero AI either way).
  function onTapFaq(faq: Faq) {
    const q = lang === 'ar' ? faq.question_ar : faq.question_en;
    const a = lang === 'ar' ? faq.answer_ar : faq.answer_en;
    setMessages((m) => [
      ...m,
      { role: 'user', source: 'user', text: q },
      { role: 'assistant', source: 'faq', text: a },
    ]);
  }

  async function onSend() {
    const text = input.trim();
    if (!text || sending || handedOff) return;
    setErrorKey(null);
    setInput('');
    setMessages((m) => [...m, { role: 'user', source: 'user', text }]);
    setSending(true);
    try {
      const id = await ensureConversation();
      const res = await trpc.support.sendMessage({ conversationId: id, message: text });
      setMessages((m) => [
        ...m,
        { role: 'assistant', source: res.source, text: res.reply },
      ]);
      if (res.source === 'handoff' || res.status === 'awaiting_admin') {
        setHandedOff(true);
      }
    } catch (e) {
      setErrorKey('support.error');
    } finally {
      setSending(false);
    }
  }

  const showFaqIntro = messages.length === 0;

  return (
    <>
      {/* Launcher — small, fixed, bottom corner; respects RTL via start/end. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('support.launcherAria', 'افتح المساعدة')}
          className={cn(
            'fixed bottom-5 z-[80] flex h-12 w-12 items-center justify-center rounded-full',
            'bg-teal-600 text-white shadow-lift transition-transform duration-200 ease-out',
            'hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
            'end-5',
          )}
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          className={cn(
            'fixed bottom-5 end-5 z-[80] flex w-[min(380px,calc(100vw-2.5rem))] flex-col',
            'h-[min(560px,calc(100dvh-2.5rem))] overflow-hidden rounded-v2-lg border border-v2-line',
            'bg-v2-surface shadow-lift font-ar',
          )}
          role="dialog"
          aria-label={t('support.title', 'مساعدة وصل')}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-v2-line bg-v2-canvas px-4 py-3">
            <span className="flex items-center gap-2">
              <LifeBuoy size={18} className="text-teal-700" />
              <span className="text-[15px] font-bold text-v2-ink">{t('support.title', 'مساعدة وصل')}</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('support.close', 'إغلاق')}
              className="flex h-8 w-8 items-center justify-center rounded-v2-sm text-v2-mute hover:bg-v2-canvas-2 hover:text-v2-ink"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {/* Greeting */}
            <div className="rounded-v2-md bg-v2-canvas-2 px-3 py-2.5 text-[13.5px] leading-relaxed text-v2-ink">
              {t('support.greeting', 'مرحباً بك في وصل. كيف يمكننا مساعدتك؟')}
            </div>

            {/* FAQ sequence — shown first, before any conversation. */}
            {showFaqIntro && faqs.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12.5px] font-semibold text-v2-mute">
                  {t('support.commonQuestions', 'أسئلة شائعة')}
                </p>
                {faqs.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onTapFaq(f)}
                    className={cn(
                      'block w-full rounded-v2-md border border-v2-line bg-v2-surface px-3 py-2.5 text-start',
                      'text-[13.5px] text-v2-ink transition-colors hover:bg-v2-canvas-2',
                    )}
                  >
                    {lang === 'ar' ? f.question_ar : f.question_en}
                  </button>
                ))}
              </div>
            )}

            {/* Conversation transcript */}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-v2-md px-3 py-2.5 text-[13.5px] leading-relaxed',
                    m.role === 'user'
                      ? 'bg-teal-600 text-white'
                      : m.source === 'handoff'
                        ? 'border border-amber-300 bg-amber-50 text-amber-900'
                        : 'bg-v2-canvas-2 text-v2-ink',
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-end">
                <div className="rounded-v2-md bg-v2-canvas-2 px-3 py-2.5 text-[13.5px] text-v2-mute">
                  {t('support.typing', 'جارٍ الكتابة…')}
                </div>
              </div>
            )}

            {errorKey && (
              <div className="rounded-v2-md border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                {t('support.error', 'تعذّر إرسال رسالتك. حاول مرة أخرى.')}
              </div>
            )}
          </div>

          {/* Footer / input */}
          <div className="border-t border-v2-line bg-v2-canvas px-3 py-3">
            {handedOff ? (
              <p className="px-1 text-center text-[12.5px] leading-relaxed text-v2-mute">
                {t(
                  'support.handoffNote',
                  'سيتابع أحد أعضاء فريقنا سؤالك ويرد عليك قريباً.',
                )}
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSend();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  rows={1}
                  placeholder={t('support.inputPlaceholder', 'اكتب رسالتك…')}
                  className={cn(
                    'min-h-[40px] max-h-28 flex-1 resize-none rounded-v2-md border border-v2-line bg-v2-surface',
                    'px-3 py-2 text-[13.5px] text-v2-ink placeholder:text-v2-mute',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
                  )}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  aria-label={t('support.send', 'إرسال')}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-v2-md',
                    'bg-teal-600 text-white transition-colors hover:bg-teal-700',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Send size={17} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
