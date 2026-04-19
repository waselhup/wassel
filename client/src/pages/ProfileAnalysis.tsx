import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Link as LinkIcon, AlertCircle, Check, X, CheckCircle,
  Upload, FileDown, RotateCcw, MessageCircle, Award, BookOpen, Mail, Zap,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { trpcMutation } from '../lib/trpc';
import { supabase } from '../lib/supabase';
import { generateAnalysisPDF } from '../lib/pdf-generator';

// ─── Types (loose: backend produces a superset, we read what's there) ──
interface Dimension { score: number; verdict?: string; finding?: string; benchmark?: string }
interface AcademicInsight { framework?: string; source?: string; category?: string; finding: string; application: string }
interface ActionStep { week: number; title?: string; description?: string; action?: string; framework?: string; research_basis?: string }
interface QuickWin { action: string; why: string; effort: '5min' | '15min' | '30min' | '1h' | string; priority: 'high' | 'medium' | 'low' | string; example?: string }
interface VisionPillar { status?: string; note?: string }
interface AnalysisResult {
  score?: number;
  overall_score?: number;
  tier?: 'weak' | 'fair' | 'good' | 'excellent';
  headline_verdict?: string;
  dimensions?: Record<string, Dimension>;
  scoreBreakdown?: Record<string, number>;
  academic_insights?: AcademicInsight[];
  vision_2030_alignment?: {
    pillar?: string;
    opportunity?: string;
    hcdp_match?: string;
    thriving_economy?: VisionPillar;
    vibrant_society?: VisionPillar;
    ambitious_nation?: VisionPillar;
  };
  before_after?: {
    headline?: { before?: string; after?: string; current?: string; improved?: string; rationale?: string };
    summary?: { before?: string; after?: string; current?: string; improved?: string; rationale?: string };
    summary_opening?: { before?: string; after?: string };
  };
  action_plan?: ActionStep[];
  quick_wins?: QuickWin[];
  upgradePlan?: { headline?: { before: string; after: string }; about?: { before: string; after: string }; experience?: { before: string; after: string } };
  completeness_warning?: string | null;
  _meta?: { completeness?: number; missing_sections?: string[]; detected_language?: 'ar' | 'en'; actor?: string };
  error?: string;
}

