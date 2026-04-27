import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Input from '@/components/v2/Input';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import { useAuth } from '@/contexts/AuthContext';
import { validateAndNormalizeLinkedInUrl } from '@/lib/linkedin-url-validator';
import {
  newTempAnalysisId,
  setAnalysisParams,
  type AnalysisParams,
  type Industry,
  type ReportLang,
  type TargetGoal,
} from '@/lib/v2/analysisSession';

const GOALS: { id: TargetGoal; ar: string; en: string; emoji: string }[] = [
  { id: 'job-search',          ar: 'البحث عن وظيفة',     en: 'Job search',          emoji: '🎯' },
  { id: 'investment',          ar: 'جذب استثمار',         en: 'Investment',          emoji: '🚀' },
  { id: 'thought-leadership',  ar: 'قيادة فكرية',         en: 'Thought leadership',  emoji: '💼' },
  { id: 'sales-b2b',           ar: 'مبيعات B2B',          en: 'B2B sales',           emoji: '🤝' },
  { id: 'career-change',       ar: 'تغيير المسار',         en: 'Career change',       emoji: '📚' },
  { id: 'internal-promotion',  ar: 'ترقية داخلية',         en: 'Internal promotion',  emoji: '👔' },
];

const INDUSTRIES: { id: Industry; ar: string; en: string }[] = [
  { id: 'oil-gas',           ar: 'النفط والغاز',     en: 'Oil & gas' },
  { id: 'tech',              ar: 'التقنية',           en: 'Tech' },
  { id: 'finance',           ar: 'المالية',           en: 'Finance' },
  { id: 'healthcare',        ar: 'الرعاية الصحية',    en: 'Healthcare' },
  { id: 'legal',             ar: 'القانون',           en: 'Legal' },
  { id: 'consulting',        ar: 'الاستشارات',        en: 'Consulting' },
  { id: 'government',        ar: 'الحكومة',           en: 'Government' },
  { id: 'academic',          ar: 'الأكاديمي',         en: 'Academic' },
  { id: 'entrepreneurship',  ar: 'ريادة الأعمال',     en: 'Entrepreneurship' },
  { id: 'real-estate',       ar: 'العقارات',          en: 'Real estate' },
  { id: 'other',             ar: 'مجال آخر',          en: 'Other' },
];

const COST = 25;

const PLAN_QUOTAS: Record<string, number> = {
  free: 100, starter: 500, pro: 2000, elite: 10000,
};

