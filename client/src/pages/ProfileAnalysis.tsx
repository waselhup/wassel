import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/DashboardLayout';
import { trpc } from '../lib/trpc';
import { CheckCircle, XCircle, Copy, ChevronDown, ChevronUp, Upload, Link as LinkIcon, Loader2, Printer, AlertCircle } from 'lucide-react';
import { WasselLogo } from '../components/WasselLogo';

interface ScoreBreakdown {
  headline: number; about: number; experience: number; skills: number;
  education: number; photo: number; connections: number; certifications: number;
}
interface UpgradeItem { before: string; after: string; tips: string; }
interface ActionItem { action: string; time: string; priority: string; }
interface BannerDesign { background: string; mainText: string; tagline: string; layout: string; accent: string; }
interface AnalysisResult {
  score: number; scoreBreakdown: ScoreBreakdown;
  strengths: string[]; weaknesses: string[];
  upgradePlan: { headline: UpgradeItem; about: UpgradeItem; experience: UpgradeItem; };
  missingSections: string[]; actionChecklist: ActionItem[];
  recommendationTemplate: string; bannerDesign: BannerDesign; error?: string;
}

const BREAKDOWN_MAX: Record<string, number> = {
  headline: 15, about: 15, experience: 20, skills: 10,
  education: 10, photo: 10, connections: 10, certifications: 10,
};
const BREAKDOWN_LABELS: Record<string, string> = {
  headline: 'العنوان', about: 'النبذة', experience: 'الخبرات', skills: 'المهارات',
  education: 'التعليم', photo: 'الصورة', connections: 'الشبكة', certifications: 'الشهادات',
};

function ScoreCircle({ score }: { score: number }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    let frame: number; let start: number;
    const duration = 1200;
    function step(ts: number) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setAnim(Math.round(progress * score));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  const r = 54; const c = 2 * Math.PI * r;
  const offset = c - (anim / 100) * c;
  const color = anim >= 80 ? '#0A8F84' : anim >= 60 ? '#C9922A' : '#DC2626';
  return (
    <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
      <svg width={160} height={160} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={80} cy={80} r={r} fill="none" stroke="#E5E7EB" strokeWidth={10} />
        <circle cx={80} cy={80} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 42, fontWeight: 900, color, fontFamily: 'Inter' }}>{anim}</span>
        <span style={{ fontSize: 13, color: '#6B7280', fontFamily: 'Cairo' }}>من 100</span>
      </div>
    </div>
  );
}

