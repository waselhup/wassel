import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';

export interface WeeklyJournalCardProps {
  language: 'ar' | 'en';
}

interface Journal {
  id: string;
  week_start: string;
  observations_ar: string;
  observations_en: string;
  decisions_analyzed: number;
}

export default function WeeklyJournalCard({ language }: WeeklyJournalCardProps) {
  const { t } = useTranslation();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    trpc.warRoom
      .weeklyJournal({})
      .then((res) => {
        if (!cancelled) setJournal((res?.journal as Journal) || null);
      })
      .catch((e) => console.warn('[war-room] journal load failed:', e?.message || e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      await trpc.warRoom.generateWeeklyJournal({ language });
      const res = await trpc.warRoom.weeklyJournal({});
      setJournal((res?.journal as Journal) || null);
    } catch (e: any) {
      console.error('[war-room] generate journal failed:', e?.message || e);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(99, 102, 241, 0.12))',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: 14,
        padding: 14,
        color: '#E2E8F0',
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        direction: language === 'ar' ? 'rtl' : 'ltr',
        textAlign: language === 'ar' ? 'right' : 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6' }} />
        <strong style={{ fontSize: 13, fontWeight: 800 }}>
          {t('warRoom.weeklyJournal', {
            defaultValue: language === 'ar' ? 'يوميات الأسبوع — من فارس' : 'Weekly journal — from Faris',
          })}
        </strong>
      </div>

      {loading && <div style={{ color: '#94A3B8', fontSize: 12 }}>...</div>}

      {!loading && journal && (
        <>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#E2E8F0', whiteSpace: 'pre-wrap' }}>
            {language === 'ar' ? journal.observations_ar : journal.observations_en}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#94A3B8' }}>
            {t('warRoom.basedOn', {
              defaultValue:
                language === 'ar'
                  ? `بناء على ${journal.decisions_analyzed} قرار في أسبوع ${journal.week_start}`
                  : `Based on ${journal.decisions_analyzed} decisions in week ${journal.week_start}`,
            })}
          </div>
        </>
      )}

      {!loading && !journal && (
        <>
          <div style={{ fontSize: 12, color: '#CBD5E1', marginBottom: 10 }}>
            {language === 'ar'
              ? 'لم يكتب فارس تقرير هذا الأسبوع بعد.'
              : 'Faris hasn’t written this week’s report yet.'}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: 'none',
              background: generating
                ? 'rgba(139, 92, 246, 0.3)'
                : 'linear-gradient(135deg, #8B5CF6, #6366F1)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 12,
              cursor: generating ? 'default' : 'pointer',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            }}
          >
            {generating
              ? language === 'ar'
                ? 'جارٍ التحضير...'
                : 'Preparing...'
              : t('warRoom.generateJournalCta', {
                  defaultValue: language === 'ar' ? 'اطلب تقرير الأسبوع من فارس' : 'Request weekly journal from Faris',
                })}
          </button>
        </>
      )}
    </motion.div>
  );
}
