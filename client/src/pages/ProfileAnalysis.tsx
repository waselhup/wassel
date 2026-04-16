import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, CheckCircle, XCircle, Copy, ChevronDown, Upload,
  Link as LinkIcon, Loader2, AlertCircle, UserCheck, Check, X,
  Clock, TrendingUp, Printer, MoreVertical,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { trpcMutation } from '../lib/trpc';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface ScoreBreakdown {
  headline: number; about: number; experience: number; skills: number;
  education: number; photo: number; connections: number; certifications: number;
}
interface UpgradeItem { before: string; after: string; tips: string; }
interface ActionItem { action: string; time: string; priority: string; }
interface BannerDesign { background: string; mainText: string; tagline: string; accent: string; }
interface AnalysisResult {
  score: number; scoreBreakdown: ScoreBreakdown;
  strengths: string[]; weaknesses: string[];
  upgradePlan: { headline: UpgradeItem; about: UpgradeItem; experience: UpgradeItem; };
  missingSections: string[]; actionChecklist: ActionItem[];
  recommendationTemplate: string; bannerDesign: BannerDesign; error?: string;
}
interface HistoryItem {
  id: string; score: number; url: string; created_at: string; result: AnalysisResult;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BREAKDOWN_MAX: Record<string, number> = {
  headline: 15, about: 15, experience: 20, skills: 10,
  education: 10, photo: 10, connections: 10, certifications: 10,
};
const BREAKDOWN_LABELS_AR: Record<string, string> = {
  headline: 'العنوان', about: 'النبذة', experience: 'الخبرات', skills: 'المهارات',
  education: 'التعليم', photo: 'الصورة', connections: 'الشبكة', certifications: 'الشهادات',
};

// ─── Toast ───────────────────────────────────────────────────────────────────
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }
function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = (type: ToastItem['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
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
              background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: t.type === 'success' ? '#065F46' : '#991B1B',
              border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {t.type === 'success' ? <Check size={16} /> : <X size={16} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

// ─── Score Circle ─────────────────────────────────────────────────────────────
function ScoreCircle({ score }: { score: number }) {
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
  const r = 54; const c = 2 * Math.PI * r;
  const offset = c - (anim / 100) * c;
  const color = anim >= 80 ? '#0A8F84' : anim >= 60 ? '#C9922A' : '#DC2626';
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke="#E5E7EB" strokeWidth={9} />
        <circle cx={70} cy={70} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 36, fontWeight: 900, color, fontFamily: 'Inter' }}>{anim}</span>
        <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Cairo' }}>من 100</span>
      </div>
    </div>
  );
}