function BreakdownBadges({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
      {Object.entries(breakdown).map(([key, val]) => {
        const max = BREAKDOWN_MAX[key] || 10;
        const pct = (val / max) * 100;
        const bg = pct >= 80 ? '#ECFDF5' : pct >= 60 ? '#FFFBEB' : '#FEF2F2';
        const fg = pct >= 80 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';
        return (
          <div key={key} style={{ background: bg, color: fg, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'Cairo', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{BREAKDOWN_LABELS[key] || key}</span>
            <span style={{ fontFamily: 'Inter' }}>{val}/{max}</span>
          </div>
        );
      })}
    </div>
  );
}

function UpgradeSection({ title, data }: { title: string; data: UpgradeItem }) {
  const [open, setOpen] = useState(false);
  const [showAfter, setShowAfter] = useState(true);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(data.after); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Cairo', fontWeight: 700, fontSize: 15, color: '#0B1220' }}>
        <span>{title}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setShowAfter(false)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid ' + (!showAfter ? '#DC2626' : '#E5E7EB'), background: !showAfter ? '#FEF2F2' : '#fff', color: !showAfter ? '#DC2626' : '#6B7280', fontFamily: 'Cairo', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>قبل</button>
            <button onClick={() => setShowAfter(true)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid ' + (showAfter ? '#0A8F84' : '#E5E7EB'), background: showAfter ? '#ECFDF5' : '#fff', color: showAfter ? '#0A8F84' : '#6B7280', fontFamily: 'Cairo', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>بعد</button>
          </div>
          <div style={{ background: showAfter ? '#F0FDF9' : '#FEF2F2', borderRadius: 8, padding: 14, fontSize: 14, lineHeight: 1.8, color: '#1F2937', fontFamily: 'Cairo', whiteSpace: 'pre-wrap', position: 'relative' }}>
            {showAfter ? data.after : data.before}
            {showAfter && (
              <button onClick={copy} style={{ position: 'absolute', top: 8, left: 8, background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#059669' : '#9CA3AF' }}>
                <Copy size={16} />
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, fontFamily: 'Cairo' }}>{data.tips}</p>
        </div>
      )}
    </div>
  );
}

export default function ProfileAnalysis() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [mediaType, setMediaType] = useState('image/png');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // analyzeDeep client method (uses fetch wrapper)
  const callAnalyzeDeep = async (input: any) => {
    const { trpcMutation } = await import('../lib/trpc');
    return trpcMutation('linkedin.analyzeDeep', input);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleAnalyze = async () => {
    if (!url && !imageBase64) return;
    setLoading(true); setError(''); setResult(null); setCheckedItems({});
    try {
      const res = await callAnalyzeDeep({
        linkedinUrl: url || undefined,
        imageBase64: imageBase64 || undefined,
        mediaType,
      });
      if (res.error) { setError(res.error); }
      else { setResult(res as AnalysisResult); }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع');
    } finally { setLoading(false); }
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalActions = result?.actionChecklist?.length || 0;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', fontFamily: 'Cairo, sans-serif', direction: 'rtl' }} className="print-container">
        <style>{`@media print { .no-print { display: none !important; } .print-container { padding: 0 !important; } }`}</style>

        {/* HEADER */}
        <div style={{ marginBottom: 32, textAlign: 'center' }} className="no-print">
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0B1220', marginBottom: 8 }}>تحليل البروفايل العميق</h1>
          <p style={{ color: '#6B7280', fontSize: 14 }}>احصل على تحليل شامل لملفك الشخصي على LinkedIn مع خطة تحسين مفصّلة</p>
        </div>

        {/* INPUT CARD */}
        {!result && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, marginBottom: 24 }} className="no-print">
            {/* URL Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' }}>رابط LinkedIn</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB', padding: '10px 14px' }}>
                <LinkIcon size={18} color="#9CA3AF" />
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="linkedin.com/in/username"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'Inter', direction: 'ltr', textAlign: 'left' }} />
              </div>
            </div>

            {/* OR Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
              <span style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 700 }}>أو</span>
              <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
            </div>

            {/* Drop Zone */}
            <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed ' + (imagePreview ? '#0A8F84' : '#D1D5DB'), borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', background: imagePreview ? '#F0FDF9' : '#F9FAFB', transition: 'all 0.2s' }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              {imagePreview ? (
                <img src={imagePreview} alt="preview" style={{ maxHeight: 160, borderRadius: 8, margin: '0 auto' }} />
              ) : (
                <>
                  <Upload size={32} color="#9CA3AF" style={{ margin: '0 auto 8px' }} />
                  <p style={{ color: '#6B7280', fontSize: 14 }}>اسحب صورة الملف الشخصي هنا أو انقر للاختيار</p>
                </>
              )}
            </div>

            {/* Cost Notice */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
              <AlertCircle size={16} color="#D97706" />
              <span style={{ fontSize: 13, color: '#92400E' }}>سيستخدم هذا التحليل <strong>25 توكن</strong></span>
            </div>

            {/* Analyze Button */}
            <button onClick={handleAnalyze} disabled={loading || (!url && !imageBase64)}
              style={{ width: '100%', marginTop: 16, padding: '14px 24px', borderRadius: 12, border: 'none',
                background: (url || imageBase64) ? 'linear-gradient(135deg, #064E49, #0A8F84)' : '#D1D5DB',
                color: '#fff', fontSize: 16, fontWeight: 900, fontFamily: 'Cairo', cursor: (url || imageBase64) ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <><Loader2 size={20} className="animate-spin" /> جاري التحليل العميق...</> : 'ابدأ التحليل العميق'}
            </button>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <XCircle size={20} color="#DC2626" />
            <span style={{ color: '#991B1B', fontSize: 14 }}>{error}</span>
          </div>
        )}

        {/* RESULTS */}
        {result && (
          <>
            {/* New Analysis Button */}
            <div style={{ textAlign: 'center', marginBottom: 24 }} className="no-print">
              <button onClick={() => { setResult(null); setUrl(''); setImageBase64(''); setImagePreview(''); }}
                style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, fontFamily: 'Cairo', cursor: 'pointer' }}>
                تحليل جديد
              </button>
            </div>

            {/* SCORE */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, marginBottom: 24, textAlign: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0B1220', marginBottom: 16 }}>تقييم LinkedIn</h2>
              <ScoreCircle score={result.score} />
              {result.scoreBreakdown && <BreakdownBadges breakdown={result.scoreBreakdown} />}
            </div>

            {/* STRENGTHS / WEAKNESSES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#ECFDF5', borderRadius: 12, padding: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#059669', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={18} /> نقاط القوة
                </h3>
                {result.strengths?.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#065F46', marginBottom: 8, paddingRight: 8, borderRight: '3px solid #059669' }}>{s}</div>
                ))}
              </div>
              <div style={{ background: '#FEF2F2', borderRadius: 12, padding: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#DC2626', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={18} /> نقاط الضعف
                </h3>
                {result.weaknesses?.map((w, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#991B1B', marginBottom: 8, paddingRight: 8, borderRight: '3px solid #DC2626' }}>{w}</div>
                ))}
              </div>
            </div>

            {/* UPGRADE PLAN */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0B1220', marginBottom: 12 }}>خطة التحسين</h2>
              {result.upgradePlan?.headline && <UpgradeSection title="العنوان الوظيفي (Headline)" data={result.upgradePlan.headline} />}
              {result.upgradePlan?.about && <UpgradeSection title="النبذة التعريفية (About)" data={result.upgradePlan.about} />}
              {result.upgradePlan?.experience && <UpgradeSection title="الخبرات المهنية (Experience)" data={result.upgradePlan.experience} />}
            </div>

            {/* MISSING SECTIONS */}
            {result.missingSections && result.missingSections.length > 0 && (
              <div style={{ background: '#FFFBEB', borderRadius: 12, border: '1px solid #FDE68A', padding: 16, marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#92400E', marginBottom: 12 }}>أقسام مفقودة من ملفك</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {result.missingSections.map((s, i) => (
                    <span key={i} style={{ background: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION CHECKLIST */}
            {result.actionChecklist && result.actionChecklist.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0B1220', marginBottom: 8 }}>قائمة المهام</h2>
                <div style={{ background: '#F3F4F6', borderRadius: 8, height: 8, marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #0A8F84, #12B5A8)', borderRadius: 8, width: totalActions > 0 ? (checkedCount / totalActions * 100) + '%' : '0%', transition: 'width 0.3s' }} />
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>أنجزت {checkedCount} من {totalActions}</p>
                {result.actionChecklist.map((item, i) => {
                  const checked = checkedItems[i] || false;
                  const prColor = item.priority === 'high' ? '#DC2626' : item.priority === 'medium' ? '#D97706' : '#059669';
                  const prBg = item.priority === 'high' ? '#FEF2F2' : item.priority === 'medium' ? '#FFFBEB' : '#ECFDF5';
                  const prLabel = item.priority === 'high' ? 'عاجل' : item.priority === 'medium' ? 'متوسط' : 'منخفض';
                  return (
                    <div key={i} onClick={() => setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginBottom: 8, cursor: 'pointer', opacity: checked ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid ' + (checked ? '#0A8F84' : '#D1D5DB'), background: checked ? '#0A8F84' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {checked && <CheckCircle size={14} color="#fff" />}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, color: '#1F2937', textDecoration: checked ? 'line-through' : 'none' }}>{item.action}</span>
                      <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Inter', flexShrink: 0 }}>{item.time}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: prColor, background: prBg, padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>{prLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* RECOMMENDATION TEMPLATE */}
            {result.recommendationTemplate && (
              <div style={{ background: 'linear-gradient(135deg, #064E49, #0A8F84)', borderRadius: 16, padding: 24, marginBottom: 24, color: '#fff' }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>قالب طلب توصية (WhatsApp)</h3>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.8, position: 'relative' }}>
                  {result.recommendationTemplate}
                  <button onClick={() => navigator.clipboard.writeText(result.recommendationTemplate)}
                    style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer' }}>
                    <Copy size={14} color="#fff" />
                  </button>
                </div>
              </div>
            )}

            {/* BANNER DESIGN */}
            {result.bannerDesign && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0B1220', marginBottom: 12 }}>تصميم البانر المقترح</h2>
                <div style={{ background: result.bannerDesign.background || 'linear-gradient(135deg, #064E49, #0A8F84)', borderRadius: 16, padding: '32px 24px', color: '#fff', position: 'relative', overflow: 'hidden', minHeight: 120 }}>
                  <div style={{ position: 'absolute', top: 12, left: 12, opacity: 0.15 }}><WasselLogo size={48} variant="inverted" /></div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{result.bannerDesign.mainText}</h3>
                    <p style={{ fontSize: 14, opacity: 0.85, fontFamily: 'Inter' }}>{result.bannerDesign.tagline}</p>
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, left: 12, width: 40, height: 4, borderRadius: 2, background: result.bannerDesign.accent || '#C9922A' }} />
                </div>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>احفظ هذا التصميم كـ screenshot لاستخدامه كبانر LinkedIn</p>
              </div>
            )}

            {/* PRINT BUTTON */}
            <div style={{ textAlign: 'center', marginTop: 24 }} className="no-print">
              <button onClick={() => window.print()}
                style={{ padding: '12px 32px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, fontFamily: 'Cairo', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Printer size={18} /> طباعة التقرير
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export { ProfileAnalysis };
