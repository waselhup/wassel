#!/usr/bin/env node
/**
 * Idempotent merge of Resume v2 translation keys into the existing
 * client/public/locales/{ar,en}/translation.json. Run repeatedly without
 * duplicating keys.
 *
 * Adds the `resume.*` namespace. Existing keys are never overwritten —
 * only missing keys are added.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AR_PATH = path.join(ROOT, 'client', 'public', 'locales', 'ar', 'translation.json');
const EN_PATH = path.join(ROOT, 'client', 'public', 'locales', 'en', 'translation.json');

const AR_KEYS = {
  resume: {
    title: 'السيرة الذاتية',
    subtitle: 'بنِ سيرتك للدور المستهدف',
    list: {
      newCv: '+ سيرة جديدة',
      activeVersions: 'سيرك النشطة',
      legacy: 'سيرة قديمة',
      legacyBanner: 'هذه سيرة قديمة. ابدأ نسخة جديدة للحصول على جميع المزايا',
      archived: 'المؤرشفة',
      emptyState: 'لم تنشئ سيرة بعد — ابدأ الآن!',
      atsScore: 'نتيجة ATS',
      targetRole: 'الدور المستهدف',
      lastUpdated: 'آخر تحديث',
    },
    preflight: {
      welcome: 'بنِ سيرتك المثالية',
      targetRole: 'الدور المستهدف',
      overrideForSession: 'تعديل لجلسة واحدة',
      recommendedTemplate: 'القالب الموصى به',
      changeTemplate: 'تغيير القالب',
      build: 'ابنِ السيرة ({{cost}} توكن)',
      viewCached: 'عرض النسخة الحالية (مجاناً)',
      newVersion: 'نسخة جديدة لدور مختلف ({{cost}} توكن)',
    },
    building: {
      extracting: 'استخراج خبرتك...',
      tailoring: 'تخصيص للدور المستهدف...',
      optimizing: 'تحسين لأنظمة ATS...',
    },
    editor: {
      refinement: 'تحسينات سريعة',
      freeRefinements: '{{remaining}} من 5 تحسينات مجانية متبقية',
      afterFive: 'بعد 5 تحسينات، كل تعديل يكلف 5 توكنات',
      exportPdf: 'تصدير PDF',
      exportDocx: 'تصدير Word',
      exportJson: 'تصدير JSON',
      archive: 'أرشفة',
      restore: 'استعادة',
      atsScore: {
        title: 'نتيجة ATS',
        keywords: 'الكلمات المفتاحية',
        sections: 'الأقسام',
        format: 'التنسيق',
        quantified: 'الأرقام والإنجازات',
      },
      chips: {
        shortenSummary: 'اجعل الملخص أقصر',
        addLeadershipBullet: 'أضف نقطة عن القيادة',
        changeVerb: 'بدّل الفعل الافتتاحي',
        addQuantified: 'أضف إنجازات بأرقام',
        moreProfessional: 'أكثر احترافية',
      },
    },
    templates: {
      harvard_classic: {
        name: 'هارفارد الكلاسيكي',
        reason: 'موصى به للمستوى المتوسط والقيادي في السوق العالمي',
      },
      mit_technical: {
        name: 'MIT للتقنيين',
        reason: 'مناسب للأدوار التقنية والهندسية',
      },
      saudi_executive: {
        name: 'القيادي السعودي',
        reason: 'تنسيق فاخر للقيادات في السوق السعودي',
      },
      modern_minimal: {
        name: 'العصري المختصر',
        reason: 'تصميم نظيف للمحترفين',
      },
    },
    errors: {
      noCareerProfile: 'أكمل البروفايل المهني أولاً',
      insufficientTokens: 'رصيدك غير كافٍ. أضف توكنات أو ترقّ خطتك',
      buildFailed: 'فشل البناء. تم استرداد توكناتك',
      templateNotFound: 'القالب غير موجود',
      legacyReadOnly: 'النسخة القديمة للقراءة فقط',
    },
  },
};

const EN_KEYS = {
  resume: {
    title: 'Resume',
    subtitle: 'Build your resume for your target role',
    list: {
      newCv: '+ New Resume',
      activeVersions: 'Active Versions',
      legacy: 'Legacy CV',
      legacyBanner: 'This is a legacy CV. Start a new version for full features',
      archived: 'Archived',
      emptyState: 'No CVs yet — start now!',
      atsScore: 'ATS Score',
      targetRole: 'Target Role',
      lastUpdated: 'Last Updated',
    },
    preflight: {
      welcome: 'Build Your Perfect Resume',
      targetRole: 'Target Role',
      overrideForSession: 'Override for this session',
      recommendedTemplate: 'Recommended Template',
      changeTemplate: 'Change Template',
      build: 'Build Resume ({{cost}} tokens)',
      viewCached: 'View Cached Version (Free)',
      newVersion: 'New Version for Different Role ({{cost}} tokens)',
    },
    building: {
      extracting: 'Extracting your experience...',
      tailoring: 'Tailoring for target role...',
      optimizing: 'Optimizing for ATS systems...',
    },
    editor: {
      refinement: 'Quick Refinements',
      freeRefinements: '{{remaining}} of 5 free refinements left',
      afterFive: 'After 5 refinements, each costs 5 tokens',
      exportPdf: 'Export PDF',
      exportDocx: 'Export Word',
      exportJson: 'Export JSON',
      archive: 'Archive',
      restore: 'Restore',
      atsScore: {
        title: 'ATS Score',
        keywords: 'Keywords',
        sections: 'Sections',
        format: 'Format',
        quantified: 'Quantified Achievements',
      },
      chips: {
        shortenSummary: 'Shorten Summary',
        addLeadershipBullet: 'Add Leadership Point',
        changeVerb: 'Change Opening Verb',
        addQuantified: 'Add Quantified Achievements',
        moreProfessional: 'More Professional',
      },
    },
    templates: {
      harvard_classic: {
        name: 'Harvard Classic',
        reason: 'Recommended for mid-to-executive level in the global market',
      },
      mit_technical: {
        name: 'MIT Technical',
        reason: 'Suitable for technical and engineering roles',
      },
      saudi_executive: {
        name: 'Saudi Executive',
        reason: 'Premium layout for KSA market executives',
      },
      modern_minimal: {
        name: 'Modern Minimal',
        reason: 'Clean design for professionals',
      },
    },
    errors: {
      noCareerProfile: 'Complete your career profile first',
      insufficientTokens: 'Not enough tokens. Add tokens or upgrade your plan',
      buildFailed: 'Build failed. Your tokens were refunded',
      templateNotFound: 'Template not found',
      legacyReadOnly: 'Legacy versions are read-only',
    },
  },
};

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = target[k] && typeof target[k] === 'object' ? target[k] : {};
      deepMerge(target[k], source[k]);
    } else {
      if (target[k] === undefined) target[k] = source[k];
    }
  }
  return target;
}
function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8'); }
function countLeaves(obj) {
  let c = 0;
  for (const k of Object.keys(obj || {})) {
    if (obj[k] && typeof obj[k] === 'object') c += countLeaves(obj[k]);
    else c++;
  }
  return c;
}

const ar = loadJson(AR_PATH);
const en = loadJson(EN_PATH);
const arBefore = countLeaves(ar);
const enBefore = countLeaves(en);
deepMerge(ar, AR_KEYS);
deepMerge(en, EN_KEYS);
const arAfter = countLeaves(ar);
const enAfter = countLeaves(en);
saveJson(AR_PATH, ar);
saveJson(EN_PATH, en);

console.log(`✓ AR: ${arBefore} → ${arAfter} keys (+${arAfter - arBefore})`);
console.log(`✓ EN: ${enBefore} → ${enAfter} keys (+${enAfter - enBefore})`);
