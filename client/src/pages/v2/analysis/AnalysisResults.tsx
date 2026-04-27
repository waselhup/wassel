import { useEffect, useMemo, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import {
  UserCircle, Type, Info, Briefcase, Award, GraduationCap, Users, TrendingUp, CheckCircle2,
  Sparkles, FileText, ArrowLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Phone from '@/components/v2/Phone';
import Topbar from '@/components/v2/Topbar';
import BottomNav from '@/components/v2/BottomNav';
import Card from '@/components/v2/Card';
import Button from '@/components/v2/Button';
import Eyebrow from '@/components/v2/Eyebrow';
import Skeleton from '@/components/v2/Skeleton';
import {
  ScoreRing, SectionList, SectionDetailPanel, ProfilePreviewCard,
  deriveStatus, type SectionView,
} from '@/components/profile-analysis';
import { trpcMutation } from '@/lib/trpc';
import { getAnalysisResult, type StoredAnalysisResult } from '@/lib/v2/analysisSession';

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

const SECTION_NAME_AR: Record<string, string> = {
  headline: 'العنوان',
  about: 'نبذة عني',
  experience: 'الخبرة',
  skills: 'المهارات',
  education: 'التعليم',
  recommendations: 'التوصيات',
  activity: 'النشاط',
  profile_completeness: 'اكتمال البروفايل',
};

const SECTION_NAME_EN: Record<string, string> = {
  headline: 'Headline',
  about: 'About',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  recommendations: 'Recommendations',
  activity: 'Activity',
  profile_completeness: 'Profile completeness',
};

export default function AnalysisResults() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const isRTL = isAr;
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>('/v2/analyze/result/:id');
  const id = match ? params.id : null;

  const [data, setData] = useState<StoredAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [exportingFmt, setExportingFmt] = useState<'docx' | 'pdf' | null>(null);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      navigate('/v2/analyze', { replace: true });
      return;
    }
    const stored = getAnalysisResult(id);
    if (stored) {
      setData(stored);
      setLoading(false);
      return;
    }
    // No sessionStorage hit — could be a legacy /v2/analyze/result/<id>
    // permalink. The existing tRPC API doesn't expose getById, so fall
    // back gracefully: surface "not in session" with a path back.
    setMissing(true);
    setLoading(false);
  }, [id, navigate]);

  const sections = useMemo(() => {
    const list: any[] = data?.analysis?.sections;
    return Array.isArray(list) ? list : [];
  }, [data]);

  const sectionViews: SectionView[] = useMemo(() => sections.map((s: any) => {
    const key = String(s.key);
    return {
      key,
      name: isAr
        ? (s.name_ar || SECTION_NAME_AR[key] || key)
        : (s.name_en || SECTION_NAME_EN[key] || key),
      icon: SECTION_ICON[key] || UserCircle,
      score: typeof s.score === 'number' ? s.score : null,
      status: deriveStatus(typeof s.score === 'number' ? s.score : null),
      isPerfect: !!s.is_perfect,
      framework: s.framework || undefined,
      frameworkLabel: s.framework_label || undefined,
      effort: s.effort,
      description: isAr
        ? 'قسم مهم في بروفايلك — راجع الملاحظات أدناه.'
        : 'An important section of your profile — review the notes below.',
      verdict: s.assessment,
      currentText: s.current,
      suggestedText: s.suggested,
      why: s.why,
    };
  }), [sections, isAr]);

  const languageSettings = useMemo(() => {
    const ls = data?.analysis?.language_settings || {};
    const reportLang: 'ar' | 'en' = ls.report_language === 'en' ? 'en' : 'ar';
    const suggestionsLang: 'ar' | 'en' = ls.suggestions_language === 'en' ? 'en' : 'ar';
    return { reportLang, suggestionsLang, mismatch: reportLang !== suggestionsLang };
  }, [data]);

  const profile = useMemo(() => {
    const ps = data?.profileSummary || {};
    return {
      fullName: ps.fullName || '',
      headline: ps.headline || '',
      about: ps.about || '',
      location: ps.location || '',
      profilePicture: ps.profilePicture || '',
      bannerImage: ps.bannerImage || '',
      industry: ps.industry || '',
      experience: (ps.experience || []).map((e: any) => ({
        title: e.title || '', company: e.company || '', location: e.location || '',
        startDate: e.startDate || '', endDate: e.endDate || '', description: e.description || '',
      })),
      education: (ps.education || []).map((ed: any) => ({
        school: ed.school || '', degree: ed.degree || '', field: ed.field || '',
        startYear: ed.startYear || '', endYear: ed.endYear || '',
      })),
      top_skills: ps.top_skills || [],
      certifications: ps.certifications || [],
      languages: ps.languages || [],
      honors_and_awards: ps.honors_and_awards || [],
      flags: ps.flags || null,
    };
  }, [data]);

  const activeIndex = selectedSectionKey === null
    ? null
    : Math.max(0, sectionViews.findIndex((v) => v.key === selectedSectionKey));
  const activeSection = activeIndex !== null && activeIndex >= 0 ? sectionViews[activeIndex] : null;

  const detailLabels = useMemo(() => ({
    backToList: isAr ? 'عودة للقائمة' : 'Back to list',
    prev: isAr ? 'السابق' : 'Prev',
    next: isAr ? 'التالي' : 'Next',
    sectionCounter: isAr
      ? `قسم ${(activeIndex ?? 0) + 1} من ${sectionViews.length}`
      : `Section ${(activeIndex ?? 0) + 1} of ${sectionViews.length}`,
    lookingGood: isAr ? 'يبدو جيداً' : 'Looking good',
    needsImprovement: isAr ? 'يحتاج تحسيناً' : 'Needs improvement',
    opportunity: isAr ? 'فرصة' : 'Opportunity',
    noFeedback: isAr ? 'لا توجد ملاحظات' : 'No feedback',
    openOnLinkedIn: isAr ? 'فتح على لينكد إن' : 'Open on LinkedIn',
    currentLabel: isAr ? 'الحالي' : 'Current',
    suggestedLabel: isAr ? 'المقترح' : 'Suggested',
    checklist: isAr ? 'قائمة المراجعة' : 'Checklist',
    moreInfo: isAr ? 'تفاصيل' : 'More info',
    copy: isAr ? 'نسخ' : 'Copy',
    copied: isAr ? 'تم النسخ' : 'Copied',
    perfectBadge: isAr ? 'مثالي' : 'PERFECT',
    perfectMessage: isAr
      ? 'هذا القسم مكتمل ولا يحتاج إلى تعديل. حافظ عليه كما هو.'
      : 'This section already meets the bar — no rewrite needed. Leave it as-is.',
  }), [isAr, activeIndex, sectionViews.length]);

  const previewLabels = useMemo(() => ({
    verdictTitle: isAr ? 'الحكم العام' : 'Overall verdict',
    aboutTitle: isAr ? 'نبذة عني' : 'About',
    experienceTitle: isAr ? 'الخبرة' : 'Experience',
    educationTitle: isAr ? 'التعليم' : 'Education',
    topSkillsTitle: isAr ? 'أهم المهارات' : 'Top skills',
    certificationsTitle: isAr ? 'الشهادات' : 'Certifications',
    languagesTitle: isAr ? 'اللغات' : 'Languages',
    honorsTitle: isAr ? 'التكريمات' : 'Honors',
    flagOpenToWork: isAr ? 'منفتح للعمل' : 'Open to work',
    flagHiring: isAr ? 'يوظّف' : 'Hiring',
    flagPremium: 'Premium',
    flagCreator: isAr ? 'صانع محتوى' : 'Creator',
  }), [isAr]);

  function copyText(text: string) {
    navigator.clipboard?.writeText(text);
  }

  async function handleExport(format: 'docx' | 'pdf') {
    if (!data) return;
    setExportingFmt(format);
    try {
      const res = await trpcMutation<{ filename: string; mimeType: string; base64: string }>(
        'linkedin.exportReport',
        { analysisId: data.id, format },
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
    } catch {
      // Swallow — V1 has its own toast system; in V2 we surface failures
      // through the BottomNav toast bus when wired in a follow-up.
    } finally {
      setExportingFmt(null);
    }
  }

  if (loading) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'النتائج' : 'Results'}</span>} />
        <div className="flex-1 px-[22px] pt-6">
          <Skeleton variant="text" lines={2} className="mb-6" />
          <Skeleton variant="card" className="mb-4" />
          <Skeleton variant="card" />
        </div>
      </Phone>
    );
  }

  if (missing || !data) {
    return (
      <Phone>
        <Topbar sticky bg="canvas" leading={<span className="px-2 font-ar text-[15px] font-bold text-v2-ink">{isAr ? 'النتائج' : 'Results'}</span>} />
        <div className="flex-1 px-[22px] pt-10">
          <Card padding="lg" radius="lg" className="text-center">
            <Eyebrow className="mb-2 block">RADAR</Eyebrow>
            <h2 className="font-ar text-[18px] font-bold text-v2-ink">
              {isAr ? 'لم نجد هذا التحليل في الجلسة الحالية.' : 'No analysis found in this session.'}
            </h2>
            <p className="mt-2 font-ar text-[13px] text-v2-dim">
              {isAr
                ? 'افتح السجل من صفحة الرادار للوصول إلى التحاليل السابقة.'
                : 'Open the radar history to access prior analyses.'}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="primary" onClick={() => navigate('/v2/analyze')}>
                {isAr ? 'تحليل جديد' : 'New analysis'}
              </Button>
            </div>
          </Card>
        </div>
      </Phone>
    );
  }

  const overallScore = data.analysis?.overall_score ?? 0;
  const verdict: string = data.analysis?.verdict || '';
  const tokensUsed = data.tokensUsed ?? 25;

  return (
    <Phone>
      <Topbar
        sticky
        bg="canvas"
        leading={
          <button
            type="button"
            onClick={() => navigate('/v2/analyze')}
            aria-label={isAr ? 'عودة' : 'Back'}
            className="flex h-9 items-center gap-1 rounded-v2-pill px-2 text-v2-ink hover:bg-v2-canvas-2"
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
            <span className="font-ar text-[14px] font-semibold">{isAr ? 'الرادار' : 'Radar'}</span>
          </button>
        }
        trailing={
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('pdf')}
              disabled={exportingFmt !== null}
            >
              <FileText size={14} />
              {exportingFmt === 'pdf' ? '…' : 'PDF'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('docx')}
              disabled={exportingFmt !== null}
            >
              <FileText size={14} />
              {exportingFmt === 'docx' ? '…' : 'DOCX'}
            </Button>
          </div>
        }
      />

      <div className="flex-1 px-[22px] pb-[110px] lg:px-0 lg:pb-0">
        {/* Hero score card — mobile-first single column, desktop centers it. */}
        <div className="mt-5 lg:mt-2">
          <Eyebrow className="mb-1.5 block">{isAr ? 'نتيجة Wassel' : 'Wassel score'} · {tokensUsed} TOKEN</Eyebrow>
          <h1 className="font-ar font-bold leading-tight text-v2-ink text-[24px] lg:text-[32px]">
            {isAr ? 'تحليلك جاهز.' : 'Your analysis is ready.'}
          </h1>
        </div>

        {languageSettings.mismatch && (
          <div className="mt-3 rounded-v2-md border border-teal-200 bg-teal-50 px-3 py-2 font-ar text-[12px] text-teal-800">
            {isAr
              ? `التقرير ${languageSettings.reportLang === 'ar' ? 'بالعربية' : 'بالإنجليزية'} · الاقتراحات الجاهزة للنسخ ${languageSettings.suggestionsLang === 'ar' ? 'بالعربية' : 'بالإنجليزية'} (تطابقاً مع لغة بروفايلك على لينكد إن).`
              : `Report in ${languageSettings.reportLang === 'ar' ? 'Arabic' : 'English'} · Paste-ready suggestions in ${languageSettings.suggestionsLang === 'ar' ? 'Arabic' : 'English'} (matching your LinkedIn profile language).`}
          </div>
        )}

        <div className="mt-5 lg:grid lg:grid-cols-12 lg:gap-6">
          {/* Score ring + verdict */}
          <Card padding="lg" radius="lg" elevated className="mb-5 lg:order-1 lg:col-span-4 lg:mb-0">
            <div className="flex flex-col items-center gap-3">
              <ScoreRing
                score={overallScore}
                size={140}
                label={isAr ? 'نتيجة Wassel' : 'Wassel score'}
              />
              {verdict && (
                <p className="text-center font-ar text-[14px] leading-relaxed text-v2-body">
                  {verdict}
                </p>
              )}
              <Button
                variant="primary"
                size="md"
                fullWidth
                leadingIcon={<Sparkles size={16} />}
                onClick={() => navigate('/v2/analyze')}
              >
                {isAr ? 'تحليل بروفايل آخر' : 'Analyse another profile'}
              </Button>
            </div>
          </Card>

          {/* Section list — mobile shows full list; desktop shows it as a rail
              column 8 with detail toggle inside. */}
          <div className="lg:order-2 lg:col-span-8">
            {activeSection ? (
              <SectionDetailPanel
                section={activeSection}
                index={activeIndex ?? 0}
                total={sectionViews.length}
                isRTL={isRTL}
                labels={detailLabels}
                onBack={() => setSelectedSectionKey(null)}
                onPrev={() => {
                  if (activeIndex == null) return;
                  const next = (activeIndex - 1 + sectionViews.length) % sectionViews.length;
                  setSelectedSectionKey(sectionViews[next].key);
                }}
                onNext={() => {
                  if (activeIndex == null) return;
                  const next = (activeIndex + 1) % sectionViews.length;
                  setSelectedSectionKey(sectionViews[next].key);
                }}
                onCopy={copyText}
              />
            ) : sectionViews.length > 0 ? (
              <SectionList
                sections={sectionViews}
                activeIndex={null}
                isRTL={isRTL}
                onSelect={(i) => setSelectedSectionKey(sectionViews[i].key)}
              />
            ) : (
              <Card padding="lg" radius="lg" className="text-center">
                <p className="font-ar text-[14px] text-v2-dim">
                  {isAr ? 'لا توجد أقسام تفصيلية في هذا التحليل.' : 'No section breakdown available for this analysis.'}
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Profile preview block — kept on its own row below the rail so
            mobile users land on score+sections first (the actionable bit). */}
        {profile.fullName && (
          <div className="mt-6 lg:mt-8">
            <ProfilePreviewCard
              profile={profile}
              verdict={verdict}
              isRTL={isRTL}
              labels={previewLabels}
            />
          </div>
        )}
      </div>

      <BottomNav
        active="analyze"
        items={[
          { id: 'home',    label: 'الرئيسية', icon: <span /> , onSelect: () => navigate('/v2/home') },
          { id: 'analyze', label: 'الرادار',  icon: <span /> , onSelect: () => navigate('/v2/analyze') },
          { id: 'tools',   label: 'الأدوات',  icon: <span /> , onSelect: () => navigate('/v2/cvs') },
          { id: 'profile', label: 'حسابي',    icon: <span /> , onSelect: () => navigate('/v2/me') },
        ]}
        fabIcon="plus"
        fabLabel={isAr ? 'تحليل جديد' : 'New analysis'}
        onFabClick={() => navigate('/v2/analyze')}
      />
    </Phone>
  );
}
