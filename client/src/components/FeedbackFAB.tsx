import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function FeedbackFAB() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: 'bug' as 'bug' | 'feature' | 'question' | 'other',
    subject: '',
    description: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  const categories = [
    { value: 'bug', label: isAr ? 'خطأ تقني' : 'Bug' },
    { value: 'feature', label: isAr ? 'اقتراح ميزة' : 'Feature' },
    { value: 'question', label: isAr ? 'سؤال' : 'Question' },
    { value: 'other', label: isAr ? 'أخرى' : 'Other' },
  ];

  const priorities = [
    { value: 'low', label: isAr ? 'منخفض' : 'Low' },
    { value: 'normal', label: isAr ? 'عادي' : 'Normal' },
    { value: 'high', label: isAr ? 'مرتفع' : 'High' },
    { value: 'urgent', label: isAr ? 'عاجل' : 'Urgent' },
  ];

  async function submit() {
    if (!form.subject.trim() || !form.description.trim()) {
      setError(isAr ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await trpc.feedback.submit({
        category: form.category,
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        pageUrl: window.location.pathname,
      });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setForm({ category: 'bug', subject: '', description: '', priority: 'normal' }); }, 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FAB Button */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 90,
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #0A8F84, #064E49)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(10,143,132,0.35)',
          color: '#fff',
        }}
      >
        <MessageSquarePlus size={24} />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => !loading && setOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            >
              {done ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <CheckCircle2 size={48} style={{ color: '#059669', margin: '0 auto 12px' }} />
                  <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, color: '#065F46' }}>
                    {isAr ? 'تم إرسال ملاحظتك بنجاح!' : 'Feedback submitted!'}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 20, color: 'var(--wsl-ink)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                      <MessageSquarePlus size={20} style={{ color: '#0A8F84' }} />
                      {isAr ? 'إرسال ملاحظة' : 'Send Feedback'}
                    </h3>
                    <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
                      <X size={20} style={{ color: '#9CA3AF' }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#6B7280', marginBottom: 4, fontFamily: 'Cairo, sans-serif' }}>
                        {isAr ? 'النوع' : 'Category'}
                      </label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {categories.map(c => (
                          <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value as any }))}
                            style={{ padding: '6px 14px', borderRadius: 8, border: form.category === c.value ? '1.5px solid #0A8F84' : '1.5px solid #E5E7EB', background: form.category === c.value ? 'rgba(10,143,132,0.07)' : '#fff', color: form.category === c.value ? '#0A8F84' : '#6B7280', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#6B7280', marginBottom: 4, fontFamily: 'Cairo, sans-serif' }}>
                        {isAr ? 'الموضوع' : 'Subject'}
                      </label>
                      <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder={isAr ? 'وصف مختصر للملاحظة...' : 'Brief description...'}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 14, fontFamily: 'Cairo, Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#6B7280', marginBottom: 4, fontFamily: 'Cairo, sans-serif' }}>
                        {isAr ? 'التفاصيل' : 'Details'}
                      </label>
                      <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder={isAr ? 'اشرح المشكلة أو الاقتراح بالتفصيل...' : 'Describe the issue or suggestion in detail...'}
                        rows={4}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 14, fontFamily: 'Cairo, Inter, sans-serif', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#6B7280', marginBottom: 4, fontFamily: 'Cairo, sans-serif' }}>
                        {isAr ? 'الأولوية' : 'Priority'}
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {priorities.map(p => (
                          <button key={p.value} onClick={() => setForm(f => ({ ...f, priority: p.value as any }))}
                            style={{ padding: '6px 12px', borderRadius: 8, border: form.priority === p.value ? '1.5px solid #0A8F84' : '1.5px solid #E5E7EB', background: form.priority === p.value ? 'rgba(10,143,132,0.07)' : '#fff', color: form.priority === p.value ? '#0A8F84' : '#6B7280', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13, fontFamily: 'Cairo, sans-serif' }}>
                        {error}
                      </div>
                    )}

                    <button onClick={submit} disabled={loading}
                      style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: '#0A8F84', color: '#fff', fontWeight: 900, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Cairo, sans-serif' }}>
                      {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                      {loading ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال الملاحظة' : 'Submit Feedback')}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
