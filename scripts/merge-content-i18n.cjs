#!/usr/bin/env node
/**
 * Idempotent merge of Content v2 (Sprint 5) translation keys into the
 * existing client/public/locales/{ar,en}/translation.json. Run repeatedly
 * without duplicating keys.
 *
 * Adds the `content.*` namespace. Existing keys are never overwritten —
 * only missing keys are added.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AR_PATH = path.join(ROOT, 'client', 'public', 'locales', 'ar', 'translation.json');
const EN_PATH = path.join(ROOT, 'client', 'public', 'locales', 'en', 'translation.json');

const AR_KEYS = {
  content: {
    title: 'المحتوى المهني',
    subtitle: 'ابنِ حضورك المهني',
    modes: {
      post: {
        name: 'منشور',
        cost: '5 توكن',
        duration: '~10 ثانية',
        desc: 'منشور قصير مرتكز على فكرة واحدة',
      },
      carousel: {
        name: 'كاروسيل',
        cost: '25 توكن',
        duration: '~30 ثانية',
        desc: '5-8 شرائح تشرح فكرة كاملة',
      },
      repurpose: {
        name: 'حزمة إعادة توظيف',
        cost: '15 توكن',
        duration: '~20 ثانية',
        desc: 'حوّل منشورك إلى كاروسيل + فيديو + متابعة',
      },
    },
    hub: {
      newPost: '+ منشور جديد',
      newCarousel: '+ كاروسيل جديد',
      newRepurpose: '+ حزمة إعادة توظيف',
      chooseMode: 'اختر نوع المحتوى',
      quickStart: 'اقتراحات سريعة',
      quickStartHint: 'مبنية على بروفايلك',
      recent: 'الأحدث',
      archived: 'المؤرشف',
      legacy: 'محتوى قديم',
      emptyState: 'لم تنشئ محتوى بعد — ابدأ الآن!',
    },
    preflight: {
      yourTopic: 'موضوعك',
      suggestedTopics: 'موضوعات مقترحة لك',
      topicPlaceholder: 'اكتب موضوعك أو اختر من المقترحات',
      pickSource: 'اختر منشوراً للإعادة',
      noEligibleSources: 'لا توجد منشورات قابلة لإعادة التوظيف. أنشئ منشوراً أولاً.',
      start: 'ابدأ ({{cost}} توكن)',
      viewCached: 'عرض النسخة الحالية (مجاناً)',
      cachedFootnote: 'يتم خصم التوكنات بعد نجاح التوليد. لو فشل — يتم استرداد توكناتك تلقائياً.',
    },
    generating: {
      drafting: 'صياغة المحتوى...',
      draftingPost: 'صياغة المنشور...',
      preparing: 'تحضير الشرائح...',
      writing: 'كتابة المحتوى...',
      formatting: 'تنسيق المرئيات...',
      analyzing: 'تحليل المنشور الأصلي...',
      bundling: 'بناء الحزمة...',
      keepTabOpen: 'جارٍ التوليد — لا تُغلق النافذة',
      almostThere: 'لحظة، اقترب من النهاية...',
      ready: '✓ المحتوى جاهز',
      failed: '✕ فشل التوليد',
      noTokensCharged: 'لم يتم خصم أي توكنات. يمكنك إعادة المحاولة بأمان',
    },
    editor: {
      titlePost: 'منشور',
      titleCarousel: 'كاروسيل',
      titleRepurpose: 'حزمة إعادة توظيف',
      copy: 'نسخ',
      copied: 'تم النسخ ✓',
      exportPdf: 'تصدير PDF',
      exporting: 'جارٍ التصدير...',
      markPublished: 'تم النشر على LinkedIn',
      publishing: 'جارٍ التحديث...',
      setReminder: 'تذكير لاحقاً',
      editReminder: 'تعديل التذكير',
      archive: 'أرشفة',
      archiving: 'جارٍ الأرشفة...',
      restore: 'استعادة',
      refinement: 'تحسينات سريعة',
      freeRefinements: '{{remaining}} من 5 مجانية',
      paidRefinement: '5 توكنات/تحسين',
      afterFive: 'بعد 5، كل تعديل = 5 توكنات',
      legacyBanner: 'هذا محتوى قديم للقراءة فقط. ابدأ محتوى جديداً لتفعيل التحسينات.',
      toneViolationsBanner: 'لاحظ المحرر بعض الأنماط غير المُفضّلة في النص. يمكنك تحسينها عبر التحسينات السريعة.',
      cachedBadge: 'مخزّن — 0 توكن',
      chips: {
        shorter: 'اجعله أقصر',
        longer: 'اجعله أطول',
        moreProfessional: 'أكثر احترافية',
        morePersonal: 'أكثر شخصية',
        differentHook: 'افتتاحية مختلفة',
        differentCta: 'دعوة مختلفة',
        rephrase: 'إعادة صياغة',
      },
      tabs: {
        carousel: 'الكاروسيل',
        videoScript: 'نص الفيديو',
        followUpPost: 'المنشور التالي',
      },
      slide: 'الشريحة',
      caption: 'الوصف',
      imagePromptHint: 'وصف الصورة (اختياري)',
      hookLabel: 'الافتتاحية',
      beatsLabel: 'النقاط',
      ctaLabel: 'الدعوة',
      videoLength: 'نص الفيديو (60 ثانية)',
    },
    reminder: {
      title: 'تذكّرني بالنشر',
      in1hour: 'بعد ساعة',
      in3hours: 'بعد 3 ساعات',
      tomorrow9am: 'غداً 9 صباحاً',
      tomorrow7pm: 'غداً 7 مساءً',
      custom: 'وقت مخصص',
      pending: 'التذكير قيد الانتظار',
    },
    status: {
      active: 'نشط',
      archived: 'مؤرشف',
      published: 'منشور',
      legacy: 'قديم',
    },
    errors: {
      noCareerProfile: 'أكمل البروفايل المهني أولاً',
      insufficientTokens: 'رصيدك غير كافٍ',
      generationFailed: 'فشل التوليد. تم استرداد توكناتك',
      topicRequired: 'اكتب موضوعاً أولاً',
      sourcePostRequired: 'اختر منشوراً للإعادة',
      contentNotFound: 'لم نجد المحتوى',
      copyFailed: 'تعذر النسخ — انسخ يدوياً',
      legacyReadOnly: 'هذا المحتوى للقراءة فقط',
    },
  },
};

const EN_KEYS = {
  content: {
    title: 'Career Content',
    subtitle: 'Build your professional presence',
    modes: {
      post: {
        name: 'Post',
        cost: '5 tokens',
        duration: '~10 sec',
        desc: 'A short post anchored on one idea',
      },
      carousel: {
        name: 'Carousel',
        cost: '25 tokens',
        duration: '~30 sec',
        desc: '5–8 slides that teach one idea',
      },
      repurpose: {
        name: 'Repurpose Bundle',
        cost: '15 tokens',
        duration: '~20 sec',
        desc: 'Turn a post into a carousel + video + follow-up',
      },
    },
    hub: {
      newPost: '+ New Post',
      newCarousel: '+ New Carousel',
      newRepurpose: '+ New Repurpose Bundle',
      chooseMode: 'Choose a mode',
      quickStart: 'Quick start',
      quickStartHint: 'Based on your profile',
      recent: 'Recent',
      archived: 'Archived',
      legacy: 'Legacy content',
      emptyState: 'No content yet — start now!',
    },
    preflight: {
      yourTopic: 'Your topic',
      suggestedTopics: 'Suggested topics',
      topicPlaceholder: 'Write your topic or pick a suggestion',
      pickSource: 'Pick a post to repurpose',
      noEligibleSources: 'No eligible posts to repurpose. Create a post first.',
      start: 'Start ({{cost}} tokens)',
      viewCached: 'View cached (free)',
      cachedFootnote: 'Tokens are deducted on success. If generation fails, your tokens are automatically refunded.',
    },
    generating: {
      drafting: 'Drafting the content…',
      draftingPost: 'Drafting the post…',
      preparing: 'Preparing slides…',
      writing: 'Writing the content…',
      formatting: 'Formatting visuals…',
      analyzing: 'Analyzing the original post…',
      bundling: 'Building the bundle…',
      keepTabOpen: 'Generating — keep this tab open.',
      almostThere: 'Almost there…',
      ready: '✓ Content ready',
      failed: '✕ Generation failed',
      noTokensCharged: 'No tokens were charged. You can safely retry.',
    },
    editor: {
      titlePost: 'Post',
      titleCarousel: 'Carousel',
      titleRepurpose: 'Repurpose Bundle',
      copy: 'Copy',
      copied: 'Copied ✓',
      exportPdf: 'Export PDF',
      exporting: 'Exporting…',
      markPublished: 'Mark as published',
      publishing: 'Updating…',
      setReminder: 'Remind me later',
      editReminder: 'Edit reminder',
      archive: 'Archive',
      archiving: 'Archiving…',
      restore: 'Restore',
      refinement: 'Quick refinements',
      freeRefinements: '{{remaining}} of 5 free',
      paidRefinement: '5 tokens / refinement',
      afterFive: 'After 5, each refinement = 5 tokens',
      legacyBanner: 'This is legacy content (read-only). Start new content to refine.',
      toneViolationsBanner: 'The editor flagged a few unwelcome patterns. You can polish them with the quick refinements.',
      cachedBadge: 'Cached — 0 tokens',
      chips: {
        shorter: 'Make shorter',
        longer: 'Make longer',
        moreProfessional: 'More professional',
        morePersonal: 'More personal',
        differentHook: 'Different hook',
        differentCta: 'Different CTA',
        rephrase: 'Rephrase',
      },
      tabs: {
        carousel: 'Carousel',
        videoScript: 'Video script',
        followUpPost: 'Follow-up post',
      },
      slide: 'Slide',
      caption: 'Caption',
      imagePromptHint: 'Image prompt (optional)',
      hookLabel: 'Hook',
      beatsLabel: 'Beats',
      ctaLabel: 'CTA',
      videoLength: 'Video script (60 sec)',
    },
    reminder: {
      title: 'Remind me to post',
      in1hour: 'In 1 hour',
      in3hours: 'In 3 hours',
      tomorrow9am: 'Tomorrow 9 AM',
      tomorrow7pm: 'Tomorrow 7 PM',
      custom: 'Custom time',
      pending: 'Reminder pending',
    },
    status: {
      active: 'Active',
      archived: 'Archived',
      published: 'Published',
      legacy: 'Legacy',
    },
    errors: {
      noCareerProfile: 'Complete your career profile first',
      insufficientTokens: 'Not enough tokens',
      generationFailed: 'Generation failed. Your tokens were refunded',
      topicRequired: 'Write a topic first',
      sourcePostRequired: 'Pick a post to repurpose',
      contentNotFound: 'Content not found',
      copyFailed: 'Copy failed — copy manually',
      legacyReadOnly: 'This content is read-only',
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