export default function ProfileInput() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [, navigate] = useLocation();
  const { profile } = useAuth();
  const balance = profile?.token_balance ?? 0;
  const planKey = profile?.plan ?? 'free';
  const total = PLAN_QUOTAS[planKey] ?? PLAN_QUOTAS.free;

  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [goal, setGoal] = useState<TargetGoal | null>(null);
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [customIndustry, setCustomIndustry] = useState('');
  const [language, setLanguage] = useState<ReportLang>(isAr ? 'ar' : 'en');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');

  const enoughBalance = balance >= COST;
  const customIndustryReady = industry !== 'other' || customIndustry.trim().length >= 2;
  const canStart = !!url.trim() && !urlError && !!goal && !!industry && customIndustryReady && enoughBalance;

  function handleUrlBlur() {
    if (!url.trim()) {
      setUrlError(null);
      return;
    }
    const r = validateAndNormalizeLinkedInUrl(url);
    if (!r.valid) {
      setUrlError(isAr ? (r.errorMessageAr || 'رابط غير صالح') : (r.errorMessageEn || 'Invalid URL'));
    } else {
      setUrlError(null);
      setUrl(r.normalizedUrl || url);
    }
  }

  function handleStart() {
    if (!canStart || !goal || !industry) return;
    const id = newTempAnalysisId();
    const params: AnalysisParams = {
      linkedinUrl: url.trim(),
      targetGoal: goal,
      industry,
      customIndustryLabel: industry === 'other' ? customIndustry.trim() : undefined,
      targetRole: targetRole.trim() || undefined,
      targetCompany: targetCompany.trim() || undefined,
      reportLanguage: language,
    };
    setAnalysisParams(id, params);
    navigate(`/v2/analyze/loading?id=${id}`);
  }

  // DNA score — reused from V1 to give the user readiness feedback before
  // they spend tokens. Pure derived state.
  const dnaScore = useMemo(() => {
    let s = 0;
    if (url.trim() && !urlError) s += 30;
    if (goal) s += 25;
    if (industry) s += 25;
    if (language) s += 10;
    if (targetRole.trim() || targetCompany.trim()) s += 10;
    return s;
  }, [url, urlError, goal, industry, language, targetRole, targetCompany]);

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <span className="font-ar text-[15px] font-bold text-v2-ink px-2">
            {isAr ? 'تحليل البروفايل' : 'Profile analysis'}
          </span>
        }
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        <div className="mt-5 mb-6 lg:mt-2 lg:mb-8">
          <Eyebrow className="mb-1.5 block">RADAR · {COST} TOKEN</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[26px] lg:text-[32px]">
            {isAr ? 'لنحلل بروفايلك بدقة.' : "Let's analyse your profile."}
          </h1>
          <p className="mt-2 font-ar text-[14px] text-v2-dim">
            {isAr
              ? 'أدخل رابط لينكد إن، اختر هدفك، وسنُجري تحليلاً مخصصاً للسوق السعودي والخليجي.'
              : 'Drop your LinkedIn URL, pick a goal, and we will run a Saudi-market-aware deep analysis.'}
          </p>
        </div>

        <div className="space-y-4 lg:space-y-5">
          <Card padding="lg" radius="lg">
            <Input
              label={isAr ? 'رابط البروفايل على لينكد إن' : 'LinkedIn profile URL'}
              dir="ltr"
              type="url"
              placeholder="https://linkedin.com/in/username"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(null); }}
              onBlur={handleUrlBlur}
              error={!!urlError}
              hint={urlError ?? (isAr ? 'سنفحص البروفايل قبل خصم أي توكن' : 'We verify the profile before charging any token')}
            />
          </Card>

          <Card padding="lg" radius="lg">
            <Eyebrow className="mb-2 block">{isAr ? 'الهدف' : 'Goal'}</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => {
                const active = goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`inline-flex items-center gap-1.5 rounded-v2-pill px-3.5 py-2 font-ar text-[13px] font-semibold border transition-colors duration-150 ease-out cursor-pointer ${
                      active
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-v2-line bg-v2-surface text-v2-body hover:bg-v2-canvas-2'
                    }`}
                  >
                    <span aria-hidden>{g.emoji}</span>
                    {isAr ? g.ar : g.en}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card padding="lg" radius="lg">
            <Eyebrow className="mb-2 block">{isAr ? 'المجال' : 'Industry'}</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => {
                const active = industry === ind.id;
                return (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => {
                      setIndustry(ind.id);
                      if (ind.id !== 'other') setCustomIndustry('');
                    }}
                    className={`rounded-v2-pill px-3.5 py-2 font-ar text-[13px] font-semibold border transition-colors duration-150 ease-out cursor-pointer ${
                      active
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-v2-line bg-v2-surface text-v2-body hover:bg-v2-canvas-2'
                    }`}
                  >
                    {isAr ? ind.ar : ind.en}
                  </button>
                );
              })}
            </div>
            {industry === 'other' && (
              <div className="mt-3">
                <Input
                  label={isAr ? 'ما هو مجالك؟' : 'What is your industry?'}
                  placeholder={isAr ? 'اكتب مجالك هنا...' : 'Type your industry...'}
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  maxLength={60}
                  dir={isAr ? 'rtl' : 'ltr'}
                />
              </div>
            )}
          </Card>

          <Card padding="lg" radius="lg">
            <Eyebrow className="mb-2 block">{isAr ? 'لغة التقرير' : 'Report language'}</Eyebrow>
            <div className="flex gap-2">
              {(['ar', 'en'] as ReportLang[]).map((l) => {
                const active = language === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={`flex-1 rounded-v2-md px-4 py-3 font-ar text-[14px] font-semibold border transition-colors duration-150 ease-out cursor-pointer ${
                      active
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-v2-line bg-v2-surface text-v2-body hover:bg-v2-canvas-2'
                    }`}
                  >
                    {l === 'ar' ? '🇸🇦 العربية' : '🇬🇧 English'}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card padding="lg" radius="lg">
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="flex w-full items-center justify-between font-ar text-[14px] font-semibold text-v2-ink cursor-pointer"
            >
              <span>{isAr ? 'خيارات متقدمة (اختياري)' : 'Advanced options (optional)'}</span>
              {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                <Input
                  label={isAr ? 'الدور المستهدف' : 'Target role'}
                  placeholder={isAr ? 'مدير مشاريع، مهندس...' : 'Project manager, engineer...'}
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
                <Input
                  label={isAr ? 'الشركة المستهدفة' : 'Target company'}
                  placeholder={isAr ? 'أرامكو، STC...' : 'Aramco, STC...'}
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                />
              </div>
            )}
          </Card>

          {/* Readiness + balance summary */}
          <Card padding="md" radius="lg" className={enoughBalance ? '' : 'border-rose-200 bg-rose-50'}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-ar">
                <Eyebrow>{isAr ? 'جاهزية المدخلات' : 'Input readiness'}</Eyebrow>
                <div className="mt-1 text-[18px] font-bold text-v2-ink">{dnaScore}%</div>
              </div>
              <div className="text-end font-ar">
                <Eyebrow>{isAr ? 'رصيدك' : 'Balance'}</Eyebrow>
                <div className={`mt-1 text-[14px] font-semibold ${enoughBalance ? 'text-v2-ink' : 'text-rose-700'}`}>
                  {balance} / {total} {isAr ? 'توكن' : 'tokens'}
                </div>
                <div className="mt-0.5 text-[11px] text-v2-dim">
                  {isAr ? `يحتاج التحليل ${COST} توكن` : `Analysis needs ${COST} tokens`}
                </div>
              </div>
            </div>
          </Card>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canStart}
            onClick={handleStart}
          >
            {isAr ? `ابدأ التحليل (${COST} توكن)` : `Start analysis (${COST} tokens)`}
          </Button>
          {!enoughBalance && (
            <p className="text-center font-ar text-[12px] font-semibold text-rose-700">
              {isAr ? 'الرصيد غير كافٍ — أعِد الشحن من صفحة الباقات.' : 'Not enough tokens — top up on the Pricing page.'}
            </p>
          )}
        </div>
      </div>

      <BottomNav
        active="analyze"
        items={[
          { id: 'home',    label: 'الرئيسية', icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: 'الرادار',  icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'tools',   label: 'الأدوات',  icon: <span /> , onSelect: () => navigate('/v2/cvs') },
          { id: 'profile', label: 'حسابي',    icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="arrow"
        fabLabel={isAr ? 'ابدأ التحليل' : 'Start analysis'}
        onFabClick={handleStart}
      />
    </Phone>
  );
}
