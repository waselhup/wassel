import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Link as LinkIcon, AlertCircle, Check, X, Info,
  FileDown, FileText, ChevronDown, ChevronUp, Trash2, GitCompare,
  Target, Building2, Globe, ExternalLink, Zap, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { trpcMutation, trpcQuery } from '../lib/trpc';
import { validateAndNormalizeLinkedInUrl } from '../lib/linkedin-url-validator';

type TargetGoal = 'job-search' | 'investment' | 'thought-leadership' | 'sales-b2b' | 'career-change' | 'internal-promotion';
type Industry = 'oil-gas' | 'tech' | 'finance' | 'healthcare' | 'legal' | 'consulting' | 'government' | 'academic' | 'entrepreneurship' | 'real-estate' | 'other';
type ReportLang = 'ar' | 'en';

interface Dim { name: string; score: number | null; feedback: string }
interface Analysis {
  overall_score: number;
  confidence?: 'high' | 'medium' | 'low';
  data_quality?: 'rich' | 'adequate' | 'thin' | 'insufficient';
  data_completeness?: number;
  verdict: string;
  dimensions?: Dim[];
  target_alignment?: { goal_match_score?: number; notes?: string };
  recommendations?: string[];
  vision_2030_alignment?: string | null;
  top_3_priorities?: string[];
  evidence_used?: string[];
}

interface HistoryItem {
  id: string;
  linkedin_url: string | null;
  target_goal: string;
  industry: string;
  language: string;
  overall_score: number;
  verdict: string;
  created_at: string;
}

interface CompareResult {
  older: { id: string; score: number; date: string };
  newer: { id: string; score: number; date: string };
  overallDelta: number;
  dimensionChanges: { name: string; before: number; after: number; delta: number; status: string }[];
  summary: { improved: number; declined: number; unchanged: number };
  improvedAreas: { name: string; delta: number }[];
  stillNeedsWork: string[];
}

const GOALS: TargetGoal[] = ['job-search', 'investment', 'thought-leadership', 'sales-b2b', 'career-change', 'internal-promotion'];
const GOAL_ICONS: Record<TargetGoal, string> = {
  'job-search': '🎯',
  'investment': '🚀',
  'thought-leadership': '💼',
  'sales-b2b': '🤝',
  'career-change': '📚',
  'internal-promotion': '👔',
};

const INDUSTRIES: Industry[] = ['oil-gas', 'tech', 'finance', 'healthcare', 'legal', 'consulting', 'government', 'academic', 'entrepreneurship', 'real-estate', 'other'];

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

function gradientFor(score: number): string {
  if (score >= 75) return 'linear-gradient(90deg, #14b8a6, #0d9488)';
  if (score >= 50) return 'linear-gradient(90deg, #C9922A, #F59E0B)';
  return 'linear-gradient(90deg, #DC2626, #F43F5E)';
}

function scoreColor(s: number): string {
  if (s >= 7) return '#16a34a';
  if (s >= 5) return '#ca8a04';
  return '#dc2626';
}

