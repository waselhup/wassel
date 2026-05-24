import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, RefreshCw, FileText } from 'lucide-react';
import { trpcQuery, trpcMutation } from '@/lib/trpc';

/**
 * Past Radar analyses — visually mirrors the CV history list on /app/cv.
 * One flex row per analysis: title + score/lang chips on the left, action
 * button strip on the right. Tailwind-only so it fits the V2 chrome on
 * /v2/analyze without dragging in the V1 inline-style soup.
 *
 * Backend (already exists):
 *   - linkedin.listAnalyses → last 50, soft-delete filtered, newest first
 *   - linkedin.exportReport({ analysisId, format }) → base64 file
 *   - linkedin.deleteAnalysis({ id }) → soft delete
 *   - linkedin.getAnalysisById (new this commit) → loads in AnalysisResults
 */

interface RadarHistoryRow {
  id: string;
  linkedin_url: string;
  target_goal: string;
  industry: string;
  language: 'ar' | 'en';
  overall_score: number;
  verdict: string;
  created_at: string;
  parent_analysis_id: string | null;
  is_reanalysis: boolean;
  tokens_used: number;
}

/** Bilingual labels — kept in sync with the GOALS/INDUSTRIES arrays in ProfileInput.tsx. */
const GOAL_LABEL: Record<string, { ar: string; en: string }> = {
  'job-search':         { ar: 'البحث عن وظيفة',  en: 'Job search' },
  'investment':         { ar: 'جذب استثمار',     en: 'Investment' },
  'thought-leadership': { ar: 'قيادة فكرية',     en: 'Thought leadership' },
  'sales-b2b':          { ar: 'مبيعات B2B',      en: 'B2B sales' },
  'career-change':      { ar: 'تغيير المسار',    en: 'Career change' },
  'internal-promotion': { ar: 'ترقية داخلية',    en: 'Internal promotion' },
};

const INDUSTRY_LABEL: Record<string, { ar: string; en: string }> = {
  'oil-gas':          { ar: 'النفط والغاز',  en: 'Oil & gas' },
  'tech':             { ar: 'التقنية',        en: 'Tech' },
  'finance':          { ar: 'المالية',        en: 'Finance' },
  'healthcare':       { ar: 'الرعاية الصحية', en: 'Healthcare' },
  'legal':            { ar: 'القانون',        en: 'Legal' },
  'consulting':       { ar: 'الاستشارات',     en: 'Consulting' },
  'government':       { ar: 'الحكومة',        en: 'Government' },
  'academic':         { ar: 'الأكاديمي',      en: 'Academic' },
  'entrepreneurship': { ar: 'ريادة الأعمال',  en: 'Entrepreneurship' },
  'real-estate':      { ar: 'العقارات',       en: 'Real estate' },
  'other':            { ar: 'مجال آخر',       en: 'Other' },
};

/**
 * Same score → color thresholds as CV's ATS badge so the two histories
 * feel coherent: ≥85 green, ≥70 yellow, ≥50 orange, else rose.
 */
function scoreColorClasses(score: number): { bg: string; text: string } {
  if (score >= 85) return { bg: 'bg-teal-50',    text: 'text-teal-700' };
  if (score >= 70) return { bg: 'bg-amber-50',   text: 'text-amber-700' };
  if (score >= 50) return { bg: 'bg-orange-50',  text: 'text-orange-700' };
  return { bg: 'bg-rose-50',  text: 'text-rose-700' };
}

/** Strip `https://www.linkedin.com/in/` and trailing slash so the row reads cleanly. */
function shortenLinkedInUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/linkedin\.com\/in\//, '')
    .replace(/\/$/, '');
}