// ─── Upgrade Section ──────────────────────────────────────────────────────────
function UpgradeSection({ title, data }: { title: string; data: UpgradeItem }) {
  const [open, setOpen] = useState(false);
  const [showAfter, setShowAfter] = useState(true);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(data.after); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--wsl-border, #E5E7EB)', overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cairo', fontWeight: 800, fontSize: 14, color: 'var(--wsl-ink)' }}>
        <span>{title}</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={() => setShowAfter(false)}
                  style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid ' + (!showAfter ? '#DC2626' : '#E5E7EB'), background: !showAfter ? '#FEF2F2' : '#fff', color: !showAfter ? '#DC2626' : '#6B7280', fontFamily: 'Cairo', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>قبل</button>
                <button onClick={() => setShowAfter(true)}
                  style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid ' + (showAfter ? '#0A8F84' : '#E5E7EB'), background: showAfter ? '#ECFDF5' : '#fff', color: showAfter ? '#0A8F84' : '#6B7280', fontFamily: 'Cairo', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>بعد</button>
              </div>
              <div style={{ background: showAfter ? '#F0FDF9' : '#FEF2F2', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.8, color: '#1F2937', fontFamily: 'Cairo', whiteSpace: 'pre-wrap', position: 'relative' }}>
                {showAfter ? data.after : data.before}
                {showAfter && (
                  <button onClick={copy} style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#059669' : '#9CA3AF' }}>
                    <Copy size={14} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, fontFamily: 'Cairo' }}>{data.tips}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProfileAnalysis() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === 'ar';
  const toast = useToast();

  // Input state
  const [url, setUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [mediaType, setMediaType] = useState('image/png');

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tab, setTab] = useState<'overview' | 'plan' | 'history'>('overview');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const STAGES = [
    t('profileAnalysis.stages.fetching', 'جاري جلب بيانات الملف...'),
    t('profileAnalysis.stages.analyzing', 'جاري تحليل ملفك بالذكاء امناعي...'),
    t('profileAnalysis.stages.preparing', 'جاري إعداد التقرير...'),
  ];

  // Pre-fill LinkedIn URL from profile
  useEffect(() => {
    if ((profile as any)?.linkedin_url && !url) {
      setUrl((profile as any).linkedin_url);
    }
  }, [profile]);

  // Load history
  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('linkedin_analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setHistory(data as HistoryItem[]);
    } catch { /* noop */ }
    setHistoryLoading(false);
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.push('error', 'الملف يجب أن يكون صورة');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.push('error', 'الصورة كبيرة جداً (الحد الأقصى 10 ميجا)');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // Compress: max 1920px wide, JPEG quality 0.8
        const maxW = 1920;
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setImagePreview(dataUrl);
          setImageBase64(dataUrl.split(',')[1]);
          setMediaType(file.type);
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        let quality = 0.8;
        let compressed = canvas.toDataURL('image/jpeg', quality);
        const targetSize = 3 * 1024 * 1024 * 1.37; // 3MB after base64 inflation
        while (compressed.length > targetSize && quality > 0.3) {
          quality -= 0.1;
          compressed = canvas.toDataURL('image/jpeg', quality);
        }
        const sizeMB = (compressed.length * 0.75 / 1024 / 1024).toFixed(2);
        console.log('[Compress] ' + sizeMB + 'MB at quality ' + quality.toFixed(1));
        
        setImagePreview(compressed);
        setImageBase64(compressed.split(',')[1]);
        setMediaType('image/jpeg');
      };
      img.onerror = () => {
        toast.push('error', 'فشل قراءة الصورة');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      toast.push('error', 'فشل قراءة الملف');
    };
    reader.readAsDataURL(file);
  };

  async function handleAnalyze() {
    console.log('[Analyze] Start — url:', url ? 'yes' : 'no', 'image:', imageBase64 ? 'yes' : 'no');
    if (!url.trim() && !imageBase64) { console.log('[Analyze] No input, returning'); return; }
    setLoading(true); setLoadingStage(0); setResult(null); setCheckedItems({});
    const stageTimer1 = setTimeout(() => setLoadingStage(1), 2000);
    const stageTimer2 = setTimeout(() => setLoadingStage(2), 5000);
    try {
      console.log('[Analyze] Before trpcMutation call');
      const res = await trpcMutation('linkedin.analyzeDeep', {
        linkedinUrl: url || undefined,
        imageBase64: imageBase64 || undefined,
        mediaType,
      });
      console.log('[Analyze] Response received:', res ? 'has data' : 'empty');
      console.log('[Analyze] Response type:', typeof res);
      console.log('[Analyze] Response keys:', res ? Object.keys(res) : 'null');
      console.log('[Analyze] Response snippet:', JSON.stringify(res).substring(0, 500));
      console.log('[Analyze] Has score?', 'score' in (res || {}), 'score value:', res?.score);
      clearTimeout(stageTimer1); clearTimeout(stageTimer2);

      // Unwrap if server returned nested { result: { data: ... } } or { data: ... }
      const analysis = res?.score !== undefined ? res
        : res?.data?.score !== undefined ? res.data
        : res?.result?.score !== undefined ? res.result
        : res?.result?.data?.score !== undefined ? res.result.data
        : res;
      console.log('[Analyze] Final analysis score:', analysis?.score);

      if (!analysis) {
        console.error('[Analyze] Empty response from analyzeDeep');
        toast.push('error', t('profileAnalysis.error', 'حدث خطأ غير متوقع - لم يتم استلام رد'));
      } else if (analysis.error) {
        toast.push('error', analysis.error);
      } else {
        console.log('[Analyze] Setting result, score:', analysis.score);
        setResult(analysis as AnalysisResult);
        setTab('overview');
        toast.push('success', t('profileAnalysis.analysisDone', 'تم التحليل بنجاح!'));
        void loadHistory();
      }
    } catch (err: any) {
      console.error('[Analyze] CAUGHT ERROR:', err, err?.stack);
      toast.push('error', err?.message || t('profileAnalysis.error', 'حدث خطأ غير متوقع'));
    }
    clearTimeout(stageTimer1); clearTimeout(stageTimer2);
    setLoading(false);
    console.log('[Analyze] Done, loading set to false');
  }

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalActions = result?.actionChecklist?.length || 0;
  const canAnalyze = (url.trim().length > 10 || !!imageBase64) && !loading;

  const tabList = [
    { id: 'overview' as const, label: t('profileAnalysis.tabs.overview', 'نظرة عامة') },
    { id: 'plan' as const, label: t('profileAnalysis.tabs.plan', 'خطة التحسين') },
    { id: 'history' as const, label: t('profileAnalysis.tabs.history', 'السجل'), count: history.length },
  ];

  return (
    <DashboardLayout pageTitle={t('profileAnalysis.title', 'تحليل البروفايل')}>
      <toast.View />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 30, color: 'var(--wsl-ink)', letterSpacing: '-0.5px', margin: 0 }}>
              {t('profileAnalysis.title', 'تحليل البروفايل المهني')}
            </h1>
            <p style={{ marginTop: 6, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14, lineHeight: 1.6 }}>
              {t('profileAnalysis.subtitle', 'احصل عميق تحليل عميق لملفك الشخصي LinkedIn بالذكاء الاصورة')}
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <AlertCircle size={14} style={{ color: '#D97706' }} />
            <span style={{ fontSize: 12, color: '#92400E', fontFamily: 'Cairo, sans-serif', fontWeight: 800 }}>
              25 {t('profileAnalysis.tokens', 'توكن للتحليل')}
            </span>
          </div>
        </motion.div>

        {/* ── Input Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
          style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, marginBottom: 24, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}
        >
          {/* Card Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--wsl-border, #E5E7EB)', background: 'linear-gradient(135deg, rgba(10,143,132,0.06) 0%, rgba(14,165,233,0.06) 100%)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCheck size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)' }}>
                {t('profileAnalysis.inputTitle', 'رابط LinkedIn أو صورة الملف الشخصي')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif' }}>
                {t('profileAnalysis.inputSub', 'أدخل الرابط أو ارفع صورة لبدء التحليل')}
              </div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {/* URL Input */}
            <label style={labelStyle}>{t('profileAnalysis.urlLabel', 'رابط LinkedIn')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', borderRadius: 10, border: '1.5px solid var(--wsl-border, #E5E7EB)', padding: '10px 14px', marginBottom: 16 }}>
              <LinkIcon size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-profile"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'Inter', direction: 'ltr', textAlign: 'left' }}
              />
              {(profile as any)?.linkedin_url && url !== (profile as any).linkedin_url && (
                <button onClick={() => setUrl((profile as any).linkedin_url)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #0A8F84', background: '#F0FDF9', color: '#0A8F84', fontSize: 11, fontWeight: 800, fontFamily: 'Cairo', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {t('profileAnalysis.myProfile', 'ملفي')}
                </button>
              )}
            </div>

            {/* OR Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
              <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 800, fontFamily: 'Cairo' }}>{t('common.or', 'أو')}</span>
              <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
            </div>

            {/* Image Drop Zone */}
            <div
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed ' + (imagePreview ? '#0A8F84' : '#D1D5DB'), borderRadius: 12, padding: '20px 24px', textAlign: 'center', cursor: 'pointer', background: imagePreview ? '#F0FDF9' : '#F9FAFB', transition: 'all 0.2s', marginBottom: 18 }}
            >
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              {imagePreview ? (
                <img src={imagePreview} alt="preview" style={{ maxHeight: 120, borderRadius: 8, margin: '0 auto' }} />
              ) : (
                <>
                  <Upload size={28} style={{ margin: '0 auto 8px', color: '#9CA3AF' }} />
                  <p style={{ color: '#6B7280', fontSize: 13, fontFamily: 'Cairo' }}>{t('profileAnalysis.dropZone', 'اسحب صورة ملفك الشخصي هنا أو انقر للاختيار')}</p>
                </>
              )}
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              style={{
                width: '100%', padding: '13px 24px', borderRadius: 12, border: 'none',
                background: canAnalyze ? 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)' : '#E5E7EB',
                color: canAnalyze ? '#fff' : '#9CA3AF',
                fontSize: 15, fontWeight: 900, fontFamily: 'Cairo, sans-serif',
                cursor: canAnalyze ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: canAnalyze ? '0 6px 16px rgba(10,143,132,0.25)' : 'none',
                transition: 'all 200ms',
              }}
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <Loader2 size={18} />
                  </motion.div>
                  <span>{STAGES[loadingStage]}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  {t('profileAnalysis.analyze', 'تحليل ملفي الآن')}
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* ── Results ── */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--wsl-surf-2, #F3F4F6)', marginBottom: 20, overflowX: 'auto' }}>
                {tabList.map(tb => {
                  const active = tab === tb.id;
                  return (
                    <button key={tb.id} onClick={() => setTab(tb.id)}
                      style={{
                        flex: 1, minWidth: 110, padding: '9px 14px', borderRadius: 9,
                        border: 'none', cursor: 'pointer',
                        background: active ? '#fff' : 'transparent',
                        color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)',
                        fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13,
                        boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 150ms ease',
                      }}
                    >
                      {tb.label}
                      {tb.count !== undefined && (
                        <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: active ? 'var(--wsl-teal-bg, #E0F7F5)' : 'rgba(0,0,0,0.06)', color: active ? 'var(--wsl-teal, #0A8F84)' : 'var(--wsl-ink-3)', fontFamily: 'Inter, sans-serif' }}>
                          {tb.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Overview Tab ── */}
              {tab === 'overview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Score + Breakdown */}
                  <div style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink-2)', marginBottom: 12 }}>
                        {t('profileAnalysis.score', 'تقييم LinkedIn')}
                      </div>
                      <ScoreCircle score={result.score} />
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      {Object.entries(result.scoreBreakdown || {}).map(([key, val]) => {
                        const max = BREAKDOWN_MAX[key] || 10;
                        const pct = Math.round((val / max) * 100);
                        const color = pct >= 80 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';
                        return (
                          <div key={key} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-2)', fontFamily: 'Cairo' }}>{BREAKDOWN_LABELS_AR[key] || key}</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color, fontFamily: 'Inter' }}>{val}/{max}</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 999, background: '#E5E7EB', overflow: 'hidden' }}>
                              <motion.div
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                                style={{ height: '100%', borderRadius: 999, background: color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Strengths + Weaknesses */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 14, padding: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <CheckCircle size={18} style={{ color: '#059669' }} />
                        <span style={{ fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, color: '#065F46' }}>
                          {t('profileAnalysis.strengths', 'نقاط القوة')}
                        </span>
                      </div>
                      {(result.strengths || []).map((s, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#065F46', marginBottom: 8, paddingInlineStart: 10, borderInlineStart: '3px solid #059669', lineHeight: 1.6, fontFamily: 'Cairo' }}>{s}</div>
                      ))}
                    </div>
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <XCircle size={18} style={{ color: '#DC2626' }} />
                        <span style={{ fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, color: '#991B1B' }}>
                          {t('profileAnalysis.weaknesses', 'نقاط الضعف')}
                        </span>
                      </div>
                      {(result.weaknesses || []).map((w, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#991B1B', marginBottom: 8, paddingInlineStart: 10, borderInlineStart: '3px solid #DC2626', lineHeight: 1.6, fontFamily: 'Cairo' }}>{w}</div>
                      ))}
                    </div>
                  </div>

                  {/* Missing Sections */}
                  {result.missingSections && result.missingSections.length > 0 && (
                    <div style={{ background: '#FFFBEB', borderRadius: 14, border: '1px solid #FDE68A', padding: 16 }}>
                      <div style={{ fontFamily: 'Cairo', fontWeight: 900, fontSize: 13, color: '#92400E', marginBottom: 10 }}>
                        {t('profileAnalysis.missing', 'أقسام مفقودة من ملفك')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {result.missingSections.map((s, i) => (
                          <span key={i} style={{ background: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 800, fontFamily: 'Cairo' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Checklist */}
                  {(result.actionChecklist || []).length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontFamily: 'Cairo', fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)', marginBottom: 8 }}>
                        {t('profileAnalysis.checklist', 'قائمة المهام')}
                      </div>
                      <div style={{ background: '#F3F4F6', borderRadius: 8, height: 6, marginBottom: 12, overflow: 'hidden' }}>
                        <motion.div
                          animate={{ width: totalActions > 0 ? `${(checkedCount / totalActions) * 100}%` : '0%' }}
                          style={{ height: '100%', background: 'linear-gradient(90deg, #0A8F84, #12B5A8)', borderRadius: 8, transition: 'width 0.3s' }}
                        />
                      </div>
                      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, fontFamily: 'Cairo' }}>{checkedCount} / {totalActions}</p>
                      {result.actionChecklist.map((item, i) => {
                        const checked = checkedItems[i] || false;
                        const prColor = item.priority === 'high' ? '#DC2626' : item.priority === 'medium' ? '#D97706' : '#059669';
                        const prBg = item.priority === 'high' ? '#FEF2F2' : item.priority === 'medium' ? '#FFFBEB' : '#ECFDF5';
                        return (
                          <div key={i} onClick={() => setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)', marginBottom: 8, cursor: 'pointer', opacity: checked ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                            <div style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid ' + (checked ? '#0A8F84' : '#D1D5DB'), background: checked ? '#0A8F84' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {checked && <Check size={12} color="#fff" />}
                            </div>
                            <span style={{ flex: 1, fontSize: 13, color: '#1F2937', textDecoration: checked ? 'line-through' : 'none', fontFamily: 'Cairo' }}>{item.action}</span>
                            <span style={{ fontSize: 10, color: '#6B7280', fontFamily: 'Inter', flexShrink: 0 }}>{item.time}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: prColor, background: prBg, padding: '2px 8px', borderRadius: 4, flexShrink: 0, fontFamily: 'Cairo' }}>
                              {item.priority === 'high' ? 'عاجل' : item.priority === 'medium' ? 'متوسط' : 'منخفض'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recommendation Template */}
                  {result.recommendationTemplate && (
                    <div style={{ background: 'linear-gradient(135deg, #064E49, #0A8F84)', borderRadius: 16, padding: 20, color: '#fff' }}>
                      <div style={{ fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
                        {t('profileAnalysis.recTemplate', 'قالب طلب توصية')}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.8, position: 'relative', fontFamily: 'Cairo' }}>
                        {result.recommendationTemplate}
                        <button onClick={() => { navigator.clipboard.writeText(result.recommendationTemplate); toast.push('success', t('posts.copied', 'تم النسخ')); }}
                          style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer' }}>
                          <Copy size={13} color="#fff" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* New Analysis Button */}
                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <button onClick={() => { setResult(null); setUrl(''); setImageBase64(''); setImagePreview(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', color: 'var(--wsl-ink-2)', fontSize: 13, fontWeight: 800, fontFamily: 'Cairo', cursor: 'pointer' }}>
                      {t('profileAnalysis.newAnalysis', 'تحليل جديد')}
                    </button>
                    <button onClick={() => window.print()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)', background: '#fff', color: 'var(--wsl-ink-2)', fontSize: 13, fontWeight: 800, fontFamily: 'Cairo', cursor: 'pointer' }}>
                      <Printer size={14} /> {t('profileAnalysis.print', 'طباعة')}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Plan Tab ── */}
              {tab === 'plan' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {result.upgradePlan?.headline && <UpgradeSection title={t('profileAnalysis.headline', 'العنوان الوظيفي (Headline)')} data={result.upgradePlan.headline} />}
                  {result.upgradePlan?.about && <UpgradeSection title={t('profileAnalysis.about', 'النبذة التعريفية (About)')} data={result.upgradePlan.about} />}
                  {result.upgradePlan?.experience && <UpgradeSection title={t('profileAnalysis.experience', 'الخبرات المهنية (Experience)')} data={result.upgradePlan.experience} />}
                  {result.bannerDesign && (
                    <div style={{ background: result.bannerDesign.background || 'linear-gradient(135deg, #064E49, #0A8F84)', borderRadius: 14, padding: '28px 20px', color: '#fff', marginTop: 14 }}>
                      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4, fontFamily: 'Cairo' }}>{result.bannerDesign.mainText}</div>
                      <div style={{ fontSize: 13, opacity: 0.85, fontFamily: 'Inter' }}>{result.bannerDesign.tagline}</div>
                      <div style={{ marginTop: 12, width: 40, height: 4, borderRadius: 2, background: result.bannerDesign.accent || '#C9922A' }} />
                      <p style={{ fontSize: 11, opacity: 0.7, marginTop: 10, fontFamily: 'Cairo' }}>{t('profileAnalysis.bannerTip', 'احفظ هذا كـ screenshot للاستخدام كبانر')}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── History Tab ── */}
              {tab === 'history' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block' }}>
                        <Loader2 size={24} color="#0A8F84" />
                      </motion.div>
                    </div>
                  ) : history.length === 0 ? (
                    <div style={{ background: '#fff', border: '2px dashed var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: '50px 24px', textAlign: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px', background: 'linear-gradient(135deg, rgba(10,143,132,0.1), rgba(14,165,233,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={28} color="#0A8F84" />
                      </div>
                      <div style={{ fontFamily: 'Cairo', fontWeight: 900, fontSize: 16, color: 'var(--wsl-ink)', marginBottom: 6 }}>
                        {t('profileAnalysis.historyEmpty', 'لا يوجد سجل تحليلات بعد')}
                      </div>
                      <div style={{ fontFamily: 'Cairo', fontSize: 13, color: 'var(--wsl-ink-3)' }}>
                        {t('profileAnalysis.historyEmptySub', 'ابدأ بتحليل ملفك لتظهر نتائجك هنا')}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {history.map((h, idx) => {
                        const color = (h.score || 0) >= 80 ? '#059669' : (h.score || 0) >= 60 ? '#D97706' : '#DC2626';
                        return (
                          <motion.div key={h.id}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                            onClick={() => { setResult(h.result); setTab('overview'); }}
                            style={{ background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 200ms' }}
                          >
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 18, fontWeight: 900, color, fontFamily: 'Inter' }}>{h.score || '?'}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--wsl-ink)', fontFamily: 'Cairo', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {h.url || t('profileAnalysis.imageAnalysis', 'تحليل عبر صورة')}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo', marginTop: 2 }}>
                                {h.created_at ? new Date(h.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : ''}
                              </div>
                            </div>
                            <TrendingUp size={16} style={{ color: '#0A8F84', flexShrink: 0 }} />
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state when no analysis yet */}
        {!result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: '#fff', border: '2px dashed var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: '50px 24px', textAlign: 'center' }}
          >
            <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: 'linear-gradient(135deg, rgba(10,143,132,0.1), rgba(14,165,233,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={32} color="#0A8F84" />
            </div>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)', marginBottom: 6 }}>
              {t('profileAnalysis.empty', 'ابدأ بتحليل ملفك المهني')}
            </div>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, color: 'var(--wsl-ink-3)' }}>
              {t('profileAnalysis.emptySub', 'أدخل رابط LinkedIn أو ارفع صورة الملف املف الشخصي للحصول على تقييم شامل')}
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6,
  fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 800, fontSize: 12,
  color: 'var(--wsl-ink-2)',
};

export { ProfileAnalysis };
