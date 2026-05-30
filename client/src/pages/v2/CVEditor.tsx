/**
 * /v2/cvs/:id — Resume v2 editor.
 *
 * Split-view layout:
 *   - Left/top: ResumePreview (the actual structured resume)
 *   - Right/bottom: ATS badge, refinement chips, export buttons,
 *                   "new version for different role" CTA, archive
 *
 * Sub-components are inline (Sprint 3 minimal-touch principle).
 *
 * Refinement state model:
 *   - First 5 per version are free; engine enforces the count.
 *   - On each refine, the engine returns isFreeWindow + remainingFree
 *     so the UI updates instantly without a second roundtrip.
 *
 * Legacy versions render in read-only mode (no refinements, no archive,
 * but exports remain available if there's still a cache_id).
 */

import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  ArrowLeft, Check, RefreshCw, Archive,
  FileText, FileDown, Code, Sparkles, Zap, Database, X, ChevronDown, ChevronUp,
  Briefcase, Award, GraduationCap, Languages,
} from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import { useToast } from '@/lib/v2/toast';
import {
  trpc,
  type ResumeShape,
  type ResumeAtsBreakdownShape,
  type ResumeVersionRow,
} from '@/lib/trpc';

type VersionData = Awaited<ReturnType<typeof trpc.resume.getVersion>>;

const CHIPS: Array<{ chipType: string; section: string; arLabel: string; enLabel: string }> = [
  { chipType: 'shorten_summary',       section: 'summary',    arLabel: 'اجعل الملخص أقصر',         enLabel: 'Shorten Summary' },
  { chipType: 'add_leadership_bullet', section: 'experience', arLabel: 'أضف نقطة عن القيادة',       enLabel: 'Add Leadership Point' },
  { chipType: 'change_opening_verb',   section: 'experience', arLabel: 'بدّل الفعل الافتتاحي',      enLabel: 'Change Opening Verb' },
  { chipType: 'add_quantified',        section: 'experience', arLabel: 'أضف إنجازات بأرقام',         enLabel: 'Add Quantified Achievements' },
  { chipType: 'more_professional',     section: 'summary',    arLabel: 'أكثر احترافية',              enLabel: 'More Professional' },
];