// ─── Toast ─────────────────────────────────────────────────────────────
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string }
function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = (type: ToastItem['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  const View = () => (
    <div style={{ position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              padding: '12px 18px', borderRadius: 12, minWidth: 260,
              background: t.type === 'success' ? '#ECFDF5' : t.type === 'error' ? '#FEF2F2' : '#EFF6FF',
              color: t.type === 'success' ? '#065F46' : t.type === 'error' ? '#991B1B' : '#1E40AF',
              border: `1px solid ${t.type === 'success' ? '#A7F3D0' : t.type === 'error' ? '#FECACA' : '#BFDBFE'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            {t.type === 'success' ? <Check size={16} /> : t.type === 'error' ? <X size={16} /> : <AlertCircle size={16} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

// ─── Constants ───────────────────────────────────────────────────────
const DIMENSIONS = ['headline', 'summary', 'experience', 'skills', 'education', 'recommendations', 'activity', 'media'] as const;

const TIER_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  weak: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  fair: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  good: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  excellent: { bg: '#CCFBF1', color: '#0F766E', border: '#5EEAD4' },
};

function gradientFor(score: number | null): string {
  if (score == null) return 'linear-gradient(90deg, #CBD5E1, #94A3B8)';
  if (score >= 75) return 'linear-gradient(90deg, #0A8F84, #12B5A8)';
  if (score >= 50) return 'linear-gradient(90deg, #C9922A, #F59E0B)';
  return 'linear-gradient(90deg, #DC2626, #F43F5E)';
}
function colorFor(score: number | null): string {
  if (score == null) return '#94A3B8';
  if (score >= 75) return '#0F766E';
  if (score >= 50) return '#92400E';
  return '#991B1B';
}

// ─── Score Ring ──────────────────────────────────────────────────────
function ScoreRing({ score, label }: { score: number; label: string }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    let frame: number; let start: number;
    const dur = 1200;
    function step(ts: number) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setAnim(Math.round(p * score));
      if (p < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  const r = 60; const c = 2 * Math.PI * r;
  const dash = (anim / 100) * c;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={70} cy={70} r={r} fill="none" stroke="#E2E8F0" strokeWidth={10} />
      <circle cx={70} cy={70} r={r} fill="none" stroke="url(#heroGrad)" strokeWidth={10}
        strokeLinecap="round" strokeDasharray={`${dash} ${c}`} transform="rotate(-90 70 70)" />
      <defs>
        <linearGradient id="heroGrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#0A8F84" />
          <stop offset="100%" stopColor="#C9922A" />
        </linearGradient>
      </defs>
      <text x="70" y="76" textAnchor="middle" fontSize="36" fontWeight="700" fill="#0F172A" style={{ direction: 'ltr', fontFamily: 'Inter' } as any}>{anim}</text>
      <text x="70" y="96" textAnchor="middle" fontSize="11" fill="#64748B" style={{ fontFamily: 'Cairo' } as any}>{label}</text>
    </svg>
  );
}

// ─── Main ────────────────────────────────────────────────────────────
export default function ProfileAnalysis() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const [url, setUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [mediaType, setMediaType] = useState('image/png');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const STAGES = useMemo(() => isRTL ? [
    'نقرأ بروفايلك بعمق من LinkedIn...',
    'نستخرج كل قسم بدقة — الخبرات، المهارات، التعليم، النشاط...',
    '💡 نحلّل بذكاء عميق — ركّز معنا في النتيجة',
    'نطبّق 15 إطاراً أكاديمياً من Harvard و LBS و McKinsey...',
    'نقيس 8 أبعاد مهنية بمعايير السوق السعودي والخليجي...',
    '🎯 خذ ما يعجبك من التعديلات، واترك ما لا يعجبك — أنت صاحب القرار',
    'نربط نقاط قوتك وضعفك بركائز رؤية 2030...',
    'نصوغ تعديلات فورية قابلة للتنفيذ خلال دقائق...',
    'نضع اللمسات الأخيرة على تقريرك...',
  ] : [
    'Reading your profile deeply from LinkedIn...',
    'Extracting each section — Experience, Skills, Education, Activity...',
    '💡 Deep AI analysis in progress — focus on the results',
    'Applying 15 academic frameworks from Harvard, LBS, McKinsey...',
    'Measuring 8 professional dimensions by Saudi/GCC market standards...',
    "🎯 Take what you like, leave what you don't — you're the decision maker",
    'Aligning your strengths with Vision 2030 pillars...',
    'Crafting immediate actionable changes (minutes, not weeks)...',
    'Finalizing your report...',
  ], [isRTL]);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadingStage(i => (i + 1) % STAGES.length), 4000);
    return () => clearInterval(id);
  }, [loading, STAGES.length]);

  useEffect(() => {
    if ((profile as any)?.linkedin_url && !url) setUrl((profile as any).linkedin_url);
  }, [profile]);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.push('error', isRTL ? 'الملف يجب أن يكون صورة' : 'File must be an image'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.push('error', isRTL ? 'الصورة كبيرة جداً (10 ميجا حد أقصى)' : 'Image too large (max 10MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = 1920;
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setImagePreview(dataUrl); setImageBase64(dataUrl.split(',')[1]); setMediaType(file.type);
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let q = 0.8;
        let c = canvas.toDataURL('image/jpeg', q);
        const target = 3 * 1024 * 1024 * 1.37;
        while (c.length > target && q > 0.3) { q -= 0.1; c = canvas.toDataURL('image/jpeg', q); }
        setImagePreview(c); setImageBase64(c.split(',')[1]); setMediaType('image/jpeg');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!url.trim() && !imageBase64) return;
    if (url && !url.match(/linkedin\.com\/in\//i)) {
      toast.push('error', t('analyzer.invalidUrl'));
      return;
    }
    setLoading(true); setLoadingStage(0); setResult(null);
    try {
      const timeoutMs = 180000;
      const callPromise = trpcMutation('linkedin.analyzeDeep', {
        linkedinUrl: url || undefined,
        imageBase64: imageBase64 || undefined,
        mediaType,
      });
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs));
      const res = await Promise.race([callPromise, timeoutPromise]);
      const r: any = res;
      const analysis = r?.score !== undefined || r?.overall_score !== undefined ? r
        : r?.data || r?.result?.data || r?.result || r;
      if (!analysis || analysis.error) {
        toast.push('error', analysis?.error || t('analyzer.error'));
      } else {
        setResult(analysis as AnalysisResult);
        toast.push('success', t('analyzer.success'));
      }
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg === 'TIMEOUT') toast.push('error', t('analyzer.timeout'));
      else if (msg.includes('429') || msg.toLowerCase().includes('rate')) toast.push('error', t('analyzer.rateLimit'));
      else toast.push('error', msg || t('analyzer.error'));
    }
    setLoading(false);
  }

  const [pdfBusy, setPdfBusy] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  // Pre-fill email from auth user
  useEffect(() => {
    const u: any = (profile as any) || {};
    if (!emailAddress && u?.email) setEmailAddress(u.email);
  }, [profile]);

  async function handleExportPDF() {
    if (!result) return;
    setPdfBusy(true);
    try {
      await generateAnalysisPDF({
        result,
        profile: (result as any)._profile,
        linkedinUrl: url,
        language: i18n.language === 'en' ? 'en' : 'ar',
      });
      toast.push('success', t('analyzer.pdfSuccess'));
    } catch (err: any) {
      console.error('PDF export failed:', err);
      toast.push('error', t('analyzer.pdfError'));
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleSendEmail() {
    if (!emailAddress.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.push('error', t('analyzer.invalidEmail'));
      return;
    }
    if (!result) return;
    setEmailBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess?.session?.access_token;
      const res = await fetch('/api/analyzer/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({
          recipientEmail: emailAddress,
          language: i18n.language,
          result,
          linkedinUrl: url,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || 'send failed');
      toast.push('success', t('analyzer.emailSuccess'));
      setShowEmailModal(false);
    } catch (err: any) {
      console.error('Email send failed:', err);
      toast.push('error', t('analyzer.emailError'));
    } finally {
      setEmailBusy(false);
    }
  }

  function handleReset() {
    setResult(null); setUrl(''); setImageBase64(''); setImagePreview('');
  }

  // Normalized helpers
  const overallScore = result?.overall_score ?? result?.score ?? 0;
  const tier = result?.tier || (overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : overallScore >= 40 ? 'fair' : 'weak');
  const tierStyle = TIER_STYLES[tier];
  const headlineVerdict = result?.headline_verdict || (result?.dimensions?.headline?.finding) || '';

  function dimScore(name: string): { score: number | null; verdict?: string } {
    const d: any = result?.dimensions?.[name];
    if (d) {
      // honor explicit null + data_found:false → no data
      if (d.score === null || d.data_found === false) return { score: null, verdict: d.verdict || d.finding };
      return { score: typeof d.score === 'number' ? d.score : 0, verdict: d.verdict || d.finding };
    }
    // fallback to scoreBreakdown (different scale 0-15/20)
    const breakdownMax: Record<string, number> = { headline: 15, about: 15, summary: 15, experience: 20, skills: 10, education: 10, photo: 10, recommendations: 10, activity: 10, media: 10, certifications: 10 };
    const altKey = name === 'summary' ? 'about' : name === 'media' ? 'photo' : name === 'recommendations' ? 'connections' : name === 'activity' ? 'connections' : name;
    const raw = result?.scoreBreakdown?.[altKey] ?? 0;
    const max = breakdownMax[altKey] || 10;
    return { score: Math.round((raw / max) * 100) };
  }

  const insights = (result?.academic_insights || []).slice(0, 3).map(i => ({
    framework: i.framework || i.source || 'Framework',
    category: i.category,
    finding: i.finding,
    application: i.application,
  }));

  const ba: any = result?.before_after?.headline;
  const baKept = ba?.kept_as_is === true;
  const baBefore = ba?.before || ba?.current;
  const baAfter = ba?.after || ba?.improved;
  const baReason = ba?.reason || ba?.rationale;
  const baLang: 'ar' | 'en' = ba?.language === 'en' ? 'en' : 'ar';

  const quickWins: QuickWin[] = (result?.quick_wins || []).slice(0, 6) as QuickWin[];

  function effortMinutes(e: string): number {
    if (e === '5min') return 5;
    if (e === '15min') return 15;
    if (e === '30min') return 30;
    if (e === '1h') return 60;
    return 15;
  }
  function totalQuickWinTime(): string {
    const m = quickWins.reduce((s, w) => s + effortMinutes(w.effort), 0);
    if (m < 60) return isRTL ? `${m} دقيقة` : `${m} min`;
    return isRTL ? `${Math.round(m / 60)} ساعة` : `${Math.round(m / 60)}h`;
  }

  const v2030 = result?.vision_2030_alignment;
  const v2030Pillars: Array<['thriving_economy' | 'vibrant_society' | 'ambitious_nation', VisionPillar | undefined]> = [
    ['thriving_economy', v2030?.thriving_economy],
    ['vibrant_society', v2030?.vibrant_society],
    ['ambitious_nation', v2030?.ambitious_nation],
  ];

  const hasResult = !!result && !result.error;

  return (
    <DashboardLayout pageTitle={t('analyzer.title')}>
      <toast.View />
      <div className="max-w-5xl mx-auto px-1 pb-12 space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* Print styles */}
        <style>{`@media print {
          @page { size: A4; margin: 16mm; }
          body { background: white !important; }
          aside, nav, header, button, .no-print { display: none !important; }
          .print-content { box-shadow: none !important; border: 1px solid #E2E8F0 !important; break-inside: avoid; }
        }`}</style>

        {/* Header — hidden after analysis to maximize report space */}
        {!hasResult && !loading && (
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 28, color: 'var(--wsl-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                {t('analyzer.title')}
              </h1>
              <p style={{ marginTop: 6, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14 }}>
                {t('analyzer.subtitle')}
              </p>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <Sparkles size={13} style={{ color: '#B45309' }} />
              <span style={{ fontSize: 12, color: '#92400E', fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>
                {t('analyzer.cost', { n: 25 })}
              </span>
            </div>
          </div>
        )}

        {/* INPUT */}
        {!hasResult && !loading && (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-ink-200 rounded-2xl p-5 shadow-sm"
              style={{ border: '1px solid var(--wsl-border, #E5E7EB)' }}>
              <label style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('analyzer.inputLabel')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', borderRadius: 10, border: '1.5px solid var(--wsl-border, #E5E7EB)', padding: '10px 14px', marginTop: 8, marginBottom: 14 }}>
                <LinkIcon size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-profile"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'Inter', direction: 'ltr', textAlign: 'left' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 800, fontFamily: 'Cairo' }}>{isRTL ? 'أو' : 'OR'}</span>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
              </div>

              <div
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{ border: '2px dashed ' + (imagePreview ? '#0A8F84' : '#D1D5DB'), borderRadius: 12, padding: '18px 22px', textAlign: 'center', cursor: 'pointer', background: imagePreview ? '#F0FDF9' : '#F9FAFB', marginBottom: 14 }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" style={{ maxHeight: 100, borderRadius: 8, margin: '0 auto' }} />
                ) : (
                  <>
                    <Upload size={24} style={{ margin: '0 auto 6px', color: '#9CA3AF' }} />
                    <p style={{ color: '#6B7280', fontSize: 12, fontFamily: 'Cairo' }}>{isRTL ? 'اسحب صورة هنا أو انقر للاختيار' : 'Drag an image here or click to choose'}</p>
                  </>
                )}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!url.trim() && !imageBase64}
                style={{
                  width: '100%', padding: '13px 24px', borderRadius: 12, border: 'none',
                  background: (url.trim() || imageBase64) ? 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)' : '#E5E7EB',
                  color: (url.trim() || imageBase64) ? '#fff' : '#9CA3AF',
                  fontSize: 15, fontWeight: 900, fontFamily: 'Cairo, sans-serif',
                  cursor: (url.trim() || imageBase64) ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: (url.trim() || imageBase64) ? '0 6px 16px rgba(10,143,132,0.25)' : 'none',
                }}>
                <Sparkles size={18} />
                {t('analyzer.analyze')}
              </button>
              <p style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginTop: 10, fontFamily: 'Cairo' }}>{t('analyzer.disclaimer')}</p>
            </motion.div>

            {/* Frameworks teaser */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['Career Capital · LBS', 'Personal Brand · HBR', 'McKinsey MENA 2024'].map(f => (
                <div key={f} style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontWeight: 700, margin: 0 }}>📚 {f}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* LOADING */}
        {loading && (
          <div style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #CCFBF1', borderTopColor: '#0A8F84' }} />
              <Sparkles size={24} style={{ position: 'absolute', inset: 0, margin: 'auto', color: '#0A8F84' }} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif', marginBottom: 8, transition: 'all 200ms' }}>
              {STAGES[loadingStage]}
            </p>
            <p style={{ fontSize: 12, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', maxWidth: 420, margin: '0 auto 16px' }}>
              {t('analyzer.waitNote')}
            </p>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {STAGES.map((_, i) => (
                <div key={i} style={{
                  height: 4, borderRadius: 999,
                  background: i <= loadingStage ? '#0A8F84' : '#E5E7EB',
                  width: i <= loadingStage ? 28 : 14,
                  transition: 'all 300ms',
                }} />
              ))}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {hasResult && (
          <>
            {/* Header with actions */}
            <div className="no-print flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 26, color: 'var(--wsl-ink)', margin: 0 }}>
                  {t('analyzer.title')}
                </h1>
                <p style={{ marginTop: 4, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>
                  {t('analyzer.resultsSubtitle')}
                </p>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <Sparkles size={13} style={{ color: '#B45309' }} />
                <span style={{ fontSize: 12, color: '#92400E', fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>
                  {t('analyzer.used', { n: 25 })}
                </span>
              </div>
            </div>

            {/* Data completeness warning */}
            {(result?.completeness_warning || ((result?._meta?.completeness ?? 100) < 70) || (result?._meta?.missing_sections?.length ?? 0) > 0) && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={18} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#92400E', fontFamily: 'Cairo, sans-serif' }}>
                    {t('analyzer.completenessWarning.title', { n: result?._meta?.completeness ?? '—' })}
                  </p>
                  {result?._meta?.missing_sections?.length ? (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350F', fontFamily: 'Cairo, sans-serif', lineHeight: 1.6 }}>
                      {t('analyzer.completenessWarning.missing')}: {result._meta.missing_sections.map(s => t(`analyzer.dimensions.${s}`, s)).join('، ')}
                    </p>
                  ) : null}
                  {result?.completeness_warning && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350F', fontFamily: 'Cairo, sans-serif', lineHeight: 1.6 }}>
                      {result.completeness_warning}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Hero score */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              className="print-content"
              style={{
                background: 'linear-gradient(135deg, #ECFDFB 0%, #FFFFFF 50%, #FDF6E4 100%)',
                border: '1px solid #99F6E4',
                borderRadius: 18,
                padding: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                flexWrap: 'wrap',
                boxShadow: '0 4px 14px rgba(10,143,132,0.06)',
              }}>
              <ScoreRing score={overallScore} label={t('analyzer.outOf100')} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 999,
                  background: tierStyle.bg, color: tierStyle.color, border: `1px solid ${tierStyle.border}`,
                  fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, sans-serif',
                }}>
                  {t(`analyzer.tiers.${tier}`)}
                </span>
                <p style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif', lineHeight: 1.6 }}>
                  {headlineVerdict || (isRTL ? 'تم التحليل — راجع الأبعاد أدناه' : 'Analysis complete — review the dimensions below')}
                </p>
                {insights.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    {insights.map((ins, i) => (
                      <span key={i} style={{
                        fontSize: 10.5, background: '#fff', color: 'var(--wsl-ink)', padding: '3px 8px',
                        borderRadius: 6, border: '1px solid var(--wsl-border, #E5E7EB)', fontFamily: 'Inter', fontWeight: 600,
                      }}>
                        {ins.framework}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* 8-Dimension Breakdown */}
            <div className="print-content" style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif', margin: '0 0 16px' }}>
                {t('analyzer.dimensions.title')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px 28px' }}>
                {DIMENSIONS.map(dim => {
                  const d = dimScore(dim);
                  return (
                    <div key={dim}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif' }}>
                          {t(`analyzer.dimensions.${dim}`)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: colorFor(d.score), fontFamily: 'Inter', direction: 'ltr' }}>
                          {d.score == null ? '—' : d.score}
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${d.score ?? 0}%`,
                          background: gradientFor(d.score),
                          borderRadius: 999,
                          transition: 'width 700ms ease',
                        }} />
                      </div>
                      {d.verdict && (
                        <p style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginTop: 5, fontFamily: 'Cairo, sans-serif', lineHeight: 1.5 }}>
                          {d.verdict}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Academic Insights */}
            {insights.length > 0 && (
              <div className="print-content" style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={18} style={{ color: '#0A8F84' }} />
                  {t('analyzer.insights.title')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {insights.map((ins, i) => {
                    const colors = [
                      { border: '#A78BFA', bg: '#F5F3FF', text: '#5B21B6', accent: '#7C3AED' },
                      { border: '#0A8F84', bg: '#ECFDF5', text: '#065F46', accent: '#0F766E' },
                      { border: '#C9922A', bg: '#FFFBEB', text: '#78350F', accent: '#92400E' },
                    ][i % 3];
                    return (
                      <div key={i} style={{
                        background: colors.bg,
                        borderInlineStart: `4px solid ${colors.border}`,
                        borderRadius: isRTL ? '12px 0 0 12px' : '0 12px 12px 0',
                        padding: 14,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, background: '#fff', padding: '3px 8px', borderRadius: 6, color: 'var(--wsl-ink)', fontFamily: 'Inter' }}>
                            {ins.framework}
                          </span>
                          {ins.category && <span style={{ fontSize: 11, color: colors.accent, fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>{ins.category}</span>}
                        </div>
                        <p style={{ fontSize: 13, color: colors.text, fontFamily: 'Cairo, sans-serif', lineHeight: 1.7, margin: 0 }}>
                          <strong>{t('analyzer.insights.finding')}:</strong> {ins.finding}
                        </p>
                        <p style={{ fontSize: 13, color: colors.accent, fontFamily: 'Cairo, sans-serif', lineHeight: 1.7, marginTop: 6 }}>
                          <strong>{t('analyzer.insights.application')}:</strong> {ins.application}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vision 2030 */}
            {v2030 && (v2030Pillars.some(([, p]) => p?.note) || v2030.opportunity) && (
              <div className="print-content" style={{
                background: 'linear-gradient(135deg, #064E49, #0A8F84)',
                borderRadius: 18,
                padding: 22,
                color: '#fff',
                boxShadow: '0 8px 24px rgba(6,78,73,0.20)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(252,211,77,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Award size={20} style={{ color: '#FCD34D' }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, fontFamily: 'Cairo, sans-serif' }}>{t('analyzer.vision2030.title')}</h2>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#99F6E4', fontFamily: 'Inter' }}>Human Capability Development Program</p>
                  </div>
                </div>
                {v2030Pillars.some(([, p]) => p?.note) ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    {v2030Pillars.map(([key, p]) => (
                      <div key={key} style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 12 }}>
                        <p style={{ fontSize: 11, color: '#FCD34D', fontWeight: 800, fontFamily: 'Cairo, sans-serif', margin: '0 0 4px' }}>
                          {t(`analyzer.vision2030.${key}`)}
                        </p>
                        <p style={{ fontSize: 12.5, color: '#fff', fontFamily: 'Cairo, sans-serif', lineHeight: 1.6, margin: 0 }}>
                          {p?.note || (isRTL ? '—' : '—')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#fff', fontFamily: 'Cairo, sans-serif', lineHeight: 1.7, margin: 0 }}>
                    {v2030.opportunity}
                  </p>
                )}
              </div>
            )}

            {/* Before / After — smart: shows "kept as is" if model said so */}
            {baKept && (
              <div className="print-content" style={{ background: 'linear-gradient(135deg, #ECFDF5, #FFFFFF)', border: '1px solid #A7F3D0', borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <CheckCircle size={26} style={{ color: '#0A8F84', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#065F46', fontFamily: 'Cairo, sans-serif' }}>
                    {t('analyzer.beforeAfter.keptAsIs')} — Headline
                  </p>
                  {baReason && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#0F766E', fontFamily: 'Cairo, sans-serif', lineHeight: 1.6 }}>
                      {baReason}
                    </p>
                  )}
                </div>
              </div>
            )}
            {!baKept && (baBefore || baAfter) && (
              <div className="print-content" style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif', margin: '0 0 6px' }}>
                  {t('analyzer.beforeAfter.title')} — Headline
                </h2>
                {baReason && (
                  <p style={{ fontSize: 12, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', lineHeight: 1.6, margin: '0 0 12px' }}>
                    {baReason}
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 14 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 800, color: '#991B1B', fontFamily: 'Cairo, sans-serif', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
                      {t('analyzer.beforeAfter.before')}
                    </p>
                    <p style={{ fontSize: 13, color: '#7F1D1D', fontFamily: baLang === 'ar' ? 'Cairo, sans-serif' : 'Inter', direction: baLang === 'ar' ? 'rtl' : 'ltr', textAlign: baLang === 'ar' ? 'right' : 'left', lineHeight: 1.6, margin: 0 }}>
                      {baBefore || '—'}
                    </p>
                  </div>
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 14 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 800, color: '#065F46', fontFamily: 'Cairo, sans-serif', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
                      {t('analyzer.beforeAfter.after')}
                    </p>
                    <p style={{ fontSize: 13, color: '#064E3B', fontFamily: baLang === 'ar' ? 'Cairo, sans-serif' : 'Inter', direction: baLang === 'ar' ? 'rtl' : 'ltr', textAlign: baLang === 'ar' ? 'right' : 'left', lineHeight: 1.6, margin: 0 }}>
                      {baAfter || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Wins — replaces 4-week plan */}
            {quickWins.length > 0 && (
              <div className="print-content" style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif', margin: 0 }}>
                      {t('analyzer.quickWins.title')}
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', margin: '4px 0 0' }}>
                      {t('analyzer.quickWins.subtitle')}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: '#0F766E', background: '#ECFDF5', padding: '4px 10px', borderRadius: 999, border: '1px solid #A7F3D0', fontWeight: 800, fontFamily: 'Cairo, sans-serif' }}>
                    {t('analyzer.quickWins.timeTotal', { n: totalQuickWinTime() })}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                  {quickWins.map((win, i) => {
                    const effortStyle = win.effort === '5min' ? { bg: '#D1FAE5', text: '#065F46', icon: '⚡' }
                      : win.effort === '15min' ? { bg: '#CCFBF1', text: '#0F766E', icon: '🔹' }
                      : win.effort === '30min' ? { bg: '#FEF3C7', text: '#92400E', icon: '⏱️' }
                      : { bg: '#FFE4E6', text: '#9F1239', icon: '📌' };
                    const priorityStyle = win.priority === 'high' ? { border: '#F43F5E', bg: '#FFF1F2' }
                      : win.priority === 'medium' ? { border: '#F59E0B', bg: '#FFFBEB' }
                      : { border: '#0A8F84', bg: '#ECFDF5' };
                    return (
                      <div key={i} style={{
                        background: priorityStyle.bg,
                        borderInlineStart: `4px solid ${priorityStyle.border}`,
                        borderRadius: isRTL ? '12px 0 0 12px' : '0 12px 12px 0',
                        padding: 14,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 220 }}>
                            <span style={{ fontSize: 16 }}>{effortStyle.icon}</span>
                            <h3 style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif', margin: 0, lineHeight: 1.5 }}>
                              {win.action}
                            </h3>
                          </div>
                          <span style={{ background: effortStyle.bg, color: effortStyle.text, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
                            {win.effort}
                          </span>
                        </div>
                        <p style={{ fontSize: 12.5, color: 'var(--wsl-ink-2, #334155)', fontFamily: 'Cairo, sans-serif', lineHeight: 1.7, margin: 0 }}>
                          <strong>{t('analyzer.quickWins.why')}:</strong> {win.why}
                        </p>
                        {win.example && (
                          <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.7)', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 6 }}>
                            <p style={{ fontSize: 10.5, color: 'var(--wsl-ink-3)', fontWeight: 800, margin: '0 0 4px', fontFamily: 'Cairo, sans-serif' }}>
                              {t('analyzer.quickWins.example')}:
                            </p>
                            <p style={{ fontSize: 11.5, color: 'var(--wsl-ink-2)', fontFamily: 'monospace', lineHeight: 1.55, margin: 0 }}>
                              {win.example}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 14, padding: 12, background: '#ECFDFB', border: '1px solid #99F6E4', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Sparkles size={14} style={{ color: '#0F766E', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 12, color: '#065F46', fontFamily: 'Cairo, sans-serif', lineHeight: 1.65, margin: 0 }}>
                    {t('analyzer.quickWins.tip')}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={handleExportPDF} disabled={pdfBusy}
                style={{
                  flex: 1, minWidth: 140,
                  background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff',
                  padding: '13px 18px', borderRadius: 12, border: 'none',
                  cursor: pdfBusy ? 'wait' : 'pointer', opacity: pdfBusy ? 0.7 : 1,
                  fontSize: 13, fontWeight: 800, fontFamily: 'Cairo, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 6px 16px rgba(10,143,132,0.25)',
                }}>
                <FileDown size={16} />
                {pdfBusy ? t('analyzer.pdfGenerating') : t('analyzer.actions.exportPDF')}
              </button>
              <button onClick={() => setShowEmailModal(true)}
                style={{
                  flex: 1, minWidth: 140,
                  background: '#fff', color: '#B45309',
                  border: '1px solid #FCD34D', padding: '13px 18px', borderRadius: 12, cursor: 'pointer',
                  fontSize: 13, fontWeight: 800, fontFamily: 'Cairo, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <Mail size={16} />
                {t('analyzer.actions.sendEmail')}
              </button>
              <button onClick={handleReset}
                style={{
                  flex: 1, minWidth: 140,
                  background: '#fff', color: '#0A8F84',
                  border: '1px solid #0A8F84', padding: '13px 18px', borderRadius: 12, cursor: 'pointer',
                  fontSize: 13, fontWeight: 800, fontFamily: 'Cairo, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <RotateCcw size={16} />
                {t('analyzer.actions.regenerate')}
              </button>
            </div>

          </>
        )}

        {/* Email modal */}
        {showEmailModal && (
          <div
            onClick={() => setShowEmailModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(15,23,42,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 18, padding: 22, maxWidth: 420, width: '100%', boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}
              dir={isRTL ? 'rtl' : 'ltr'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #FBBF24, #C9922A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif' }}>
                    {t('analyzer.emailModal.title')}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif' }}>
                    {t('analyzer.emailModal.subtitle')}
                  </p>
                </div>
              </div>
              <input
                type="email"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                placeholder="your@email.com"
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--wsl-border, #E5E7EB)', borderRadius: 10, fontSize: 14, fontFamily: 'Inter', direction: 'ltr', textAlign: 'left', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={() => setShowEmailModal(false)}
                  disabled={emailBusy}
                  style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', color: 'var(--wsl-ink-2)', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 800, cursor: emailBusy ? 'wait' : 'pointer' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={emailBusy}
                  style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff', fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 800, cursor: emailBusy ? 'wait' : 'pointer', opacity: emailBusy ? 0.7 : 1 }}>
                  {emailBusy ? t('analyzer.emailSending') : t('analyzer.emailModal.send')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
