/**
 * /v2/cvs/diagnose — FREE ATS diagnostic (M3 "Outputs").
 *
 * Mirrors the Radar free-diagnostic / locked pattern for resumes:
 *   - The DIAGNOSTIC is free (0 tokens): a full 4-component ATS read
 *     (keywords / sections / format / quantified), a current → expected
 *     projection, and an internal target-profile benchmark. All numbers are
 *     deterministic (#26) — there is no model call on this path.
 *   - The OUTPUT (a tailored resume + PDF/DOCX + chosen template + selection
 *     reason + alternatives) stays LOCKED behind the 179-token build. The
 *     unlock card sells "+النقاط", never "a resume".
 *
 * Two entry paths:
 *   B) Score my LinkedIn profile  → 0 tokens, instant.
 *   A) Upload my CV               → parsed client-side (document.parse, 0 AI)
 *      then scored deterministically.
 *
 * #24 transparency: every number shows where it comes from. The benchmark
 * explicitly claims NO external market data — it's an internal reference.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  FileText, Linkedin, Upload, Sparkles, Target, ArrowLeft, AlertCircle, CheckCircle2,
} from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Skeleton from '@/components/v2/Skeleton';
import NumDisplay from '@/components/v2/NumDisplay';
import { trpc, type ResumeDiagnosticShape, type ResumeAtsBreakdownShape } from '@/lib/trpc';

type PreflightShape = Awaited<ReturnType<typeof trpc.resume.preflight>>;

const ATS_FORMAT_ISSUE_LABELS: Record<string, { ar: string; en: string }> = {
  long_bullet: { ar: 'نقاط طويلة جداً — اختصرها', en: 'Bullets are too long — shorten them' },
  emoji_in_bullets: { ar: 'إيموجي داخل النقاط — أزلها', en: 'Emojis in bullets — remove them' },
  non_iso_dates: { ar: 'تواريخ بصيغة غير قياسية (YYYY-MM)', en: 'Dates not in standard format (YYYY-MM)' },
  long_summary: { ar: 'الملخص طويل جداً — ركّزه', en: 'Summary is too long — focus it' },
};

type Comp = { key: string; label: string; value: number; max: number; impact: number; missing: string[] };

function deriveComponents(breakdown: ResumeAtsBreakdownShape, isAr: boolean): Comp[] {
  const kwMissing = breakdown.missing_keywords.length > 0
    ? [(isAr ? 'كلمات مفقودة: ' : 'Missing keywords: ') + breakdown.missing_keywords.slice(0, 10).join('، ')]
    : [];
  const formatMissing = breakdown.issues.map((i) => (isAr ? ATS_FORMAT_ISSUE_LABELS[i]?.ar : ATS_FORMAT_ISSUE_LABELS[i]?.en) ?? i);
  const quantifiedMissing = breakdown.quantified < 15
    ? [isAr ? 'أضف أرقاماً ونسباً للنقاط بدون قياس' : 'Add numbers and percentages to unquantified bullets']
    : [];
  const sectionsMissing = breakdown.sections < 25
    ? [isAr ? 'بعض الأقسام الأساسية ناقصة' : 'Some core sections are missing']
    : [];
  return [
    { key: 'keywords', label: isAr ? 'الكلمات المفتاحية' : 'Keywords', value: breakdown.keywords, max: 40, impact: 40 - breakdown.keywords, missing: kwMissing },
    { key: 'sections', label: isAr ? 'الأقسام' : 'Sections', value: breakdown.sections, max: 25, impact: 25 - breakdown.sections, missing: sectionsMissing },
    { key: 'format', label: isAr ? 'التنسيق' : 'Format', value: breakdown.format, max: 20, impact: 20 - breakdown.format, missing: formatMissing },
    { key: 'quantified', label: isAr ? 'الأرقام والإنجازات' : 'Quantified Achievements', value: breakdown.quantified, max: 15, impact: 15 - breakdown.quantified, missing: quantifiedMissing },
  ];
}

export default function CVDiagnostic() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();

  const [pre, setPre] = useState<PreflightShape | null>(null);
  const [preLoading, setPreLoading] = useState(true);
  const [result, setResult] = useState<ResumeDiagnosticShape | null>(null);
  const [running, setRunning] = useState<null | 'linkedin' | 'upload'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await trpc.resume.preflight({ language: isAr ? 'ar' : 'en' });
        setPre(data);
        if (!data.profile) navigate('/v2/onboarding', { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPreLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runLinkedin() {
    setRunning('linkedin');
    setError(null);
    try {
      const out = await trpc.resume.diagnose({ language: isAr ? 'ar' : 'en' });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  async function runUpload(file: File) {
    setRunning('upload');
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      // Extract text client-side via the existing 0-token document parser.
      const parsed = await trpc.document.parse({ fileBase64: base64, fileName: file.name, mimeType: file.type || 'application/octet-stream' });
      if (!parsed.text || parsed.text.trim().length < 40) {
        throw new Error(isAr ? 'تعذّر قراءة نص كافٍ من الملف' : 'Could not read enough text from the file.');
      }
      const out = await trpc.resume.diagnose({
        language: isAr ? 'ar' : 'en',
        upload: { text: parsed.text, filename: file.name },
      });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  function goBuild() {
    // The diagnostic sells the points → the locked 179 build is the output.
    const templateId = pre?.recommendedTemplate?.id;
    const params = new URLSearchParams();
    if (templateId) params.set('template', templateId);
    params.set('lang', isAr ? 'ar' : 'en');
    navigate(`/v2/cvs/building?${params.toString()}`);
  }

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <button
            type="button"
            onClick={() => navigate('/v2/cvs/new')}
            aria-label={isAr ? 'عودة' : 'Back'}
            className="flex h-9 items-center gap-1 rounded-v2-pill px-2 text-v2-ink hover:bg-v2-canvas-2"
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
            <span className="font-ar text-[14px] font-semibold">{isAr ? 'السيرة' : 'Resume'}</span>
          </button>
        }
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        <div className="mt-5 mb-6 lg:mt-2">
          <Eyebrow className="mb-1.5 block">{isAr ? 'تشخيص ATS' : 'ATS DIAGNOSTIC'}</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[32px]">
            {t('resume.diagnostic.title', isAr ? 'شخّص سيرتك مجاناً' : 'Diagnose your resume — free')}
          </h1>
          <p className="mt-2 font-ar text-[13px] text-v2-body leading-relaxed">
            {t('resume.diagnostic.subtitle', isAr
              ? 'احصل على تقييم ATS كامل بأربعة مكوّنات — بدون أي نقطة. ثم قرّر إن أردت بناء السيرة الكاملة.'
              : 'Get a full 4-component ATS read — at zero tokens. Then decide whether to build the full resume.')}
          </p>
        </div>

        {error && (
          <Card padding="md" radius="md" className="mb-4 border-rose-200 bg-rose-50">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="font-ar text-[13px] text-rose-800">{error}</p>
            </div>
          </Card>
        )}

        {preLoading ? (
          <><Skeleton variant="card" className="mb-4" /><Skeleton variant="card" /></>
        ) : !result ? (
          <SourcePicker
            isAr={isAr}
            running={running}
            hasLinkedin={Boolean(pre?.profile?.linkedin_url)}
            onLinkedin={runLinkedin}
            onUpload={runUpload}
          />
        ) : (
          <DiagnosticResultView
            isAr={isAr}
            result={result}
            onBuild={goBuild}
            onReset={() => setResult(null)}
          />
        )}
      </div>
    </Phone>
  );
}

function SourcePicker({ isAr, running, hasLinkedin, onLinkedin, onUpload }: {
  isAr: boolean;
  running: null | 'linkedin' | 'upload';
  hasLinkedin: boolean;
  onLinkedin: () => void;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="grid gap-4">
      {/* Path B — LinkedIn */}
      <Card padding="lg" radius="lg" elevated>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Linkedin size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-ar text-[15px] font-bold text-v2-ink">
              {isAr ? 'قيّم ملفي على LinkedIn' : 'Score my LinkedIn profile'}
            </h3>
            <p className="mt-1 font-ar text-[12px] text-v2-body leading-relaxed">
              {isAr ? 'نقيس ملفك الحالي كأنه سيرة ذاتية — 0 نقطة، فوري.' : 'We measure your profile as-if a resume — 0 tokens, instant.'}
            </p>
            <Button
              variant="primary" size="md" className="mt-3"
              leadingIcon={<Sparkles size={16} />}
              onClick={onLinkedin}
              disabled={!hasLinkedin || running !== null}
            >
              {running === 'linkedin'
                ? (isAr ? 'جارٍ التشخيص…' : 'Diagnosing…')
                : (isAr ? 'شخّص الآن (0 نقطة)' : 'Diagnose now (0 tokens)')}
            </Button>
            {!hasLinkedin && (
              <p className="mt-2 font-ar text-[11px] text-amber-700">
                {isAr ? 'أضف رابط LinkedIn في بروفايلك المهني أولاً.' : 'Add your LinkedIn URL in your career profile first.'}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Path A — Upload */}
      <Card padding="lg" radius="lg">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-v2-canvas-2 text-v2-body">
            <Upload size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-ar text-[15px] font-bold text-v2-ink">
              {isAr ? 'ارفع سيرتي الحالية' : 'Upload my current CV'}
            </h3>
            <p className="mt-1 font-ar text-[12px] text-v2-body leading-relaxed">
              {isAr ? 'PDF أو Word — نشخّصها بنفس المقياس، 0 نقطة.' : 'PDF or Word — diagnosed on the same ruler, 0 tokens.'}
            </p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-v2-pill border border-v2-line bg-v2-surface px-4 py-2 font-ar text-[13px] font-semibold text-v2-body hover:bg-v2-canvas-2">
              <FileText size={15} />
              {running === 'upload'
                ? (isAr ? 'جارٍ التشخيص…' : 'Diagnosing…')
                : (isAr ? 'اختر ملفاً' : 'Choose a file')}
              <input
                type="file"
                accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                disabled={running !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DiagnosticResultView({ isAr, result, onBuild, onReset }: {
  isAr: boolean;
  result: ResumeDiagnosticShape;
  onBuild: () => void;
  onReset: () => void;
}) {
  const components = deriveComponents(result.atsBreakdown, isAr);
  const delta = Math.max(0, result.expectedScore - result.atsScore);
  const b = result.benchmark;

  return (
    <div className="grid gap-4">
      {/* Header: current → expected (+delta) — the number is never a black box (#24). */}
      <Card padding="lg" radius="lg" elevated className="bg-gradient-to-br from-teal-50 to-white border-teal-100">
        <Eyebrow className="text-teal-700">{isAr ? 'نتيجة ATS الحالية' : 'Current ATS score'}</Eyebrow>
        <div className="mt-2 flex items-end gap-4">
          <div className="flex items-baseline gap-1">
            <NumDisplay className="text-[44px] font-bold leading-none text-v2-ink">{result.atsScore}</NumDisplay>
            <span className="font-ar text-[13px] text-v2-dim">/ 100</span>
          </div>
          {result.expectedScore > result.atsScore && (
            <>
              <span className="pb-1 text-[22px] text-v2-mute">→</span>
              <div className="flex items-baseline gap-1">
                <NumDisplay className="text-[36px] font-bold leading-none text-teal-700">{result.expectedScore}</NumDisplay>
                <span className="font-ar text-[12px] text-v2-dim">{isAr ? 'المتوقع' : 'projected'}</span>
              </div>
            </>
          )}
        </div>
        {delta > 0 && (
          <p className="mt-2 font-ar text-[13px] font-semibold text-teal-700">
            +<NumDisplay>{delta}</NumDisplay> {isAr ? 'نقطة بعد بناء السيرة المخصّصة' : 'points after the tailored build'}
          </p>
        )}
        <p className="mt-1 font-ar text-[11px] text-v2-mute">
          {result.source === 'linkedin'
            ? (isAr ? 'محسوبة من ملفك على LinkedIn' : 'Computed from your LinkedIn profile')
            : (isAr ? 'محسوبة من السيرة التي رفعتها' : 'Computed from your uploaded CV')}
        </p>
      </Card>

      {/* The 4 components — same explainability the editor shows (M2 reuse). */}
      <Card padding="lg" radius="lg">
        <Eyebrow className="mb-3 block">{isAr ? 'كيف تكوّنت النتيجة' : 'How the score breaks down'}</Eyebrow>
        <div className="grid gap-4">
          {components.map((c) => (
            <div key={c.key}>
              <div className="flex items-baseline justify-between font-ar text-[12px]">
                <span className="font-semibold text-v2-ink">{c.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-v2-mute"><NumDisplay>{c.value}</NumDisplay> / <NumDisplay>{c.max}</NumDisplay></span>
                  {c.impact > 0 && (
                    <span className="rounded-v2-pill bg-emerald-50 px-1.5 py-0.5 font-en text-[10px] font-bold text-emerald-700">
                      +<NumDisplay>{c.impact}</NumDisplay>
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-v2-line">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600" style={{ width: `${Math.min(100, Math.round((c.value / c.max) * 100))}%` }} />
              </div>
              {c.missing.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {c.missing.map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5 font-ar text-[11px] leading-relaxed text-v2-body">
                      <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-500" />{m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 flex items-center gap-1 font-ar text-[11px] text-emerald-700">
                  <CheckCircle2 size={12} /> {isAr ? 'مكتمل' : 'Complete'}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Internal target-profile benchmark — honest, no external market claim (#24). */}
      <Card padding="lg" radius="lg">
        <div className="flex items-center gap-1.5">
          <Target size={15} className="text-teal-600" />
          <Eyebrow>{isAr ? 'مقارنة بالنموذج المثالي للدور' : 'Versus the ideal profile for this role'}</Eyebrow>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 font-ar text-[13px]">
          <span className="text-v2-body">{isAr ? 'أنت' : 'You'}: <strong className="font-en text-v2-ink"><NumDisplay>{b.you}</NumDisplay></strong></span>
          <span className="text-v2-body">{isAr ? 'النموذج المثالي' : 'Ideal'}: <strong className="font-en text-teal-700"><NumDisplay>{b.ideal}</NumDisplay></strong></span>
          <span className="text-v2-body">{isAr ? 'الفجوة' : 'Gap'}: <strong className="font-en text-amber-700"><NumDisplay>{b.gap}</NumDisplay></strong></span>
        </div>
        <p className="mt-2 font-ar text-[11px] text-v2-mute leading-relaxed">
          {isAr
            ? 'النموذج المثالي مرجع داخلي محسوب من معايير وصل لهذا المستوى — لا يعتمد على بيانات سوق خارجية.'
            : 'The ideal is an internal reference computed from Wassel’s criteria for this level — it uses no external market data.'}
        </p>
      </Card>

      {/* ATS UNLOCK SCREEN — sells "+النقاط", not "a resume". */}
      <Card padding="lg" radius="lg" elevated className="bg-teal-50/50 border-teal-200">
        <h3 className="font-ar text-[16px] font-bold text-v2-ink">
          {delta > 0
            ? (isAr ? <>ارفع نقاطك +<NumDisplay>{delta}</NumDisplay></> : <>Raise your score +<NumDisplay>{delta}</NumDisplay></>)
            : (isAr ? 'ابنِ سيرتك المخصّصة' : 'Build your tailored resume')}
        </h3>
        <p className="mt-1.5 font-ar text-[12px] text-v2-body leading-relaxed">
          {isAr
            ? 'البناء الكامل يخصّص كل قسم للدور المستهدف، يرفع نتيجة ATS، ويصدّر PDF و Word بقالب احترافي مع سبب الاختيار وبديلين.'
            : 'The full build tailors every section to your target role, lifts your ATS score, and exports PDF + Word in a real template with the selection reason and two alternatives.'}
        </p>
        <Button variant="primary" size="lg" fullWidth className="mt-4" leadingIcon={<FileText size={18} />} onClick={onBuild}>
          {isAr ? 'ابنِ السيرة الكاملة (179 نقطة)' : 'Build the full resume (179 tokens)'}
        </Button>
        <p className="mt-2 text-center font-ar text-[11px] text-v2-mute">
          {isAr ? 'تُخصم 179 نقطة بعد نجاح البناء فقط' : '179 tokens — charged only on a successful build'}
        </p>
        <button type="button" onClick={onReset} className="mt-3 w-full font-ar text-[12px] text-v2-mute hover:text-v2-body">
          {isAr ? 'تشخيص مصدر آخر' : 'Diagnose another source'}
        </button>
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}
