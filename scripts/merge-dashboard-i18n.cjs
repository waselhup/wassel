#!/usr/bin/env node
/**
 * Idempotent merge of Dashboard v2 (Sprint 6) translation keys into the
 * existing client/public/locales/{ar,en}/translation.json. Run repeatedly
 * without duplicating keys.
 *
 * Adds the `dashboard.*` namespace. Existing keys are never overwritten —
 * only missing keys are added.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AR_PATH = path.join(ROOT, 'client', 'public', 'locales', 'ar', 'translation.json');
const EN_PATH = path.join(ROOT, 'client', 'public', 'locales', 'en', 'translation.json');

const AR_KEYS = {
  dashboard: {
    welcomeMorning: 'صباح الخير، {{name}}',
    welcomeEvening: 'مساء الخير، {{name}}',
    streak: 'يوم',
    nextTask: {
      title: 'خطوتك التالية',
      actCta: 'ابدأ الآن',
      dismiss: 'ليس الآن',
      highConfidence: 'موصى به بشدة',
      empty: 'أنت على المسار الصحيح. لا توجد توصيات جديدة.',
    },
    pulse: {
      title: 'نبضك المهني',
      radarScore: 'نتيجة الرادار',
      radarOutOf100: 'من 100',
      lastUpdated: 'آخر تحديث',
      resumeReady: 'السيرة',
      noResumeYet: 'لم تبنِ سيرة بعد',
      atsScore: 'ATS',
      contentVelocity: 'زخم المحتوى',
      postsLast30Days: '{{count}} منشور آخر 30 يوم',
      noContentYet: 'لم تنشر محتوى بعد',
      wallet: 'الرصيد',
      bonusExpiringSoon: 'بونس ينتهي قريباً',
    },
    quickWins: {
      title: 'تحسينات سريعة',
      apply: 'تطبيق',
    },
    activity: {
      title: 'النشاط الأخير',
      viewAll: 'عرض الكل',
      empty: 'لا نشاط بعد',
      actions: {
        'radar.completed': 'أكملت تحليل الرادار',
        'radar.cache_hit': 'عرضت تحليل مخزّن',
        'radar.applied_fix': 'طبّقت تحسيناً سريعاً',
        'radar.reverted_fix': 'تراجعت عن تحسين',
        'resume.built': 'بنيت سيرة جديدة',
        'resume.new_version_built': 'أنشأت نسخة جديدة من السيرة',
        'resume.refined': 'حسّنت سيرتك',
        'resume.legacy_imported': 'استورد ت سيرة قديمة',
        'resume.archived': 'أرشفت سيرة',
        'resume.exported_pdf': 'صدّرت السيرة PDF',
        'resume.exported_docx': 'صدّرت السيرة DOCX',
        'content.post.created': 'أنشأت منشور',
        'content.carousel.created': 'أنشأت كاروسيل',
        'content.repurpose_bundle.created': 'حزمة إعادة توظيف',
        'content.refined': 'حسّنت محتوى',
        'content.published': 'نشرت محتوى',
        'content.exported_pdf': 'صدّرت محتوى PDF',
        'content.legacy_imported': 'استوردت منشور قديم',
        'onboarding.completed': 'أكملت Onboarding',
        'career_profile.updated': 'حدّثت ملفك المهني',
        'next_task.dismissed': 'تجاهلت اقتراح',
        'next_task.actioned': 'بدأت اقتراح',
      },
    },
    drafts: {
      title: 'مكتبة المسودات',
      resume: 'سير',
      content: 'محتوى',
      radar: 'تحاليل',
      noDrafts: 'لا مسودات نشطة',
      openEditor: 'فتح',
    },
    sufficesFor: {
      title: 'رصيدك يكفي لـ',
      or: 'أو',
      radarCount: '{{count}} تحليل',
      resumeCount: '{{count}} سيرة',
      postCount: '{{count}} منشور',
      carouselCount: '{{count}} كاروسيل',
      repurposeCount: '{{count}} حزمة',
      recommendedBundle: 'موصى به لك',
      addTokens: 'إضافة توكنات',
      bundles: {
        fullJourney: 'رحلة كاملة',
        contentPush: 'دفعة محتوى',
        roleRefresh: 'تحديث للدور',
        topUpFirst: 'احتجت لشحن',
      },
    },
  },
};

const EN_KEYS = {
  dashboard: {
    welcomeMorning: 'Good morning, {{name}}',
    welcomeEvening: 'Good evening, {{name}}',
    streak: 'd',
    nextTask: {
      title: 'Your Next Move',
      actCta: 'Start now',
      dismiss: 'Not now',
      highConfidence: 'Highly recommended',
      empty: 'You are on track. No new suggestions.',
    },
    pulse: {
      title: 'Your Career Pulse',
      radarScore: 'Radar Score',
      radarOutOf100: 'out of 100',
      lastUpdated: 'Last updated',
      resumeReady: 'Resume',
      noResumeYet: 'No resume yet',
      atsScore: 'ATS',
      contentVelocity: 'Content Velocity',
      postsLast30Days: '{{count}} posts last 30 days',
      noContentYet: 'No content yet',
      wallet: 'Balance',
      bonusExpiringSoon: 'Bonus expiring soon',
    },
    quickWins: {
      title: 'Quick Wins',
      apply: 'Apply',
    },
    activity: {
      title: 'Recent Activity',
      viewAll: 'View all',
      empty: 'No activity yet',
      actions: {
        'radar.completed': 'Completed Radar analysis',
        'radar.cache_hit': 'Viewed cached analysis',
        'radar.applied_fix': 'Applied a quick win',
        'radar.reverted_fix': 'Reverted a quick win',
        'resume.built': 'Built new resume',
        'resume.new_version_built': 'Created new resume version',
        'resume.refined': 'Refined your resume',
        'resume.legacy_imported': 'Imported legacy resume',
        'resume.archived': 'Archived resume',
        'resume.exported_pdf': 'Exported resume PDF',
        'resume.exported_docx': 'Exported resume DOCX',
        'content.post.created': 'Created a post',
        'content.carousel.created': 'Created a carousel',
        'content.repurpose_bundle.created': 'Repurpose bundle',
        'content.refined': 'Refined content',
        'content.published': 'Published content',
        'content.exported_pdf': 'Exported content PDF',
        'content.legacy_imported': 'Imported legacy post',
        'onboarding.completed': 'Completed onboarding',
        'career_profile.updated': 'Updated career profile',
        'next_task.dismissed': 'Dismissed a suggestion',
        'next_task.actioned': 'Started a suggestion',
      },
    },
    drafts: {
      title: 'Drafts Library',
      resume: 'Resumes',
      content: 'Content',
      radar: 'Analyses',
      noDrafts: 'No active drafts',
      openEditor: 'Open',
    },
    sufficesFor: {
      title: 'Your balance is enough for',
      or: 'OR',
      radarCount: '{{count}} analyses',
      resumeCount: '{{count}} resumes',
      postCount: '{{count}} posts',
      carouselCount: '{{count}} carousels',
      repurposeCount: '{{count}} bundles',
      recommendedBundle: 'Recommended for you',
      addTokens: 'Add tokens',
      bundles: {
        fullJourney: 'Full journey',
        contentPush: 'Content push',
        roleRefresh: 'Role refresh',
        topUpFirst: 'Top up first',
      },
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