export default function CVEditor() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { showToast } = useToast();
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>('/v2/cvs/:id');
  const versionId = match ? params.id : null;

  const [data, setData] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resume, setResume] = useState<ResumeShape | null>(null);
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [atsBreakdown, setAtsBreakdown] = useState<ResumeAtsBreakdownShape | null>(null);
  const [refinementsUsed, setRefinementsUsed] = useState(0);

  const [refining, setRefining] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | 'json' | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [newVersionSubmitting, setNewVersionSubmitting] = useState(false);

  const [justBuiltInfo, setJustBuiltInfo] = useState<{ isCacheHit: boolean; tokensCharged: number; atsScore: number } | null>(null);

  useEffect(() => {
    if (!versionId) return;
    try {
      const raw = sessionStorage.getItem(`resume.justBuilt.${versionId}`);
      if (raw) {
        setJustBuiltInfo(JSON.parse(raw));
        sessionStorage.removeItem(`resume.justBuilt.${versionId}`);
      }
    } catch { /* ignore */ }
  }, [versionId]);

  useEffect(() => {
    if (!versionId) {
      navigate('/v2/cvs', { replace: true });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  async function load() {
    if (!versionId) return;
    setLoading(true);
    try {
      const d = await trpc.resume.getVersion({ versionId });
      setData(d);
      setRefinementsUsed(d.refinementsUsed ?? 0);
      if (d.cache?.result) {
        setResume(d.cache.result);
        setAtsScore(d.cache.ats_score);
        setAtsBreakdown(d.cache.ats_breakdown as ResumeAtsBreakdownShape);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine(chipType: string, section: string) {
    if (!versionId) return;
    setRefining(chipType);
    setError(null);
    try {
      const out = await trpc.resume.refine({
        versionId,
        chipType,
        targetSection: section,
        language: isAr ? 'ar' : 'en',
      });
      setResume(out.result);
      setAtsScore(out.atsScore);
      setAtsBreakdown(out.atsBreakdown);
      setRefinementsUsed(out.refinementIndex);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(null);
    }
  }

  async function handleRescore() {
    if (!versionId) return;
    setRescoring(true);
    setError(null);
    try {
      const out = await trpc.resume.rescoreVersion({ versionId });
      setAtsScore(out.atsScore);
      setAtsBreakdown(out.atsBreakdown);
      showToast({ message: t('resume.editor.reevaluate.success'), tone: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      showToast({ message: t('resume.editor.reevaluate.error'), description: msg, tone: 'error' });
    } finally {
      setRescoring(false);
    }
  }

  async function handleExport(format: 'pdf' | 'docx' | 'json') {
    if (!versionId) return;
    setExporting(format);
    try {
      const fn = format === 'pdf' ? trpc.resume.exportPdf
               : format === 'docx' ? trpc.resume.exportDocx
               : trpc.resume.exportJson;
      const out = await fn({ versionId });
      const bytes = Uint8Array.from(atob(out.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: out.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  }

  async function handleArchive() {
    if (!versionId) return;
    setArchiving(true);
    try {
      await trpc.resume.archive({ versionId });
      navigate('/v2/cvs');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setArchiving(false);
    }
  }

  async function handleNewVersion() {
    if (!data?.cache?.id || !newRoleInput.trim()) return;
    setNewVersionSubmitting(true);
    setError(null);
    try {
      const out = await trpc.resume.createNewVersion({
        parentCacheId: data.cache.id,
        newTargetRole: newRoleInput.trim(),
        templateId: data.cache.template_id,
        language: isAr ? 'ar' : 'en',
      });
      try {
        sessionStorage.setItem(`resume.justBuilt.${out.versionId}`, JSON.stringify({
          isCacheHit: out.isCacheHit,
          tokensCharged: out.tokensCharged,
          atsScore: out.atsScore,
        }));
      } catch { /* ignore */ }
      navigate(`/v2/cvs/${out.versionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNewVersionSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'السيرة' : 'Resume'}</span>} />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  if (!data || error || !resume) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'السيرة' : 'Resume'}</span>} />
        <div className="flex-1 px-[22px] pt-10">
          <Card padding="lg" radius="lg" className="text-center">
            <Eyebrow className="mb-2 block">RESUME</Eyebrow>
            <h2 className="font-ar text-[18px] font-bold text-v2-ink">
              {error
                ? (isAr ? 'تعذّر تحميل السيرة' : 'Could not load the resume')
                : (isAr ? 'لم نجد هذه السيرة' : 'Resume not found')}
            </h2>
            {error && <p className="mt-2 font-ar text-[12px] text-rose-700">{error}</p>}
            <Button variant="primary" className="mt-5" onClick={() => navigate('/v2/cvs')}>
              {isAr ? 'العودة للقائمة' : 'Back to list'}
            </Button>
          </Card>
        </div>
      </Phone>
    );
  }

  const version = data.version as ResumeVersionRow & { cache_id: string | null };
  const isLegacy = version.status === 'legacy';
  const canRefine = !isLegacy && !!data.cache;
  const canRescore = !isLegacy && !!data.cache;
  const remainingFree = Math.max(0, (data.freeRefinementsPerVersion ?? 5) - refinementsUsed);

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <button
            type="button"
            onClick={() => navigate('/v2/cvs')}
            aria-label={isAr ? 'عودة' : 'Back'}
            className="flex h-9 items-center gap-1 rounded-v2-pill px-2 text-v2-ink hover:bg-v2-canvas-2"
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
            <span className="font-ar text-[14px] font-semibold">{isAr ? 'السير' : 'Resumes'}</span>
          </button>
        }
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        {justBuiltInfo && (
          <div className="mt-4 flex justify-center">
            {justBuiltInfo.isCacheHit ? (
              <span className="inline-flex items-center gap-1.5 rounded-v2-pill bg-emerald-50 px-3 py-1 font-ar text-[12px] font-semibold text-emerald-700 border border-emerald-200">
                <Database size={14} />
                {isAr ? 'من الكاش · 0 توكن' : 'From cache · 0 tokens'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-v2-pill bg-teal-50 px-3 py-1 font-ar text-[12px] font-semibold text-teal-700 border border-teal-200">
                <Zap size={14} />
                {isAr ? <>سيرة جديدة · <NumDisplay>{justBuiltInfo.tokensCharged}</NumDisplay> توكن</> : <>Fresh build · <NumDisplay>{justBuiltInfo.tokensCharged}</NumDisplay> tokens</>}
              </span>
            )}
          </div>
        )}

        <div className="mt-5 lg:mt-2">
          <Eyebrow className="mb-1.5 block">RESUME · {version.target_role.toUpperCase()}</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[22px] lg:text-[28px]">
            {version.display_name}
          </h1>
          <p className="mt-1 font-ar text-[12px] text-v2-mute">
            {version.template_id.replace(/_/g, ' ')} · <NumDisplay>{new Date(version.created_at).toISOString().slice(0, 10)}</NumDisplay>
            {isLegacy && (
              <span className="ms-2 inline-flex items-center rounded-v2-pill bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {isAr ? 'قديمة' : 'legacy'}
              </span>
            )}
          </p>
        </div>

        <div className="mt-5 lg:grid lg:grid-cols-12 lg:gap-6">
          {/* LEFT: Resume preview */}
          <div className="lg:col-span-7">
            <ResumePreview resume={resume} isAr={isAr} />
          </div>

          {/* RIGHT: ATS + chips + exports */}
          <div className="mt-5 flex flex-col gap-4 lg:col-span-5 lg:mt-0">
            {atsScore !== null && atsBreakdown && (
              <AtsScoreCard
                score={atsScore}
                breakdown={atsBreakdown}
                resume={resume}
                isAr={isAr}
                onExpand={() => setAtsModalOpen(true)}
                onRescore={canRescore ? handleRescore : undefined}
                rescoring={rescoring}
                rescoreLabel={t('resume.editor.reevaluate.button')}
                rescoreLoadingLabel={t('resume.editor.reevaluate.loading')}
              />
            )}

            {canRefine && (
              <Card padding="lg" radius="lg">
                <div className="mb-3 flex items-center justify-between">
                  <Eyebrow>{isAr ? 'تحسينات سريعة' : 'Quick Refinements'}</Eyebrow>
                  <span className="font-ar text-[11px] font-semibold text-v2-mute">
                    {remainingFree > 0
                      ? (isAr ? <><NumDisplay>{remainingFree}</NumDisplay>{' '}من{' '}5{' '}مجانية</> : <><NumDisplay>{remainingFree}</NumDisplay>/5 free</>)
                      : (isAr ? <>5{' '}توكن لكل تعديل</> : <>5 tokens each</>)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button
                      key={c.chipType}
                      type="button"
                      onClick={() => handleRefine(c.chipType, c.section)}
                      disabled={refining !== null}
                      className={`rounded-v2-pill border px-3 py-1.5 font-ar text-[12px] font-semibold transition-colors ${
                        refining === c.chipType
                          ? 'border-teal-300 bg-teal-50 text-teal-700'
                          : 'border-v2-line bg-v2-surface text-v2-body hover:bg-v2-canvas-2'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {refining === c.chipType
                        ? (isAr ? '…' : '…')
                        : (isAr ? c.arLabel : c.enLabel)}
                    </button>
                  ))}
                </div>
                {remainingFree === 0 && (
                  <p className="mt-3 font-ar text-[11px] text-v2-mute">
                    {isAr
                      ? 'بعد 5 تحسينات، كل تعديل يكلف 5 توكنات'
                      : 'After 5 refinements, each costs 5 tokens.'}
                  </p>
                )}
              </Card>
            )}

            <Card padding="lg" radius="lg">
              <Eyebrow className="mb-3 block">{isAr ? 'تصدير' : 'Export'}</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" leadingIcon={<FileDown size={14} />}
                  onClick={() => handleExport('pdf')} disabled={!!exporting || !data.cache}>
                  {exporting === 'pdf' ? '…' : 'PDF'}
                </Button>
                <Button variant="secondary" size="sm" leadingIcon={<FileText size={14} />}
                  onClick={() => handleExport('docx')} disabled={!!exporting || !data.cache}>
                  {exporting === 'docx' ? '…' : 'Word'}
                </Button>
                <Button variant="secondary" size="sm" leadingIcon={<Code size={14} />}
                  onClick={() => handleExport('json')} disabled={!!exporting || !data.cache}>
                  {exporting === 'json' ? '…' : 'JSON'}
                </Button>
              </div>
              <p className="mt-3 font-ar text-[11px] text-v2-mute">
                {isAr ? 'كل التصدير مجاني — 0 توكن' : 'All exports are free — 0 tokens'}
              </p>
            </Card>

            {!isLegacy && data.cache && (
              <Card padding="lg" radius="lg" className="bg-teal-50/40 border-teal-100">
                {newVersionOpen ? (
                  <>
                    <Eyebrow className="mb-2 block !text-teal-700">
                      {isAr ? 'نسخة لدور مختلف' : 'New version for a different role'}
                    </Eyebrow>
                    <input
                      type="text"
                      value={newRoleInput}
                      onChange={(e) => setNewRoleInput(e.target.value)}
                      maxLength={120}
                      placeholder={isAr ? 'مثال: Product Manager' : 'e.g. Product Manager'}
                      className="w-full rounded-v2-md border border-v2-line bg-white px-3 py-2 font-ar text-[14px] text-v2-ink"
                    />
                    <p className="mt-2 font-ar text-[11px] text-v2-mute">
                      {isAr ? 'يعيد استخدام خبرتك ويخصّص اللغة — 49 توكن' : 'Reuses your experience, re-tailors the language — 49 tokens.'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="primary" size="sm" onClick={handleNewVersion} disabled={!newRoleInput.trim() || newVersionSubmitting} leadingIcon={<Sparkles size={14} />}>
                        {newVersionSubmitting
                          ? (isAr ? 'جارٍ…' : 'Working…')
                          : (isAr ? 'ابنِ (49 توكن)' : 'Build (49 tokens)')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setNewVersionOpen(false)}>
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variant="primary" size="sm" fullWidth leadingIcon={<RefreshCw size={14} />} onClick={() => { setNewRoleInput(''); setNewVersionOpen(true); }}>
                    {isAr ? 'نسخة لدور مختلف (49 توكن)' : 'New version for a different role (49 tokens)'}
                  </Button>
                )}
              </Card>
            )}

            {!isLegacy && (
              <Button variant="ghost" size="sm" onClick={handleArchive} disabled={archiving} leadingIcon={<Archive size={14} />}>
                {archiving
                  ? (isAr ? 'جارٍ…' : 'Working…')
                  : (isAr ? 'أرشفة' : 'Archive')}
              </Button>
            )}
            {isLegacy && (
              <Card padding="md" radius="md" className="border-amber-200 bg-amber-50">
                <p className="font-ar text-[12px] text-amber-800">
                  {isAr
                    ? 'هذه سيرة قديمة للقراءة فقط. ابدأ نسخة جديدة لتفعيل التحسينات والتخصيص.'
                    : 'Legacy CV — read-only. Start a fresh build to unlock refinements and tailoring.'}
                </p>
                <Button variant="primary" size="sm" className="mt-3" leadingIcon={<Sparkles size={14} />} onClick={() => navigate('/v2/cvs/new')}>
                  {isAr ? 'ابدأ نسخة جديدة' : 'Start a new version'}
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>

      {atsModalOpen && atsBreakdown && atsScore !== null && (
        <AtsModal score={atsScore} breakdown={atsBreakdown} resume={resume} isAr={isAr} onClose={() => setAtsModalOpen(false)} />
      )}
    </Phone>
  );
}

// ─────────────────────────────────────────────
// Sub-components — inline (Sprint 3 minimal-touch principle)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ATS explainability (M2) — every component shows score / what's missing /
// its deterministic point impact. The +impact is ALGORITHMIC (headroom =
// max − value), never AI-authored (#26). Expected = min(95, current + Σ impact).
// ─────────────────────────────────────────────

type AtsComponent = {
  key: 'keywords' | 'sections' | 'format' | 'quantified';
  label: string;
  value: number;
  max: number;
  impact: number;          // points recoverable in this component (max − value)
  missing: string[];       // concrete, deterministic "what's missing" lines
};

const ATS_FORMAT_ISSUE_LABELS: Record<string, { ar: string; en: string }> = {
  long_bullet: { ar: 'نقاط طويلة جداً — اختصرها', en: 'Bullets are too long — shorten them' },
  emoji_in_bullets: { ar: 'إيموجي داخل النقاط — أزلها', en: 'Emojis in bullets — remove them' },
  non_iso_dates: { ar: 'تواريخ بصيغة غير قياسية (YYYY-MM)', en: 'Dates not in standard format (YYYY-MM)' },
  long_summary: { ar: 'الملخص طويل جداً — ركّزه', en: 'Summary is too long — focus it' },
};

/**
 * Derive the 4 ATS components with their missing-items and point impact from
 * the stored breakdown + the resume object. Pure + deterministic (#26).
 */
function computeAtsComponents(breakdown: ResumeAtsBreakdownShape, resume: ResumeShape, isAr: boolean): AtsComponent[] {
  // Sections: which of the 4 required sections are absent (derived from resume).
  const missingSections: string[] = [];
  if (!(resume.summary ?? '').trim()) missingSections.push(isAr ? 'الملخص' : 'Summary');
  if ((resume.experience ?? []).length === 0) missingSections.push(isAr ? 'الخبرة' : 'Experience');
  if ((resume.education ?? []).length === 0) missingSections.push(isAr ? 'التعليم' : 'Education');
  if (((resume.skills?.hard?.length ?? 0) + (resume.skills?.soft?.length ?? 0)) === 0) missingSections.push(isAr ? 'المهارات' : 'Skills');

  const kwMissing = breakdown.missing_keywords.length > 0
    ? [(isAr ? 'كلمات مفقودة: ' : 'Missing keywords: ') + breakdown.missing_keywords.slice(0, 10).join('، ')]
    : [];

  const formatMissing = breakdown.issues.map((i) => (isAr ? ATS_FORMAT_ISSUE_LABELS[i]?.ar : ATS_FORMAT_ISSUE_LABELS[i]?.en) ?? i);

  const quantifiedMissing = breakdown.quantified < 15
    ? [isAr ? 'أضف أرقاماً ونسباً للنقاط بدون قياس' : 'Add numbers and percentages to unquantified bullets']
    : [];

  return [
    { key: 'keywords',   label: isAr ? 'الكلمات المفتاحية' : 'Keywords',               value: breakdown.keywords,   max: 40, impact: 40 - breakdown.keywords,   missing: kwMissing },
    { key: 'sections',   label: isAr ? 'الأقسام' : 'Sections',                          value: breakdown.sections,   max: 25, impact: 25 - breakdown.sections,   missing: missingSections.length ? [(isAr ? 'أقسام ناقصة: ' : 'Missing sections: ') + missingSections.join('، ')] : [] },
    { key: 'format',     label: isAr ? 'التنسيق' : 'Format',                            value: breakdown.format,     max: 20, impact: 20 - breakdown.format,     missing: formatMissing },
    { key: 'quantified', label: isAr ? 'الأرقام والإنجازات' : 'Quantified Achievements', value: breakdown.quantified, max: 15, impact: 15 - breakdown.quantified, missing: quantifiedMissing },
  ];
}

/** Expected ATS once the visible headroom is recovered — capped 95 (R10). */
function expectedAtsScore(score: number, components: AtsComponent[]): number {
  const headroom = components.reduce((acc, c) => acc + Math.max(0, c.impact), 0);
  return Math.min(95, score + headroom);
}

function AtsScoreCard({ score, breakdown, resume, isAr, onExpand, onRescore, rescoring, rescoreLabel, rescoreLoadingLabel }: {
  score: number; breakdown: ResumeAtsBreakdownShape; resume: ResumeShape; isAr: boolean; onExpand: () => void;
  onRescore?: () => void; rescoring?: boolean; rescoreLabel?: string; rescoreLoadingLabel?: string;
}) {
  const value = useMotionValue(0);
  const rounded = useTransform(value, (v) => Math.round(v));
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const unsub = rounded.on('change', (v) => setDisplayed(v));
    const controls = animate(value, score, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return () => { controls.stop(); unsub(); };
  }, [score, value, rounded]);

  const components = computeAtsComponents(breakdown, resume, isAr);
  const expected = expectedAtsScore(score, components);

  const color =
    score >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : score >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-rose-700 bg-rose-50 border-rose-200';

  return (
    <Card padding="lg" radius="lg" elevated>
      <button type="button" onClick={onExpand} className="w-full text-start">
        <div className="flex items-center justify-between">
          <Eyebrow>{isAr ? 'نتيجة ATS' : 'ATS Score'}</Eyebrow>
          <span className="font-ar text-[11px] text-v2-mute">{isAr ? 'اضغط للتفاصيل' : 'tap for details'}</span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className={`inline-flex items-center justify-center rounded-v2-md border px-3 py-1.5 font-en text-[28px] font-bold ${color}`}>
            <NumDisplay>{displayed}</NumDisplay>
            <span className="ms-1 text-[14px] font-semibold text-v2-mute">/ <NumDisplay>100</NumDisplay></span>
          </span>
          <div className="flex flex-col items-end font-ar text-[11px] text-v2-mute">
            <span>K · <NumDisplay>{breakdown.keywords}</NumDisplay>/40</span>
            <span>S · <NumDisplay>{breakdown.sections}</NumDisplay>/25</span>
            <span>F · <NumDisplay>{breakdown.format}</NumDisplay>/20</span>
            <span>Q · <NumDisplay>{breakdown.quantified}</NumDisplay>/15</span>
          </div>
        </div>
        {/* Current → expected, so the number is never a black box (#24). */}
        {expected > score && (
          <p className="mt-2 font-ar text-[12px] text-v2-body">
            {isAr ? 'ATS الحالي' : 'ATS now'} <strong className="font-en"><NumDisplay>{score}</NumDisplay></strong>
            <span className="text-v2-mute"> → </span>
            {isAr ? 'المتوقع' : 'projected'} <strong className="font-en text-teal-700"><NumDisplay>{expected}</NumDisplay></strong>
            <span className="ms-1 text-v2-mute">{isAr ? 'بعد المعالجة' : 'after fixes'}</span>
          </p>
        )}
      </button>
      {onRescore && (
        <button
          type="button"
          onClick={onRescore}
          disabled={rescoring}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-v2-pill border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-semibold text-v2-body transition-colors hover:bg-v2-canvas-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} className={rescoring ? 'animate-spin' : ''} />
          {rescoring ? (rescoreLoadingLabel ?? '…') : (rescoreLabel ?? (isAr ? 'إعادة تقييم' : 'Re-evaluate'))}
        </button>
      )}
    </Card>
  );
}

function AtsModal({ score, breakdown, resume, isAr, onClose }: {
  score: number; breakdown: ResumeAtsBreakdownShape; resume: ResumeShape; isAr: boolean; onClose: () => void;
}) {
  const components = computeAtsComponents(breakdown, resume, isAr);
  const expected = expectedAtsScore(score, components);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center" onClick={onClose}>
      <Card padding="lg" radius="lg" className="max-h-[88vh] w-full max-w-[520px] overflow-y-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-ar text-[18px] font-bold text-v2-ink">
            {isAr ? 'كيف تكوّنت نتيجة ATS' : 'How your ATS score is built'}
          </h3>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {/* Current → expected headline (#24 transparency). */}
        <p className="mb-4 font-ar text-[13px] text-v2-body">
          {isAr ? 'ATS الحالي' : 'ATS now'} <strong className="font-en"><NumDisplay>{score}</NumDisplay></strong>
          <span className="text-v2-mute"> → </span>
          {isAr ? 'المتوقع' : 'projected'} <strong className="font-en text-teal-700"><NumDisplay>{expected}</NumDisplay></strong>
          <span className="ms-1 text-v2-mute">/ <NumDisplay>100</NumDisplay></span>
        </p>

        <div className="grid gap-4">
          {components.map((c) => (
            <BreakdownRow key={c.key} component={c} isAr={isAr} />
          ))}
        </div>

        {breakdown.matched_keywords.length > 0 && (
          <div className="mt-5 text-[12px]">
            <p className="mb-1 font-ar font-semibold text-emerald-700">
              {isAr ? 'كلمات مطابقة' : 'Matched keywords'} · <NumDisplay>{breakdown.matched_keywords.length}</NumDisplay>
            </p>
            <p className="font-en text-v2-body">{breakdown.matched_keywords.slice(0, 12).join(', ')}</p>
          </div>
        )}

        <div className="mt-5 text-center font-ar text-[14px] font-semibold text-v2-ink">
          {isAr ? 'النتيجة الإجمالية' : 'Total'} · <NumDisplay>{score}</NumDisplay> / <NumDisplay>100</NumDisplay>
        </div>
      </Card>
    </div>
  );
}

function BreakdownRow({ component, isAr }: { component: AtsComponent; isAr: boolean }) {
  const { label, value, max, impact, missing } = component;
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between font-ar text-[12px]">
        <span className="font-semibold text-v2-ink">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-v2-mute">
            <NumDisplay>{value}</NumDisplay> / <NumDisplay>{max}</NumDisplay>
          </span>
          {impact > 0 && (
            <span className="rounded-v2-pill bg-emerald-50 px-1.5 py-0.5 font-en text-[10px] font-bold text-emerald-700">
              +<NumDisplay>{impact}</NumDisplay>
            </span>
          )}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-v2-line">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600"
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {/* What's missing in this component — the reason the points aren't full. */}
      {missing.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {missing.map((m, i) => (
            <li key={i} className="flex items-start gap-1.5 font-ar text-[11px] leading-relaxed text-v2-body">
              <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-500" />{m}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 font-ar text-[11px] text-emerald-700">{isAr ? 'مكتمل ✓' : 'Complete ✓'}</p>
      )}
    </div>
  );
}

function ResumePreview({ resume, isAr }: { resume: ResumeShape; isAr: boolean }) {
  const [openExp, setOpenExp] = useState<Record<number, boolean>>({});

  return (
    <Card padding="lg" radius="lg" elevated>
      <div className="border-b border-v2-line pb-3" dir={isAr ? 'rtl' : 'ltr'}>
        <h2 className="font-ar text-[22px] font-bold text-v2-ink">{resume.header.name}</h2>
        <p className="mt-1 font-ar text-[14px] font-semibold text-v2-body">{resume.header.title}</p>
        <p className="mt-1 font-en text-[12px] text-v2-mute">
          {[resume.header.email, resume.header.phone, resume.header.location].filter(Boolean).join(' · ')}
        </p>
      </div>

      {resume.summary && (
        <Section label={isAr ? 'الملخص' : 'Summary'}>
          <p className="font-ar text-[13px] leading-relaxed text-v2-body">{resume.summary}</p>
        </Section>
      )}

      {resume.experience.length > 0 && (
        <Section label={isAr ? 'الخبرة' : 'Experience'} icon={<Briefcase size={14} />}>
          {resume.experience.map((exp, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <button
                type="button"
                onClick={() => setOpenExp((s) => ({ ...s, [idx]: !s[idx] }))}
                className="flex w-full items-start justify-between gap-2 text-start"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-ar text-[13px] font-semibold text-v2-ink">
                    {exp.role} — <span className="text-v2-body">{exp.company}</span>
                  </p>
                  <p className="font-en text-[11px] text-v2-mute">
                    <NumDisplay>{exp.start}</NumDisplay> – <NumDisplay>{exp.end}</NumDisplay>
                    {exp.location ? ` · ${exp.location}` : ''}
                  </p>
                </div>
                {openExp[idx] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {(openExp[idx] ?? true) && exp.bullets.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-1 ps-4 font-ar text-[12px] leading-relaxed text-v2-body">
                  {exp.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {resume.education.length > 0 && (
        <Section label={isAr ? 'التعليم' : 'Education'} icon={<GraduationCap size={14} />}>
          <ul className="space-y-1.5 font-ar text-[12px]">
            {resume.education.map((ed, i) => (
              <li key={i}>
                <span className="font-semibold text-v2-ink">{ed.degree}</span> — {ed.institution}
                {ed.graduated && <span className="font-en text-v2-mute"> (<NumDisplay>{ed.graduated}</NumDisplay>)</span>}
                {ed.honors && <span className="text-v2-mute"> · {ed.honors}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(resume.skills.hard.length > 0 || resume.skills.soft.length > 0) && (
        <Section label={isAr ? 'المهارات' : 'Skills'} icon={<Award size={14} />}>
          {resume.skills.hard.length > 0 && (
            <p className="font-ar text-[12px] text-v2-body">
              <span className="font-semibold">{isAr ? 'تقنية:' : 'Hard:'}</span> {resume.skills.hard.join(', ')}
            </p>
          )}
          {resume.skills.soft.length > 0 && (
            <p className="mt-1 font-ar text-[12px] text-v2-body">
              <span className="font-semibold">{isAr ? 'ناعمة:' : 'Soft:'}</span> {resume.skills.soft.join(', ')}
            </p>
          )}
        </Section>
      )}

      {resume.certifications.length > 0 && (
        <Section label={isAr ? 'الشهادات' : 'Certifications'} icon={<Check size={14} />}>
          <ul className="space-y-1 font-ar text-[12px] text-v2-body">
            {resume.certifications.map((c, i) => (
              <li key={i}>
                <span className="font-semibold">{c.name}</span> — {c.issuer}
                {c.year && <span className="font-en text-v2-mute"> (<NumDisplay>{c.year}</NumDisplay>)</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {resume.languages.length > 0 && (
        <Section label={isAr ? 'اللغات' : 'Languages'} icon={<Languages size={14} />}>
          <p className="font-ar text-[12px] text-v2-body">
            {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(' · ')}
          </p>
        </Section>
      )}
    </Card>
  );
}

function Section({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <Eyebrow>{label}</Eyebrow>
      </div>
      {children}
    </div>
  );
}
