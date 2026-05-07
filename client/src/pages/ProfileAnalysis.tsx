import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Link as LinkIcon, AlertCircle, Check, X, Info,
  FileText, ChevronDown, ChevronUp, Trash2, GitCompare,
  Target, Building2, Globe, ExternalLink, Zap, TrendingUp, TrendingDown, Minus,
  Type, Briefcase, Award, GraduationCap, Users, CheckCircle2,
  UserCircle, List as ListIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { trpcMutation, trpcQuery, trpc } from '../lib/trpc';
import { validateAndNormalizeLinkedInUrl } from '../lib/linkedin-url-validator';
import {
  ScoreRing, SectionList, SectionDetailPanel, ProfilePreviewCard,
  deriveStatus, type SectionView,
} from '../components/profile-analysis';

type TargetGoal = 'job-search' | 'investment' | 'thought-leadership' | 'sales-b2b' | 'career-change' | 'internal-promotion';
type Industry = 'oil-gas' | 'tech' | 'finance' | 'healthcare' | 'legal' | 'consulting' | 'government' | 'academic' | 'entrepreneurship' | 'real-estate' | 'other';
type ReportLang = 'ar' | 'en';
type FrameworkId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
type SectionKey = 'headline' | 'about' | 'experience' | 'skills' | 'education' | 'recommendations' | 'activity' | 'profile_completeness';

// v6 — 8 sections
interface Section {
  key: SectionKey | string;
  name_ar?: string;
  name_en?: string;
  score: number | null;
  assessment?: string;
  current?: string;
  suggested?: string;
  why?: string;
  framework?: FrameworkId | null;
  framework_label?: string | null;
  effort?: 'quick' | 'moderate' | 'deep';
}

// v5 legacy (kept so historical rows still render)
interface Observation {
  what: string;
  why?: string;
  citation?: string;
  impact?: 'high' | 'medium' | 'low';
}
interface Recommendation {
  current?: string;
  suggested?: string;
  rationale?: string;
  effort?: 'quick' | 'moderate' | 'deep';
}
interface Dim {
  name: string;
  score: number | null;
  framework?: FrameworkId;
  framework_label?: string | null;
  observations?: Observation[];
  recommendations?: Recommendation[];
  feedback?: string;
}
interface TopPriority {
  rank?: number;
  action: string;
  // v6
  section_key?: SectionKey | string | null;
  // v5 legacy
  dimension?: string;
  framework?: FrameworkId | null;
  framework_label?: string | null;
  expected_impact?: string;
}
interface EvidenceBundle {
  profile_quotes_used?: string[];
  frameworks_referenced?: string[];
  missing_data_flags?: string[];
}
interface Analysis {
  overall_score: number;
  confidence?: 'high' | 'medium' | 'low';
  data_completeness?: number;
  verdict: string;
  target_alignment?: { goal_match_score?: number; notes?: string };
  // v6
  sections?: Section[];
  // v5 legacy
  dimensions?: Dim[];
  top_priorities?: TopPriority[];
  evidence_bundle?: EvidenceBundle;
  // legacy fields
  recommendations?: string[];
  top_3_priorities?: string[];
}

// Lightweight summary of the unifiedProfile — surfaced so the UI can render
// the new side-panel sections (honors, certs, langs, top skills, flags).
// Server-populated only when LinkdAPI returns data; BD profiles will have
// honors/flags empty or missing.
interface ProfileSummary {
  top_skills?: string[];
  certifications?: Array<{ name: string; issuer?: string }>;
  languages?: Array<{ name: string; proficiency?: string }>;
  honors_and_awards?: Array<{ title: string; issuer?: string; issued_on?: string }>;
  flags?: {
    isOpenToWork?: boolean;
    isPremium?: boolean;
    isCreator?: boolean;
    isInfluencer?: boolean;
    isHiring?: boolean;
  } | null;
  // Additive fields from Commit #1 (feat/api). Pre-Commit #1 server rows
  // don't send these, so every property is optional and the UI falls back
  // to '' / [] before rendering.
  fullName?: string;
  headline?: string;
  about?: string;
  location?: string;
  profilePicture?: string;
  bannerImage?: string;
  industry?: string;
  experience?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
    startYear?: string;
    endYear?: string;
  }>;
}

const SECTION_ICON: Record<string, LucideIcon> = {
  headline: Type,
  about: Info,
  experience: Briefcase,
  skills: Award,
  education: GraduationCap,
  recommendations: Users,
  activity: TrendingUp,
  profile_completeness: CheckCircle2,
};

