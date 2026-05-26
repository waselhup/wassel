#!/usr/bin/env node
/**
 * Idempotent merge of Radar v2 translation keys into the existing
 * client/public/locales/{ar,en}/translation.json files. Run repeatedly
 * without duplicating keys.
 *
 * Adds the `radar.*` namespace and a couple of error keys. Existing keys
 * are never overwritten — only missing keys are added.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AR_PATH = path.join(ROOT, 'client', 'public', 'locales', 'ar', 'translation.json');
const EN_PATH = path.join(ROOT, 'client', 'public', 'locales', 'en', 'translation.json');

const AR_KEYS = {
  radar: {
    title: 'الرادار',
    subtitle: 'اكتشف الفجوات وحقّق التقدم',
    preflight: {
      welcome: 'مرحباً بك في الرادار',
      yourTargetRole: 'الدور المستهدف',
      yourLinkedin: 'حساب لينكد إن',
      overrideForSession: 'تعديل لجلسة واحدة',
      startAnalysis: 'ابدأ التحليل ({{cost}} توكن)',
      viewCached: 'عرض آخر تحليل (مجاناً)',
      triggersDetected: 'تم اكتشاف تحديثات منذ آخر تحليل',
    },
    loading: {
      discovering: 'اكتشاف بياناتك...',
      comparing: 'مقارنة مع متطلبات الدور...',
      revealing: 'كشف الفرص...',
      almostThere: 'نشتغل عليه، اقترب من النهاية...',
    },
    result: {
      currentScore: 'السكور الحالي',
      targetScore: 'السكور المتوقع',
      afterQuickWins: 'بعد تطبيق Quick Wins',
      quickWins: 'تحسينات سريعة',
      strengths: 'نقاط القوة',
      gaps: 'الفجوات',
      suggestedActions: 'إجراءات مقترحة',
      apply: 'تطبيق',
      applied: 'تم التطبيق',
      skip: 'تخطي',
      showMore: 'عرض المزيد',
      highImpact: 'تأثير عالٍ',
      mediumImpact: 'تأثير متوسط',
      lowImpact: 'تأثير منخفض',
      veryLowEffort: 'جهد قليل جداً',
      lowEffort: 'جهد قليل',
      mediumEffort: 'جهد متوسط',
      highEffort: 'جهد عالٍ',
      openInResume: 'افتح في السيرة',
      openInContent: 'افتح في المنشورات',
      openInProfile: 'افتح في الملف المهني',
      reAnalyze: 'إعادة التحليل',
      editTargetRole: 'تعديل الدور المستهدف',
      cachedFrom: 'آخر تحليل في',
      fromCache: 'من الكاش · 0 توكن',
      freshAnalysis: 'تحليل جديد',
      severity: {
        high: 'عالية',
        medium: 'متوسطة',
        low: 'منخفضة',
      },
    },
    triggers: {
      fiveNewPosts: 'نشرت 5 منشورات منذ آخر تحليل',
      targetRoleChanged: 'تغيّر دورك المستهدف',
      newResume: 'أنشأت سيرة ذاتية جديدة',
      linkedinFirstLink: 'أضفت رابط لينكد إن لأول مرة',
      thirtyDaysPassed: 'مرّ شهر على آخر تحليل',
      profileDataChanged: 'تحدّثت بياناتك في البروفايل المهني',
      manual: 'لم تجرِ تحليلاً بعد',
    },
    errors: {
      noCareerProfile: 'أكمل البروفايل المهني أولاً',
      insufficientTokens: 'رصيدك غير كافٍ. أضف توكنات أو ترقّ خطتك',
      analysisFailed: 'فشل التحليل. تم استرداد توكناتك',
      linkedinUnreachable: 'تعذّر الوصول إلى بروفايل لينكد إن',
    },
  },
};

const EN_KEYS = {
  radar: {
    title: 'Radar',
    subtitle: 'Discover gaps, make progress',
    preflight: {
      welcome: 'Welcome to Radar',
      yourTargetRole: 'Target role',
      yourLinkedin: 'LinkedIn profile',
      overrideForSession: 'Override for this session only',
      startAnalysis: 'Start Analysis ({{cost}} tokens)',
      viewCached: 'View latest analysis (free)',
      triggersDetected: 'Updates detected since your last analysis',
    },
    loading: {
      discovering: 'Discovering your data...',
      comparing: 'Comparing with role requirements...',
      revealing: 'Revealing opportunities...',
      almostThere: 'Working on it, almost done...',
    },
    result: {
      currentScore: 'Current Score',
      targetScore: 'Target Score',
      afterQuickWins: 'After applying Quick Wins',
      quickWins: 'Quick Wins',
      strengths: 'Strengths',
      gaps: 'Gaps',
      suggestedActions: 'Suggested Actions',
      apply: 'Apply',
      applied: 'Applied',
      skip: 'Skip',
      showMore: 'Show more',
      highImpact: 'High Impact',
      mediumImpact: 'Medium Impact',
      lowImpact: 'Low Impact',
      veryLowEffort: 'Very Low Effort',
      lowEffort: 'Low Effort',
      mediumEffort: 'Medium Effort',
      highEffort: 'High Effort',
      openInResume: 'Open in Resume',
      openInContent: 'Open in Content',
      openInProfile: 'Open in Profile',
      reAnalyze: 'Re-analyze',
      editTargetRole: 'Edit target role',
      cachedFrom: 'Analysis from',
      fromCache: 'From cache · 0 tokens',
      freshAnalysis: 'Fresh analysis',
      severity: {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      },
    },
    triggers: {
      fiveNewPosts: 'You have published 5 posts since your last analysis',
      targetRoleChanged: 'Your target role has changed',
      newResume: 'You created a new resume',
      linkedinFirstLink: 'You linked LinkedIn for the first time',
      thirtyDaysPassed: '30 days have passed since your last analysis',
      profileDataChanged: 'Your career profile data has changed',
      manual: 'You have not run an analysis yet',
    },
    errors: {
      noCareerProfile: 'Complete your career profile first',
      insufficientTokens: 'Not enough tokens. Add tokens or upgrade your plan',
      analysisFailed: 'Analysis failed. Your tokens were refunded',
      linkedinUnreachable: 'LinkedIn profile unreachable',
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
