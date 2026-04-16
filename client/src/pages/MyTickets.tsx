import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TicketCheck, Clock, CheckCircle2, AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';

const statusColors: Record<string, { bg: string; text: string; label_ar: string; label_en: string }> = {
  open: { bg: '#FEF3C7', text: '#92400E', label_ar: 'مفتوحة', label_en: 'Open' },
  in_progress: { bg: '#DBEAFE', text: '#1E40AF', label_ar: 'قيد المعالجة', label_en: 'In Progress' },
  resolved: { bg: '#D1FAE5', text: '#065F46', label_ar: 'تم الحل', label_en: 'Resolved' },
  closed: { bg: '#F3F4F6', text: '#6B7280', label_ar: 'مغلقة', label_en: 'Closed' },
};

const categoryLabels: Record<string, { ar: string; en: string }> = {
  bug: { ar: 'خطأ تقني', en: 'Bug' },
  feature: { ar: 'اقتراح ميزة', en: 'Feature' },
  question: { ar: 'سؤال', en: 'Question' },
  other: { ar: 'أخرى', en: 'Other' },
};

export default function MyTickets() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trpc.feedback.myTickets().then(setTickets).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout pageTitle={isAr ? 'ملاحظاتي' : 'My Tickets'}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 4px' }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 28, color: 'var(--wsl-ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #0A8F84, #064E49)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TicketCheck size={20} color="#fff" />
            </div>
            {isAr ? 'ملاحظاتي وتذاكري' : 'My Feedback & Tickets'}
          </h1>
          <p style={{ color: 'var(--wsl-ink-3)', fontSize: 14, fontFamily: 'Cairo, sans-serif', marginTop: 4 }}>
            {isAr ? 'تتبع حالة ملاحظاتك وردود الفريق' : 'Track your feedback status and team responses'}
          </p>
        </motion.div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Loader2 size={32} style={{ color: '#0A8F84', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, border: '2px dashed var(--wsl-border)', padding: '60px 24px', textAlign: 'center' }}>
            <MessageSquare size={40} style={{ color: '#9CA3AF', margin: '0 auto 12px' }} />
            <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, color: 'var(--wsl-ink-3)' }}>
              {isAr ? 'لم ترسل أي ملاحظات بعد' : 'No feedback submitted yet'}
            </div>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, fontFamily: 'Cairo, sans-serif' }}>
              {isAr ? 'اضغط على زر الملاحظات في أسفل الصفحة لإرسال أول ملاحظة' : 'Click the feedback button at the bottom to send your first feedback'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tickets.map((t, i) => {
              const st = statusColors[t.status] || statusColors.open;
              const cat = categoryLabels[t.category] || categoryLabels.other;
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--wsl-border)', padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '2px 10px', borderRadius: 999, background: st.bg, color: st.text, fontSize: 11, fontWeight: 900, fontFamily: 'Cairo, sans-serif' }}>
                        {isAr ? st.label_ar : st.label_en}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#6B7280', fontSize: 10, fontWeight: 800, fontFamily: 'Cairo, sans-serif' }}>
                        {isAr ? cat.ar : cat.en}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--wsl-ink-4)', fontFamily: 'Inter' }}>
                      {new Date(t.created_at).toLocaleDateString(isAr ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, color: 'var(--wsl-ink)', marginBottom: 6 }}>{t.subject}</h3>
                  <p style={{ fontSize: 14, color: 'var(--wsl-ink-2)', lineHeight: 1.7, fontFamily: 'Cairo, Inter, sans-serif' }}>{t.description}</p>
                  {t.admin_response && (
                    <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: '#F0FDF9', border: '1px solid #A7F3D0' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#065F46', marginBottom: 4, fontFamily: 'Cairo, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} /> {isAr ? 'رد الفريق' : 'Team Response'}
                      </div>
                      <p style={{ fontSize: 13, color: '#065F46', fontFamily: 'Cairo, Inter, sans-serif', lineHeight: 1.6 }}>{t.admin_response}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </DashboardLayout>
  );
}