/** Western digits in AR (per CLAUDE.md rule 6). */
function formatDate(iso: string, isAr: boolean): string {
  const d = new Date(iso);
  // 'ar-SA-u-nu-latn' forces Latin numerals even on the Arabic locale.
  return d.toLocaleDateString(isAr ? 'ar-SA-u-nu-latn' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function RadarHistory() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [rows, setRows] = useState<RadarHistoryRow[] | null>(null);
  const [busy, setBusy] = useState<Record<string, 'docx' | 'pdf' | 'delete' | null>>({});

  useEffect(() => {
    let cancelled = false;
    trpcQuery<RadarHistoryRow[]>('linkedin.listAnalyses')
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  async function handleDownload(row: RadarHistoryRow, format: 'docx' | 'pdf') {
    setBusy((b) => ({ ...b, [row.id]: format }));
    try {
      const res = await trpcMutation<{ filename: string; mimeType: string; base64: string }>(
        'linkedin.exportReport',
        { analysisId: row.id, format },
      );
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
    } catch (e: any) {
      // DOCX export charges 5 tokens once per row — surface insufficient-token
      // errors. V2 has no toast bus yet, so window.alert is the soft fallback.
      alert(e?.message || t('فشل تصدير التقرير', 'Failed to export report'));
    } finally {
      setBusy((b) => ({ ...b, [row.id]: null }));
    }
  }

  async function handleDelete(row: RadarHistoryRow) {
    if (!window.confirm(t('حذف هذا التحليل؟ لا يمكن استرجاعه', 'Delete this analysis? It cannot be restored.'))) return;
    setBusy((b) => ({ ...b, [row.id]: 'delete' }));
    try {
      await trpcMutation('linkedin.deleteAnalysis', { id: row.id });
      setRows((current) => (current ? current.filter((r) => r.id !== row.id) : current));
    } catch (e: any) {
      alert(e?.message || t('فشل الحذف', 'Failed to delete'));
    } finally {
      setBusy((b) => ({ ...b, [row.id]: null }));
    }
  }

  // ─── render ─────────────────────────────────────────────────────────────

  // Match the CV history's Section wrapper visual (white card, teal icon
  // chip, bold title) without pulling in V1 styles. The Card-like shell is
  // hand-built in Tailwind so we stay in the V2 design system.
  const header = (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-v2-md bg-teal-50 text-teal-700">
        <FileText size={16} />
      </div>
      <div className="font-ar text-[16px] font-bold text-v2-ink">
        {t('تحاليلك السابقة', 'Your Previous Analyses')}
      </div>
    </div>
  );

  if (rows === null) {
    return (
      <div className="rounded-v2-lg border border-v2-line bg-v2-surface p-5 shadow-card">
        {header}
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-v2-lg border border-v2-line bg-v2-surface p-5 shadow-card">
        {header}
        <div className="py-10 text-center">
          <FileText size={32} className="mx-auto mb-3 text-v2-mute opacity-40" aria-hidden />
          <div className="font-ar text-[15px] font-bold text-v2-ink">
            {t('لم تُجرِ أي تحليل بعد', 'No analyses yet')}
          </div>
          <div className="mt-1.5 font-ar text-[13px] text-v2-dim">
            {t('ابدأ تحليلك الأول من النموذج بالأعلى', 'Follow the steps above to run your first analysis.')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-v2-lg border border-v2-line bg-v2-surface p-5 shadow-card">
      {header}

      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const goal = GOAL_LABEL[row.target_goal];
          const industry = INDUSTRY_LABEL[row.industry];
          const sc = scoreColorClasses(row.overall_score);
          const busyState = busy[row.id];

          // The title shown on the left of each row. Prefer the goal label
          // (e.g. "Job search"); fall back to the LinkedIn handle if the goal
          // enum is missing. The second line carries the chips/metadata.
          const headlineLabel = goal ? (isAr ? goal.ar : goal.en) : shortenLinkedInUrl(row.linkedin_url);
          const subtitleBits = [
            shortenLinkedInUrl(row.linkedin_url),
            industry ? (isAr ? industry.ar : industry.en) : null,
            formatDate(row.created_at, isAr),
          ].filter(Boolean);

          return (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3.5 rounded-v2-md border border-v2-line bg-v2-surface p-3.5"
            >
              {/* Left: title + chips */}
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2 font-ar text-[14px] font-bold text-v2-ink">
                  <span>{headlineLabel}</span>

                  {row.overall_score > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-v2-pill px-2 py-0.5 font-en text-[11px] font-bold tabular-nums ${sc.bg} ${sc.text}`}
                      aria-label={t(`النتيجة ${row.overall_score} من 100`, `Score ${row.overall_score} of 100`)}
                    >
                      {row.overall_score}
                    </span>
                  )}

                  {row.is_reanalysis && (
                    <span className="rounded-v2-pill bg-teal-50 px-2 py-0.5 font-ar text-[10px] font-semibold text-teal-700">
                      {t('إعادة تحليل', 'Re-analysis')}
                    </span>
                  )}

                  <span className="rounded-v2-pill border border-v2-line bg-v2-canvas-2 px-2 py-0.5 font-en text-[10px] uppercase tracking-wider text-v2-body">
                    {row.language}
                  </span>
                </div>

                <div
                  className="mt-1 font-ar text-[12px] text-v2-dim"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  {subtitleBits.map((bit, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1.5">·</span>}
                      <span className={i === 0 ? 'font-en' : ''}>{bit}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: action buttons strip — same visual rhythm as CV history. */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDownload(row, 'docx')}
                  disabled={!!busyState}
                  className="inline-flex items-center gap-1 rounded-v2-sm border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-semibold text-v2-body hover:bg-v2-canvas-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={12} />
                  {busyState === 'docx' ? t('جارٍ…', '…') : 'DOCX'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(row, 'pdf')}
                  disabled={!!busyState}
                  className="inline-flex items-center gap-1 rounded-v2-sm border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-semibold text-v2-body hover:bg-v2-canvas-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={12} />
                  {busyState === 'pdf' ? t('جارٍ…', '…') : 'PDF'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/v2/analyze/result/${row.id}`)}
                  className="inline-flex items-center gap-1 rounded-v2-sm border border-v2-line bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-semibold text-v2-body hover:bg-v2-canvas-2"
                >
                  <RefreshCw size={12} />
                  {t('إعادة إنشاء', 'Regenerate')}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  disabled={!!busyState}
                  className="inline-flex items-center gap-1 rounded-v2-sm border border-rose-200 bg-v2-surface px-3 py-1.5 font-ar text-[12px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={12} />
                  {busyState === 'delete' ? t('جارٍ…', '…') : t('حذف', 'Delete')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
