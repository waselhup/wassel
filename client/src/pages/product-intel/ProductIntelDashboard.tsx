import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Microscope, AlertTriangle, FileText, MessageSquare } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: '1px solid var(--border-subtle, #E5E7EB)',
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink, #0F172A)',
  margin: 0, display: 'flex', alignItems: 'center', gap: 8,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#DC2626', high: '#EF4444', medium: '#F59E0B', low: '#06B6D4',
};

export default function ProductIntelDashboard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [patterns, setPatterns] = useState<any[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [voice, setVoice] = useState<any[]>([]);

  const refresh = async () => {
    const [p, w] = await Promise.all([
      trpc.fatima.listFrictionPatterns(),
      trpc.fatima.latestWeeklyReport(),
    ]);
    setPatterns(p); setWeeklyReport(w);
  };

  useEffect(() => { refresh(); }, []);

  const action = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      const result = await fn();
      if (label === 'voice') setVoice(result?.themes || []);
      await refresh();
    } finally { setBusy(null); }
  };

  return (
    <div className="admin-portal-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...CARD, background: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EC4899', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(236,72,153,0.3)' }}>
            <Microscope size={28} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ ...SECTION_TITLE, fontSize: 22 }}>{tr('فاطمة', 'Fatima')}</h2>
            <div style={{ fontSize: 13, color: '#831843', marginTop: 4 }}>
              {tr('ذكاء المنتج — تكتشف، تقترح، لا تنفّذ', 'Product intelligence — observes, suggests, never executes')}
            </div>
            <div style={{ display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 700, color: '#EC4899', background: '#fff', padding: '3px 10px', borderRadius: 999 }}>
              {tr('وضع: اقتراح فقط', 'suggest-only mode')}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <button onClick={() => action('detect', () => trpc.fatima.detectFrictionPatterns({ lookbackDays: 7 }))} disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={20} color="#EC4899" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('فحص الاحتكاكات', 'Detect friction')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'detect' ? '...' : tr('آخر 7 أيام', 'Last 7 days')}</div>
          </div>
        </button>
        <button onClick={() => action('weekly', () => trpc.fatima.generateWeeklyReport())} disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={20} color="#EC4899" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('توليد التقرير الأسبوعي', 'Generate weekly report')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'weekly' ? '...' : tr('AR + EN', 'AR + EN')}</div>
          </div>
        </button>
        <button onClick={() => action('voice', () => trpc.fatima.digestUserVoice())} disabled={busy !== null}
          style={{ ...CARD, cursor: 'pointer', textAlign: isAr ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <MessageSquare size={20} color="#EC4899" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('صوت المستخدم', 'Digest user voice')}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{busy === 'voice' ? '...' : tr('تجميع المواضيع', 'Cluster themes')}</div>
          </div>
        </button>
      </div>

      {/* Weekly report */}
      {weeklyReport && (
        <div style={CARD}>
          <h3 style={SECTION_TITLE}>{tr('التقرير الأسبوعي', 'Weekly Report')}</h3>
          <div style={{ marginTop: 12, fontSize: 13, color: '#1F2937', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {isAr ? weeklyReport.summary_ar : weeklyReport.summary_en}
          </div>
          {Array.isArray(weeklyReport.recommendations) && weeklyReport.recommendations.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#EC4899', marginBottom: 6 }}>{tr('توصيات', 'Recommendations')}</div>
              <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13 }}>
                {weeklyReport.recommendations.map((r: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Friction patterns */}
      <div style={CARD}>
        <h3 style={SECTION_TITLE}>{tr('أنماط الاحتكاك', 'Friction Patterns')}</h3>
        <div style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
          {patterns.length === 0 ? <div style={{ color: '#9CA3AF', padding: 8 }}>{tr('لا توجد أنماط', 'No patterns yet')}</div> :
            patterns.map((p) => (
              <div key={p.id} style={{ padding: 12, borderTop: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: (SEVERITY_COLORS[p.severity] || '#9CA3AF') + '22', color: SEVERITY_COLORS[p.severity] || '#9CA3AF', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{p.severity}</span>
                  <span style={{ fontWeight: 700 }}>{p.feature}{p.step ? ` · ${p.step}` : ''}</span>
                </div>
                <div style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>{isAr ? p.description_ar : p.description_en}</div>
                {(isAr ? p.fatima_recommendation_ar : p.fatima_recommendation_en) && (
                  <div style={{ fontSize: 12, color: '#EC4899', marginTop: 4 }}>💡 {isAr ? p.fatima_recommendation_ar : p.fatima_recommendation_en}</div>
                )}
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{p.affected_users} {tr('مستخدم متأثر', 'affected')} · {p.status}</div>
              </div>
            ))}
        </div>
      </div>

      {/* User voice */}
      {voice.length > 0 && (
        <div style={CARD}>
          <h3 style={SECTION_TITLE}>{tr('مواضيع صوت المستخدم', 'User Voice Themes')}</h3>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {voice.map((t: any, i: number) => (
              <div key={i} style={{ padding: 12, background: '#FDF2F8', borderRadius: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{isAr ? t.theme_ar : t.theme_en}</div>
                <div style={{ fontSize: 11, color: '#831843', marginTop: 4 }}>{t.count} {tr('رسالة', 'msgs')}</div>
                {t.sample_quote && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>"{t.sample_quote}"</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
