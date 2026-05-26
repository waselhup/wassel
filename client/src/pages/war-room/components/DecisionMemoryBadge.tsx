import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';

export interface DecisionMemoryBadgeProps {
  agentId: string;
  count: number;
  language: 'ar' | 'en';
  accentColor?: string;
}

export default function DecisionMemoryBadge({ agentId, count, language, accentColor }: DecisionMemoryBadgeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<Array<{
    decision_type: string;
    original_proposal: string;
    ali_response: string | null;
    ali_edit: string | null;
    created_at: string;
  }>>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    trpc.warRoom
      .getDecisionMemory({ agentId, limit: 10 })
      .then((res) => setDecisions(res?.decisions || []))
      .catch((e) => {
        console.warn('[war-room] memory fetch failed:', e?.message || e);
      })
      .finally(() => setLoading(false));
  }, [open, agentId]);

  if (count <= 0) return null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'absolute',
          top: -6,
          insetInlineEnd: -6,
          minWidth: 22,
          height: 22,
          padding: '0 6px',
          borderRadius: 999,
          border: 'none',
          background: accentColor || '#14B8A6',
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: 800,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 40,
        }}
        aria-label={t('warRoom.memoryBadgeAria', { defaultValue: language === 'ar' ? `${count} قرار محفوظ` : `${count} stored decisions`, count })}
      >
        <BookOpen size={10} />
        {count}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              direction: language === 'ar' ? 'rtl' : 'ltr',
            }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.94, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 8 }}
              style={{
                width: 'min(560px, 100%)',
                maxHeight: '80vh',
                overflow: 'auto',
                background: '#FFFFFF',
                color: '#0F172A',
                borderRadius: 16,
                padding: '20px 24px',
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {t('warRoom.knows', { defaultValue: language === 'ar' ? 'يعرف' : 'Knows' })} {count}{' '}
                  {t('warRoom.ofYourDecisions', { defaultValue: language === 'ar' ? 'من قراراتك' : 'of your decisions' })}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="close"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                    color: '#475569',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {loading && <div style={{ color: '#64748B', fontSize: 13 }}>...</div>}
              {!loading && decisions.length === 0 && (
                <div style={{ color: '#64748B', fontSize: 13 }}>
                  {language === 'ar' ? 'لم يسجل قراراً بعد.' : 'No decisions recorded yet.'}
                </div>
              )}
              {!loading && decisions.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {decisions.map((d, i) => (
                    <li
                      key={i}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: tagColor(d.decision_type),
                            color: '#FFFFFF',
                            fontWeight: 700,
                            fontSize: 10,
                          }}
                        >
                          {d.decision_type}
                        </span>
                        <span style={{ color: '#94A3B8', fontSize: 10 }}>
                          {new Date(d.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: '#64748B' }}>
                          {language === 'ar' ? 'الاقتراح: ' : 'Proposal: '}
                        </span>
                        {d.original_proposal.slice(0, 200)}{d.original_proposal.length > 200 ? '…' : ''}
                      </div>
                      {(d.ali_edit || d.ali_response) && (
                        <div>
                          <span style={{ color: '#64748B' }}>
                            {language === 'ar' ? 'علي: ' : 'Ali: '}
                          </span>
                          {(d.ali_edit || d.ali_response || '').slice(0, 200)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function tagColor(t: string): string {
  switch (t) {
    case 'approve':
    case 'approve_with_changes':
      return '#16A34A';
    case 'reject':
      return '#DC2626';
    case 'edit':
      return '#F59E0B';
    case 'ask_question':
      return '#0EA5E9';
    case 'defer':
      return '#64748B';
    default:
      return '#475569';
  }
}