const SECTION_EDIT_PATH: Record<SectionKey, string> = {
  headline: 'intro',
  about: 'about',
  experience: 'experience',
  skills: 'skills',
  education: 'education',
  recommendations: 'recommendations',
  activity: 'recent-activity',
  profile_completeness: '',
};

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
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif', fontWeight: 700, fontSize: 13,
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

function scoreColor100(s: number): string {
  if (s >= 70) return '#16a34a';
  if (s >= 50) return '#ca8a04';
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
  const [customIndustry, setCustomIndustry] = useState('');
  const [customIndustryError, setCustomIndustryError] = useState<string | null>(null);
  const [language, setLanguage] = useState<ReportLang>(isRTL ? 'ar' : 'en');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [showHelper, setShowHelper] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  // Inline error — shown above the form. Distinct codes get friendly copy.
  const [analysisError, setAnalysisError] = useState<{
    kind: 'not_found' | 'insufficient_data' | 'generic';
    message: string;
    requestedSlug?: string | null;
    completeness?: number | null;
  } | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const [exporting, setExporting] = useState<'docx' | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [balanceStamp, setBalanceStamp] = useState<string | null>(null);

  // Split-view state. selectedSectionKey === null → list view (rail shows
  // score + list). When set, the rail shows the detail panel for that key
  // and the list is hidden until the user hits Back or Esc.
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(null);
  // Tracks whether the mobile bottom sheet is open. Desktop ignores this.
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  // Tracks viewport so we can switch between split view and bottom sheet
  // without server-side rendering assumptions.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    loadHistory();
    refreshBalance();
  }, []);

  async function refreshBalance() {
    try {
      const b = await trpc.token.getMyBalance();
      setLiveBalance(typeof b?.balance === 'number' ? b.balance : null);
      setBalanceStamp(b?.serverTimestamp || null);
    } catch (e: any) {
      console.error('[balance]', e);
    }
  }

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

  const trimmedCustom = customIndustry.trim();
  const customIndustryReady = industry !== 'other' || (trimmedCustom.length >= 2 && trimmedCustom.length <= 60);
  const canGenerate = !!url.trim() && !urlError && !!goal && !!industry && customIndustryReady && !loading;

  async function handleGenerate() {
    if (!canGenerate) return;
    if (industry === 'other' && trimmedCustom.length < 2) {
      setCustomIndustryError(i18n.language === 'ar' ? 'اكتب مجالك أولاً' : 'Please enter your industry first');
      return;
    }
    setLoading(true);
    setAnalysis(null);
    setAnalysisId(null);
    setProfileSummary(null);
    setCompareResult(null);
    setAnalysisError(null);
    try {
      const res = await trpcMutation<{ id: string; analysis: Analysis; linkedinUrl: string; tokensUsed: number }>('linkedin.analyzeTargeted', {
        linkedinUrl: url,
        targetGoal: goal,
        industry,
        customIndustryLabel: industry === 'other' ? trimmedCustom : undefined,
        targetRole: targetRole.trim() || undefined,
        targetCompany: targetCompany.trim() || undefined,
        reportLanguage: language,
      });
      setAnalysis(res.analysis);
      setAnalysisId(res.id);
      setProfileSummary((res as any).profileSummary || null);
      setSelectedSectionKey(null);
      setMobileSheetOpen(false);
      push('success', i18n.language === 'ar' ? 'تم التحليل' : 'Analysis complete');
      loadHistory();
      refreshBalance();
    } catch (e: any) {
      // Refresh balance so the user sees the authoritative value on any error,
      // especially "insufficient tokens" — prevents false positives.
      refreshBalance();
      // Distinguish NOT_FOUND and BAD_REQUEST/insufficient_data so the UI can
      // show a specific inline error instead of a toast.
      const code: string = e?.data?.code || e?.code || '';
      const msg: string = e?.message || (i18n.language === 'ar' ? 'فشل التحليل' : 'Analysis failed');
      const slugMatch = msg.match(/\(([a-z0-9-]{2,})\)/i);
      const completenessMatch = msg.match(/\((\d{1,3})%\)/);
      if (code === 'NOT_FOUND') {
        setAnalysisError({ kind: 'not_found', message: msg, requestedSlug: slugMatch ? slugMatch[1] : null });
      } else if (code === 'BAD_REQUEST' && completenessMatch) {
        setAnalysisError({ kind: 'insufficient_data', message: msg, completeness: parseInt(completenessMatch[1], 10) });
      } else {
        setAnalysisError({ kind: 'generic', message: msg });
        push('error', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!analysisId) return;
    setExporting('docx');
    try {
      const res = await trpcMutation<{ filename: string; mimeType: string; base64: string }>('linkedin.exportReport', {
        analysisId,
        format: 'docx',
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
      <div style={{ maxWidth: analysis ? 1280 : 1100, margin: '0 auto', padding: '24px 16px', fontFamily: '"Thmanyah Sans", system-ui, sans-serif', transition: 'max-width 300ms ease' }}>

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
                <button key={ind} onClick={() => {
                  setIndustry(ind);
                  if (ind !== 'other') {
                    setCustomIndustry('');
                    setCustomIndustryError(null);
                  }
                }}
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
          {industry === 'other' && (
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                {i18n.language === 'ar' ? 'ما هو مجالك؟' : 'What is your industry?'}
              </label>
              <input
                type="text"
                value={customIndustry}
                onChange={(e) => {
                  setCustomIndustry(e.target.value);
                  if (customIndustryError) setCustomIndustryError(null);
                }}
                maxLength={60}
                placeholder={i18n.language === 'ar' ? 'اكتب مجالك هنا...' : 'Enter your industry...'}
                dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: 14,
                  border: `1px solid ${customIndustryError ? '#fca5a5' : '#e5e7eb'}`,
                  borderRadius: 10,
                  outline: 'none',
                  fontFamily: 'inherit',
                  background: customIndustryError ? '#fef2f2' : 'white',
                  transition: 'all 0.15s',
                }}
                onFocus={(e) => { if (!customIndustryError) e.currentTarget.style.borderColor = '#14b8a6'; }}
                onBlur={(e) => { if (!customIndustryError) e.currentTarget.style.borderColor = '#e5e7eb'; }}
              />
              {customIndustryError && (
                <div style={{ marginTop: 6, color: '#991b1b', fontSize: 12, fontWeight: 600 }}>
                  {customIndustryError}
                </div>
              )}
            </div>
          )}
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

        {/* Live balance badge — authoritative server-side value. Refreshed
            on mount and after every generate attempt so the user can trust it. */}
        {liveBalance !== null && (() => {
          const cost = 25;
          const enough = liveBalance >= cost;
          return (
            <div style={{
              marginBottom: 10, padding: '10px 14px',
              background: enough ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${enough ? '#a7f3d0' : '#fecaca'}`,
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} style={{ color: enough ? '#065f46' : '#991b1b' }} />
                <span style={{ color: enough ? '#065f46' : '#991b1b', fontWeight: 700 }}>
                  {i18n.language === 'ar'
                    ? `رصيدك: ${liveBalance} توكن • التحليل يحتاج ${cost}`
                    : `Your balance: ${liveBalance} tokens • Analysis needs ${cost}`}
                </span>
              </div>
              <button onClick={refreshBalance} title={balanceStamp || ''}
                style={{ background: 'transparent', border: 'none', color: enough ? '#065f46' : '#991b1b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {i18n.language === 'ar' ? 'تحديث' : 'Refresh'}
              </button>
            </div>
          );
        })()}

        {/* Inline analysis error — shown above the Generate button so the user
            sees it even without scrolling. No tokens are charged for errors
            that happen before deduction (invalid URL, not found, insufficient data). */}
        {analysisError && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 16, padding: 16,
              background: analysisError.kind === 'not_found' ? '#fef2f2' : analysisError.kind === 'insufficient_data' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${analysisError.kind === 'not_found' ? '#fca5a5' : analysisError.kind === 'insufficient_data' ? '#fcd34d' : '#fca5a5'}`,
              borderRadius: 12,
            }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <AlertCircle size={20} style={{
                color: analysisError.kind === 'not_found' ? '#dc2626' : analysisError.kind === 'insufficient_data' ? '#d97706' : '#dc2626',
                flexShrink: 0, marginTop: 2,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: analysisError.kind === 'insufficient_data' ? '#92400e' : '#991b1b', marginBottom: 4 }}>
                  {analysisError.kind === 'not_found'
                    ? (i18n.language === 'ar' ? 'لم نعثر على هذا البروفايل' : 'We couldn\'t find this profile')
                    : analysisError.kind === 'insufficient_data'
                    ? (i18n.language === 'ar' ? 'بيانات البروفايل غير كافية' : 'Not enough profile content')
                    : (i18n.language === 'ar' ? 'فشل التحليل' : 'Analysis failed')}
                </div>
                <div style={{ fontSize: 13, color: analysisError.kind === 'insufficient_data' ? '#78350f' : '#7f1d1d', lineHeight: 1.55 }}>
                  {analysisError.message}
                </div>
                {analysisError.kind === 'not_found' && analysisError.requestedSlug && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                    {i18n.language === 'ar' ? 'الرابط المطلوب:' : 'Requested profile:'} <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb' }}>linkedin.com/in/{analysisError.requestedSlug}</code>
                  </div>
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '4px 10px', borderRadius: 999, background: '#ecfdf5', border: '1px solid #86efac', fontSize: 11, fontWeight: 700, color: '#166534' }}>
                  <Check size={12} />
                  {i18n.language === 'ar' ? 'لم يتم خصم أي نقاط' : 'No tokens were charged'}
                  {typeof liveBalance === 'number' && (
                    <span style={{ color: '#0f766e' }}>· {liveBalance}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setAnalysisError(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                <X size={16} />
              </button>
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

        {/* === PROFILE ANALYSIS SPLIT VIEW RESULT (v1) === */}
        <AnimatePresence>
          {analysis && profileSummary && (() => {
            const sections = Array.isArray(analysis.sections) ? analysis.sections : [];
            const profile = {
              fullName: profileSummary.fullName || '',
              headline: profileSummary.headline || '',
              about: profileSummary.about || '',
              location: profileSummary.location || '',
              profilePicture: profileSummary.profilePicture || '',
              bannerImage: profileSummary.bannerImage || '',
              industry: profileSummary.industry || '',
              experience: (profileSummary.experience || []).map((e) => ({
                title: e.title || '',
                company: e.company || '',
                location: e.location || '',
                startDate: e.startDate || '',
                endDate: e.endDate || '',
                description: e.description || '',
              })),
              education: (profileSummary.education || []).map((ed) => ({
                school: ed.school || '',
                degree: ed.degree || '',
                field: ed.field || '',
                startYear: ed.startYear || '',
                endYear: ed.endYear || '',
              })),
              top_skills: profileSummary.top_skills || [],
              certifications: profileSummary.certifications || [],
              languages: profileSummary.languages || [],
              honors_and_awards: profileSummary.honors_and_awards || [],
              flags: profileSummary.flags || null,
            };

            const slug = (() => {
              const m = String(url || '').match(/linkedin\.com\/in\/([^/?#]+)/i);
              return m ? m[1] : '';
            })();
            const editPathFor = (key: string) => SECTION_EDIT_PATH[key as SectionKey] || '';

            const sectionViews: SectionView[] = sections.map((s) => {
              const key = String(s.key);
              const name = i18n.language === 'ar'
                ? (s.name_ar || t(`profileRadar.sections.names.${key}`, { defaultValue: key }))
                : (s.name_en || t(`profileRadar.sections.names.${key}`, { defaultValue: key }));
              const description = t(`profileAnalysis.sectionDescriptions.${key}`, { defaultValue: '' });
              const checklist: string[] = [];
              if (s.current) checklist.push(t('profileAnalysis.checklistCurrent'));
              if (s.suggested) checklist.push(t('profileAnalysis.checklistSuggested'));
              if (s.framework) checklist.push(t('profileAnalysis.checklistFramework', { fw: s.framework }));
              const editUrl = (s.score === null || s.score === undefined) && slug && editPathFor(key)
                ? `https://www.linkedin.com/in/${slug}/edit/${editPathFor(key)}/`
                : undefined;
              return {
                key,
                name,
                icon: SECTION_ICON[key] || UserCircle,
                score: typeof s.score === 'number' ? s.score : null,
                status: deriveStatus(typeof s.score === 'number' ? s.score : null),
                framework: s.framework || undefined,
                frameworkLabel: s.framework_label || undefined,
                effort: s.effort,
                description: description || (i18n.language === 'ar'
                  ? 'قسم مهم في بروفايلك — راجع الملاحظات أدناه.'
                  : 'An important section of your profile — review the notes below.'),
                verdict: s.assessment,
                currentText: s.current,
                suggestedText: s.suggested,
                why: s.why,
                checklist: checklist.length ? checklist : undefined,
                editUrl,
              };
            });

            const activeIndex = selectedSectionKey === null
              ? null
              : Math.max(0, sectionViews.findIndex((v) => v.key === selectedSectionKey));
            const activeSection = activeIndex !== null && activeIndex >= 0 ? sectionViews[activeIndex] : null;

            const goPrev = () => {
              if (activeIndex === null || sectionViews.length === 0) return;
              const next = (activeIndex - 1 + sectionViews.length) % sectionViews.length;
              setSelectedSectionKey(sectionViews[next].key);
            };
            const goNext = () => {
              if (activeIndex === null || sectionViews.length === 0) return;
              const next = (activeIndex + 1) % sectionViews.length;
              setSelectedSectionKey(sectionViews[next].key);
            };
            const back = () => {
              setSelectedSectionKey(null);
              setMobileSheetOpen(false);
            };
            const onSelectIndex = (index: number) => {
              setSelectedSectionKey(sectionViews[index].key);
            };

            const copyToClipboard = (text: string) => {
              navigator.clipboard?.writeText(text);
              push('success', t('profileAnalysis.copied'));
            };

            const detailLabels = {
              backToList: t('profileAnalysis.backToList'),
              prev: t('profileAnalysis.prev'),
              next: t('profileAnalysis.next'),
              sectionCounter: t('profileAnalysis.sectionCounter', { current: (activeIndex ?? 0) + 1, total: sectionViews.length }),
              lookingGood: t('profileAnalysis.lookingGood'),
              needsImprovement: t('profileAnalysis.needsImprovement'),
              opportunity: t('profileAnalysis.opportunity'),
              noFeedback: t('profileAnalysis.noFeedback'),
              openOnLinkedIn: t('profileAnalysis.openOnLinkedIn'),
              currentLabel: t('profileAnalysis.currentLabel'),
              suggestedLabel: t('profileAnalysis.suggestedLabel'),
              checklist: t('profileAnalysis.checklist'),
              moreInfo: t('profileAnalysis.moreInfo'),
              copy: t('profileAnalysis.copy'),
              copied: t('profileAnalysis.copied'),
            };

            const previewLabels = {
              verdictTitle: t('profileAnalysis.verdictTitle'),
              aboutTitle: t('profileAnalysis.aboutTitle'),
              experienceTitle: t('profileAnalysis.experienceTitle'),
              educationTitle: t('profileAnalysis.educationTitle'),
              topSkillsTitle: t('profileAnalysis.topSkillsTitle'),
              certificationsTitle: t('profileAnalysis.certificationsTitle'),
              languagesTitle: t('profileAnalysis.languagesTitle'),
              honorsTitle: t('profileAnalysis.honorsTitle'),
              flagOpenToWork: t('profileRadar.flags.openToWork'),
              flagHiring: t('profileRadar.flags.hiring'),
              flagPremium: t('profileRadar.flags.premium'),
              flagCreator: t('profileRadar.flags.creator'),
            };

            const detailEl = activeSection ? (
              <SectionDetailPanel
                section={activeSection}
                index={activeIndex ?? 0}
                total={sectionViews.length}
                isRTL={isRTL}
                labels={detailLabels}
                onBack={back}
                onPrev={goPrev}
                onNext={goNext}
                onCopy={copyToClipboard}
              />
            ) : null;

            const listEl = (
              <SectionList
                sections={sectionViews}
                activeIndex={activeIndex}
                isRTL={isRTL}
                onSelect={onSelectIndex}
              />
            );

            return (
              <motion.div
                key="split-view-result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                style={{ marginBottom: 24 }}
              >
                {/* Export button — floated above the split view so it's
                    reachable without scrolling through the whole preview. */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button onClick={() => handleExport()} disabled={exporting === 'docx'}
                    style={{
                      padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      cursor: exporting === 'docx' ? 'wait' : 'pointer',
                      background: 'linear-gradient(90deg, #14b8a6, #0d9488)',
                      color: 'white', border: 'none',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                    <FileText size={16} />
                    {exporting === 'docx' ? '...' : t('profileRadar.result.exportReport')}
                  </button>
                </div>

                {/* DESKTOP SPLIT VIEW. On tablet (~640-1024px), the rail
                    drops below the main via a media query applied on the
                    wrapping class. On mobile (<640px) the rail is hidden
                    and replaced by a FAB + bottom sheet. */}
                <div
                  className="pra-split"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
                    gap: 24,
                    alignItems: 'start',
                  }}
                >
                  {/* MAIN COLUMN: profile preview. */}
                  <div style={{ minWidth: 0 }}>
                    <ProfilePreviewCard
                      profile={profile}
                      verdict={analysis.verdict}
                      isRTL={isRTL}
                      labels={previewLabels}
                    />
                  </div>

                  {/* RIGHT RAIL: score + list OR detail. Hidden on mobile. */}
                  {!isMobile && (
                    <aside
                      style={{
                        position: 'sticky',
                        top: 16,
                        maxHeight: 'calc(100vh - 32px)',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      {selectedSectionKey === null && (
                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 16,
                            padding: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                          }}
                          aria-label={`Wassel Score: ${analysis.overall_score} out of 100`}
                        >
                          <ScoreRing score={analysis.overall_score} size={128} label={t('profileAnalysis.wasselScore')} />
                        </div>
                      )}

                      <AnimatePresence mode="wait" initial={false}>
                        {selectedSectionKey === null ? (
                          <motion.div
                            key="list"
                            initial={{ opacity: 0, x: isRTL ? -16 : 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRTL ? 16 : -16 }}
                            transition={{ duration: 0.25 }}
                          >
                            {listEl}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="detail"
                            initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRTL ? -16 : 16 }}
                            transition={{ duration: 0.25 }}
                          >
                            {detailEl}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </aside>
                  )}
                </div>

                {/* MOBILE: FAB + bottom sheet (below 640px only). */}
                {isMobile && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMobileSheetOpen(true)}
                      style={{
                        position: 'fixed',
                        insetInlineEnd: 16,
                        bottom: 16,
                        zIndex: 40,
                        padding: '14px 22px',
                        borderRadius: 999,
                        border: 'none',
                        background: 'linear-gradient(90deg, #14b8a6, #0d9488)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 14,
                        fontFamily: 'inherit',
                        boxShadow: '0 12px 30px rgba(14, 165, 149, 0.35)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <ListIcon size={16} />
                      {t('profileAnalysis.wasselScore')} · {analysis.overall_score}
                    </button>

                    <AnimatePresence>
                      {mobileSheetOpen && (
                        <>
                          <motion.div
                            key="sheet-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.55 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileSheetOpen(false)}
                            style={{
                              position: 'fixed', inset: 0, background: '#0f172a', zIndex: 50,
                            }}
                          />
                          <motion.div
                            key="sheet"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'tween', duration: 0.3 }}
                            style={{
                              position: 'fixed',
                              left: 0, right: 0, bottom: 0,
                              zIndex: 51,
                              background: '#f8fafc',
                              borderTopLeftRadius: 20,
                              borderTopRightRadius: 20,
                              maxHeight: '85vh',
                              overflowY: 'auto',
                              padding: 16,
                              boxShadow: '0 -20px 40px rgba(0,0,0,0.15)',
                            }}
                          >
                            <div style={{
                              width: 40, height: 4, background: '#cbd5e1',
                              borderRadius: 999, margin: '0 auto 12px',
                            }} />
                            {selectedSectionKey === null ? (
                              <>
                                <div style={{
                                  background: '#ffffff', border: '1px solid #e5e7eb',
                                  borderRadius: 16, padding: 16, marginBottom: 14,
                                  display: 'flex', justifyContent: 'center',
                                }}>
                                  <ScoreRing score={analysis.overall_score} size={96} label={t('profileAnalysis.wasselScore')} />
                                </div>
                                {listEl}
                              </>
                            ) : (
                              detailEl
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.div>
            );
          })()}
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
                        <span style={{ color: scoreColor100(h.overall_score) }}>{h.overall_score}/100</span>
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
                {compareResult.dimensionChanges.map((c, i) => {
                  const displayName = t(`profileRadar.dimensions_map.${c.name}`, { defaultValue: String(c.name) });
                  // After P0-A, new schema uses 0-100; legacy rows may use 0-10.
                  const scale = c.after > 10 || c.before > 10 ? 100 : 10;
                  const colorFn = scale === 100 ? scoreColor100 : (s: number) => scoreColor100(s * 10);
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{displayName}</div>
                      <div style={{ textAlign: 'center', color: '#64748b' }}>{c.before}/{scale}</div>
                      <div style={{ textAlign: 'center', fontWeight: 700, color: colorFn(c.after) }}>{c.after}/{scale}</div>
                      <div style={{ textAlign: 'center', fontWeight: 700, color: c.delta > 0 ? '#16a34a' : c.delta < 0 ? '#dc2626' : '#64748b' }}>
                        {c.delta > 0 ? '+' : ''}{c.delta}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </DashboardLayout>
  );
}