export default function ProfileAnalysis() {
  const { t, i18n } = useTranslation();
  const { push, View: Toasts } = useToast();
  const isRTL = i18n.language === 'ar';

  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlErrorSuggestion, setUrlErrorSuggestion] = useState<string | null>(null);
  const [goal, setGoal] = useState<TargetGoal | null>(null);
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [language, setLanguage] = useState<ReportLang>(isRTL ? 'ar' : 'en');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [showHelper, setShowHelper] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx(i => (i + 1) % 6);
    }, 2800);
    return () => clearInterval(interval);
  }, [loading]);

  async function loadHistory() {
    try {
      const data = await trpcQuery<HistoryItem[]>('linkedin.listAnalyses');
      setHistory(data || []);
    } catch (e: any) {
      console.error('[history]', e);
    }
  }

  function handleUrlBlur() {
    if (!url.trim()) { setUrlError(null); return; }
    const r = validateAndNormalizeLinkedInUrl(url);
    if (!r.valid) {
      setUrlError(i18n.language === 'ar' ? (r.errorMessageAr || '') : (r.errorMessageEn || ''));
      setUrlErrorSuggestion(r.suggestion || null);
    } else {
      setUrlError(null);
      setUrlErrorSuggestion(null);
      setUrl(r.normalizedUrl || url);
    }
  }

  const dnaScore = useMemo(() => {
    let s = 0;
    if (url.trim() && !urlError) s += 30;
    if (goal) s += 25;
    if (industry) s += 25;
    if (language) s += 10;
    if (targetRole.trim() || targetCompany.trim()) s += 10;
    return s;
  }, [url, urlError, goal, industry, language, targetRole, targetCompany]);

  const canGenerate = !!url.trim() && !urlError && !!goal && !!industry && !loading;

  async function handleGenerate() {
    if (!canGenerate) return;
    setLoading(true);
    setAnalysis(null);
    setAnalysisId(null);
    setCompareResult(null);
    try {
      const res = await trpcMutation<{ id: string; analysis: Analysis; linkedinUrl: string; tokensUsed: number }>('linkedin.analyzeTargeted', {
        linkedinUrl: url,
        targetGoal: goal,
        industry,
        targetRole: targetRole.trim() || undefined,
        targetCompany: targetCompany.trim() || undefined,
        reportLanguage: language,
      });
      setAnalysis(res.analysis);
      setAnalysisId(res.id);
      push('success', i18n.language === 'ar' ? 'تم التحليل' : 'Analysis complete');
      loadHistory();
    } catch (e: any) {
      push('error', e?.message || (i18n.language === 'ar' ? 'فشل التحليل' : 'Analysis failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: 'pdf' | 'docx') {
    if (!analysisId) return;
    setExporting(format);
    try {
      const res = await trpcMutation<{ filename: string; mimeType: string; base64: string }>('linkedin.exportReport', {
        analysisId,
        format,
      });
      const bytes = atob(res.base64);
      const array = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
      const blob = new Blob([array], { type: res.mimeType });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(dlUrl);
      push('success', i18n.language === 'ar' ? 'تم التحميل' : 'Downloaded');
    } catch (e: any) {
      push('error', e?.message || (i18n.language === 'ar' ? 'فشل التحميل' : 'Export failed'));
    } finally {
      setExporting(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) {
        push('info', t('profileRadar.history.compareMax'));
        return prev;
      }
      return [...prev, id];
    });
  }

  async function handleCompare() {
    if (selectedIds.length !== 2) return;
    setComparing(true);
    try {
      const sorted = [...selectedIds].sort((a, b) => {
        const da = history.find(h => h.id === a)?.created_at || '';
        const db = history.find(h => h.id === b)?.created_at || '';
        return new Date(da).getTime() - new Date(db).getTime();
      });
      const res = await trpcQuery<CompareResult>('linkedin.compareAnalyses', {
        olderId: sorted[0],
        newerId: sorted[1],
      });
      setCompareResult(res);
    } catch (e: any) {
      push('error', e?.message || (i18n.language === 'ar' ? 'فشل المقارنة' : 'Compare failed'));
    } finally {
      setComparing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('profileRadar.history.confirmDelete'))) return;
    try {
      await trpcMutation('linkedin.deleteAnalysis', { id });
      setSelectedIds(prev => prev.filter(x => x !== id));
      loadHistory();
    } catch (e: any) {
      push('error', e?.message || 'Failed');
    }
  }

  const loadingMessages: string[] = t('profileRadar.generate.loadingMessages', { returnObjects: true }) as any;
  const loadingMsg = Array.isArray(loadingMessages) ? loadingMessages[loadingMsgIdx] : (i18n.language === 'ar' ? 'نحلل بروفايلك...' : 'Analyzing...');

  return (
    <DashboardLayout>
      <Toasts />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', fontFamily: 'Cairo, Inter, sans-serif' }}>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, background: 'linear-gradient(90deg, #14b8a6, #0d9488)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('profileRadar.title')}
          </h1>
          <p style={{ color: '#64748b', marginTop: 6, fontSize: 15 }}>{t('profileRadar.subtitle')}</p>
        </motion.div>

        {/* URL Input Card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
              <LinkIcon size={16} /> {t('profileRadar.url.label')}
            </label>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowHelper(s => !s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#14b8a6', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                <Info size={16} />
              </button>
              {showHelper && (
                <div style={{
                  position: 'absolute', top: '100%', insetInlineEnd: 0, marginTop: 8,
                  width: 320, padding: 16, background: 'white', border: '1px solid #e5e7eb',
                  borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 10, fontSize: 13,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{t('profileRadar.url.helperTitle')}</div>
                  <ol style={{ paddingInlineStart: 20, margin: 0, lineHeight: 1.8 }}>
                    <li>{t('profileRadar.url.helperStep1')}</li>
                    <li>{t('profileRadar.url.helperStep2')}</li>
                    <li>{t('profileRadar.url.helperStep3')}</li>
                    <li>{t('profileRadar.url.helperStep4')}</li>
                  </ol>
                  <a href="https://www.linkedin.com/in/me/" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: '#14b8a6', fontWeight: 700, textDecoration: 'none' }}>
                    {t('profileRadar.url.openLinkedIn')} <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(null); setUrlErrorSuggestion(null); }}
            onBlur={handleUrlBlur}
            placeholder={t('profileRadar.url.placeholder')}
            dir="ltr"
            style={{
              width: '100%', padding: '12px 14px', fontSize: 14, border: `1px solid ${urlError ? '#fca5a5' : '#e5e7eb'}`,
              borderRadius: 10, outline: 'none', fontFamily: 'inherit', background: urlError ? '#fef2f2' : 'white',
            }}
          />
          {urlError && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <div style={{ color: '#991b1b', fontSize: 13, fontWeight: 700 }}>{urlError}</div>
              {urlErrorSuggestion && <div style={{ color: '#7f1d1d', fontSize: 12, marginTop: 4 }}>{urlErrorSuggestion}</div>}
            </div>
          )}
        </motion.div>

        {/* Goal Selector */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={16} /> {t('profileRadar.goal.label')}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{t('profileRadar.goal.hint')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOALS.map(g => {
              const active = goal === g;
              return (
                <button key={g} onClick={() => setGoal(g)}
                  style={{
                    padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    background: active ? 'linear-gradient(90deg, #14b8a6, #0d9488)' : '#f8fafc',
                    color: active ? 'white' : '#334155', border: `1px solid ${active ? 'transparent' : '#e5e7eb'}`,
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                  }}>
                  <span>{GOAL_ICONS[g]}</span>
                  {t(`profileRadar.goal.${g}`)}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Industry Selector */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} /> {t('profileRadar.industry.label')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INDUSTRIES.map(ind => {
              const active = industry === ind;
              return (
                <button key={ind} onClick={() => setIndustry(ind)}
                  style={{
                    padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: active ? '#14b8a6' : '#f8fafc', color: active ? 'white' : '#334155',
                    border: `1px solid ${active ? 'transparent' : '#e5e7eb'}`, transition: 'all 0.2s',
                  }}>
                  {t(`profileRadar.industry.${ind}`)}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Language Selector */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} /> {t('profileRadar.language.label')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['ar', 'en'] as ReportLang[]).map(lang => {
              const active = language === lang;
              return (
                <button key={lang} onClick={() => setLanguage(lang)}
                  style={{
                    padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    background: active ? 'linear-gradient(90deg, #14b8a6, #0d9488)' : '#f8fafc',
                    color: active ? 'white' : '#334155', border: `1px solid ${active ? 'transparent' : '#e5e7eb'}`,
                    minWidth: 140,
                  }}>
                  {lang === 'ar' ? '🇸🇦 ' : '🇬🇧 '}{t(`profileRadar.language.${lang}`)}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Advanced Options */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <button onClick={() => setShowAdvanced(s => !s)}
            style={{
              width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#1f2937',
            }}>
            <span>{showAdvanced ? t('profileRadar.advanced.collapse') : t('profileRadar.advanced.toggle')}</span>
            {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showAdvanced && (
            <div className="pra-advanced-grid" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  {t('profileRadar.advanced.targetRole')}
                </label>
                <input type="text" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
                  placeholder={t('profileRadar.advanced.targetRoleHint')}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  {t('profileRadar.advanced.targetCompany')}
                </label>
                <input type="text" value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder={t('profileRadar.advanced.targetCompanyHint')}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }} />
              </div>
            </div>
          )}
        </motion.div>

        {/* DNA Card */}
        {(url.trim() || goal || industry) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: 16, padding: 20, border: '1px solid #fde68a', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#78350f', marginBottom: 4 }}>{t('profileRadar.dna.title')}</div>
            <div style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>{t('profileRadar.dna.subtitle')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#78350f' }}>
                <div style={{ opacity: 0.7 }}>{t('profileRadar.dna.url')}</div>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{url ? (url.match(/in\/([^/?]+)/)?.[1] || '—') : '—'}</div>
              </div>
              <div style={{ fontSize: 12, color: '#78350f' }}>
                <div style={{ opacity: 0.7 }}>{t('profileRadar.dna.goal')}</div>
                <div style={{ fontWeight: 700 }}>{goal ? t(`profileRadar.goal.${goal}`) : '—'}</div>
              </div>
              <div style={{ fontSize: 12, color: '#78350f' }}>
                <div style={{ opacity: 0.7 }}>{t('profileRadar.dna.industry')}</div>
                <div style={{ fontWeight: 700 }}>{industry ? t(`profileRadar.industry.${industry}`) : '—'}</div>
              </div>
              <div style={{ fontSize: 12, color: '#78350f' }}>
                <div style={{ opacity: 0.7 }}>{t('profileRadar.dna.language')}</div>
                <div style={{ fontWeight: 700 }}>{t(`profileRadar.language.${language}`)}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#78350f', marginBottom: 4 }}>{t('profileRadar.dna.score')}: {dnaScore}%</div>
              <div style={{ height: 6, background: '#fef3c7', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${dnaScore}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #d97706)', transition: 'width 0.3s' }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Generate Button */}
        <motion.button
          whileHover={canGenerate ? { scale: 1.01 } : {}}
          whileTap={canGenerate ? { scale: 0.99 } : {}}
          disabled={!canGenerate}
          onClick={handleGenerate}
          style={{
            width: '100%', padding: '16px 24px', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: canGenerate ? 'pointer' : 'not-allowed',
            background: canGenerate ? 'linear-gradient(90deg, #14b8a6, #0d9488)' : '#cbd5e1',
            color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: canGenerate ? '0 8px 24px rgba(10, 143, 132, 0.3)' : 'none', marginBottom: 24,
          }}>
          {loading ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                <Sparkles size={20} />
              </motion.div>
              {loadingMsg}
            </>
          ) : (
            <>
              <Zap size={20} />
              {t('profileRadar.generate.buttonTokens', { tokens: 25 })}
            </>
          )}
        </motion.button>

        {/* Result */}
        <AnimatePresence>
          {analysis && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24 }}>

              {/* Confidence banner — shown when low/medium confidence */}
              {analysis.confidence && analysis.confidence !== 'high' && (
                <div style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  background: analysis.confidence === 'low' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${analysis.confidence === 'low' ? '#fecaca' : '#fde68a'}`,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                }}>
                  <AlertCircle size={18} style={{ color: analysis.confidence === 'low' ? '#dc2626' : '#d97706', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: analysis.confidence === 'low' ? '#991b1b' : '#92400e', marginBottom: 2 }}>
                      {analysis.confidence === 'low'
                        ? (i18n.language === 'ar' ? 'ثقة منخفضة في التحليل' : 'Low-confidence analysis')
                        : (i18n.language === 'ar' ? 'ثقة متوسطة' : 'Medium confidence')}
                    </div>
                    <div style={{ color: analysis.confidence === 'low' ? '#7f1d1d' : '#78350f', lineHeight: 1.5 }}>
                      {i18n.language === 'ar'
                        ? `بيانات البروفايل ${typeof analysis.data_completeness === 'number' ? analysis.data_completeness : ''}% مكتملة — التوصيات أدناه قد تكون عامة. أكمل بروفايلك للحصول على تحليل أعمق.`
                        : `Profile data ${typeof analysis.data_completeness === 'number' ? analysis.data_completeness + '%' : ''} complete — recommendations below may be generic. Complete your profile for deeper analysis.`}
                    </div>
                  </div>
                </div>
              )}

              {/* Overall Score */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{t('profileRadar.result.score')}</div>
                <div style={{ fontSize: 'clamp(48px, 12vw, 64px)', fontWeight: 900, lineHeight: 1, background: gradientFor(analysis.overall_score), WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {analysis.overall_score}
                  <span style={{ fontSize: 'clamp(18px, 5vw, 24px)', color: '#94a3b8', WebkitTextFillColor: '#94a3b8' }}>/100</span>
                </div>
              </div>

              {/* Verdict */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>{t('profileRadar.result.verdict')}</div>
                <div style={{ fontSize: 15, lineHeight: 1.7, color: '#1f2937' }}>{analysis.verdict}</div>
              </div>

              {/* Top 3 Priorities */}
              {analysis.top_3_priorities && analysis.top_3_priorities.length > 0 && (
                <div style={{ marginBottom: 24, padding: 16, background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: 12, border: '1px solid #fbbf24' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#78350f', marginBottom: 10 }}>🎯 {t('profileRadar.result.topPriorities')}</div>
                  <ol style={{ paddingInlineStart: 20, margin: 0 }}>
                    {analysis.top_3_priorities.map((p, i) => (
                      <li key={i} style={{ fontSize: 14, color: '#78350f', marginBottom: 8, lineHeight: 1.6 }}>{p}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Dimensions */}
              {analysis.dimensions && analysis.dimensions.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#334155', marginBottom: 12 }}>{t('profileRadar.result.dimensions')}</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {analysis.dimensions.map((d, i) => {
                      const noData = d.score === null || d.score === undefined;
                      return (
                        <div key={i} style={{ padding: 14, background: noData ? '#f8fafc' : '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb', opacity: noData ? 0.7 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, color: '#1f2937', fontSize: 14 }}>{d.name}</span>
                            {noData ? (
                              <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: 12 }}>
                                {i18n.language === 'ar' ? 'لا توجد بيانات' : 'No data'}
                              </span>
                            ) : (
                              <span style={{ fontWeight: 800, color: scoreColor(d.score!), fontSize: 14 }}>{d.score}/10</span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{d.feedback}</div>
                          {!noData && (
                            <div style={{ height: 4, background: '#e2e8f0', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
                              <div style={{ width: `${d.score! * 10}%`, height: '100%', background: scoreColor(d.score!) }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#334155', marginBottom: 12 }}>{t('profileRadar.result.recommendations')}</div>
                  <ul style={{ paddingInlineStart: 20, margin: 0 }}>
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} style={{ fontSize: 14, color: '#1f2937', marginBottom: 8, lineHeight: 1.6 }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Vision 2030 */}
              {analysis.vision_2030_alignment && (
                <div style={{ marginBottom: 24, padding: 16, background: '#f0fdfa', borderRadius: 12, border: '1px solid #99f6e4' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f766e', marginBottom: 8 }}>🇸🇦 {t('profileRadar.result.vision2030')}</div>
                  <div style={{ fontSize: 14, color: '#0f766e', lineHeight: 1.6 }}>{analysis.vision_2030_alignment}</div>
                </div>
              )}

              {/* Export Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}
                  style={{
                    flex: 1, minWidth: 180, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    background: 'white', color: '#14b8a6', border: '2px solid #14b8a6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <FileDown size={18} />
                  {exporting === 'pdf' ? '...' : t('profileRadar.result.exportPdf')}
                </button>
                <button onClick={() => handleExport('docx')} disabled={exporting === 'docx'}
                  style={{
                    flex: 1, minWidth: 180, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    background: 'linear-gradient(90deg, #14b8a6, #0d9488)', color: 'white', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <FileText size={18} />
                  {exporting === 'docx' ? '...' : t('profileRadar.result.exportDocx')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1f2937' }}>{t('profileRadar.history.title')}</div>
              {selectedIds.length === 2 && (
                <button onClick={handleCompare} disabled={comparing}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    background: 'linear-gradient(90deg, #14b8a6, #0d9488)', color: 'white', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <GitCompare size={14} />
                  {comparing ? '...' : t('profileRadar.history.compareButton', { count: selectedIds.length })}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{t('profileRadar.history.selectToCompare')}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(h => {
                const selected = selectedIds.includes(h.id);
                return (
                  <div key={h.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10,
                      background: selected ? '#f0fdfa' : '#f8fafc', border: `1px solid ${selected ? '#5eead4' : '#e5e7eb'}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleSelect(h.id)}>
                    <input type="checkbox" checked={selected} readOnly style={{ width: 18, height: 18, accentColor: '#14b8a6' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                        {new Date(h.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        {' — '}
                        <span style={{ color: scoreColor(h.overall_score / 10) }}>{h.overall_score}/100</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {t(`profileRadar.goal.${h.target_goal}`)} · {t(`profileRadar.industry.${h.industry}`)} · {h.language.toUpperCase()}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(h.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 6 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Comparison Result */}
        <AnimatePresence>
          {compareResult && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#1f2937' }}>{t('profileRadar.comparison.title')}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('profileRadar.comparison.subtitle')}</div>
                </div>
                <button onClick={() => { setCompareResult(null); setSelectedIds([]); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('profileRadar.comparison.before')}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#64748b' }}>{compareResult.older.score}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(compareResult.older.date).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 900, color: compareResult.overallDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                  {compareResult.overallDelta >= 0 ? '+' : ''}{compareResult.overallDelta}
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{t('profileRadar.comparison.points')}</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, background: '#f0fdfa', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: '#0f766e' }}>{t('profileRadar.comparison.after')}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#14b8a6' }}>{compareResult.newer.score}</div>
                  <div style={{ fontSize: 11, color: '#0f766e' }}>{new Date(compareResult.newer.date).toLocaleDateString()}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                <div style={{ padding: 10, background: '#dcfce7', borderRadius: 8, textAlign: 'center' }}>
                  <TrendingUp size={16} style={{ color: '#16a34a', margin: '0 auto' }} />
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{compareResult.summary.improved}</div>
                  <div style={{ fontSize: 11, color: '#15803d' }}>{t('profileRadar.comparison.improved')}</div>
                </div>
                <div style={{ padding: 10, background: '#f1f5f9', borderRadius: 8, textAlign: 'center' }}>
                  <Minus size={16} style={{ color: '#64748b', margin: '0 auto' }} />
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#64748b' }}>{compareResult.summary.unchanged}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{t('profileRadar.comparison.unchanged')}</div>
                </div>
                <div style={{ padding: 10, background: '#fee2e2', borderRadius: 8, textAlign: 'center' }}>
                  <TrendingDown size={16} style={{ color: '#dc2626', margin: '0 auto' }} />
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{compareResult.summary.declined}</div>
                  <div style={{ fontSize: 11, color: '#991b1b' }}>{t('profileRadar.comparison.declined')}</div>
                </div>
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 10 }}>{t('profileRadar.comparison.dimensionsTable')}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {compareResult.dimensionChanges.map((c, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ textAlign: 'center', color: '#64748b' }}>{c.before}/10</div>
                    <div style={{ textAlign: 'center', fontWeight: 700, color: scoreColor(c.after) }}>{c.after}/10</div>
                    <div style={{ textAlign: 'center', fontWeight: 700, color: c.delta > 0 ? '#16a34a' : c.delta < 0 ? '#dc2626' : '#64748b' }}>
                      {c.delta > 0 ? '+' : ''}{c.delta}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </DashboardLayout>
  );
}
