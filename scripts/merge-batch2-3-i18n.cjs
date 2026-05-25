#!/usr/bin/env node
/**
 * Idempotent merge of batch 2+3 translation keys into the existing
 * client/public/locales/{ar,en}/translation.json files.
 *
 * Run repeatedly without duplicating keys.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AR_PATH = path.join(ROOT, 'client', 'public', 'locales', 'ar', 'translation.json');
const EN_PATH = path.join(ROOT, 'client', 'public', 'locales', 'en', 'translation.json');

// Keys to merge. Each top-level key is namespace.
const AR_KEYS = {
  personaSwitcher: {
    customer_success: 'نجاح العملاء',
    revenue_lab: 'مختبر الإيرادات',
    product_intel: 'ذكاء المنتج',
    compliance: 'الامتثال',
  },
  customerSuccess: {
    headerTitle: 'نجاح العملاء',
    subtitle: 'يحافظ، يرعى، ويرفع',
    agentName: 'المخضرم',
    agentTagline: 'عضوكم الكبير في نجاح العملاء',
    actions: {
      welcomeSequence: 'صياغة تسلسل الترحيب',
      dailyRescues: 'رسائل استرداد يومية',
      recomputeHealth: 'إعادة حساب الصحة',
      flagVips: 'وسم كبار العملاء',
    },
    healthCohorts: 'شرائح الصحة',
    topHealthScores: 'أعلى نقاط الصحة',
    whatsappMessages: 'رسائل واتساب',
    emailMessages: 'رسائل البريد',
  },
  revenueLab: {
    headerTitle: 'مختبر الإيرادات',
    subtitle: 'يصمم العروض، يشغّل التجارب، يحوّل',
    agentName: 'حسن',
    agentTagline: 'كاتب الإعلانات والمحول',
    hotLeads: 'العملاء الحارّون',
    pendingPitches: 'عروض ترقية بانتظار الموافقة',
    experiments: 'التجارب',
    referrals: 'برنامج الإحالة',
    actions: {
      hotPitches: 'عروض حارة',
      proposeExperiment: 'اقتراح تجربة',
      newReferral: 'كود إحالة جديد',
    },
  },
  productIntel: {
    headerTitle: 'ذكاء المنتج',
    subtitle: 'تكتشف، تقترح، لا تنفّذ',
    agentName: 'فاطمة',
    suggestOnlyBadge: 'وضع: اقتراح فقط',
    frictionPatterns: 'أنماط الاحتكاك',
    weeklyReport: 'التقرير الأسبوعي',
    userVoiceThemes: 'مواضيع صوت المستخدم',
    recommendations: 'توصيات',
    actions: {
      detectFriction: 'فحص الاحتكاكات',
      generateWeeklyReport: 'توليد التقرير الأسبوعي',
      digestUserVoice: 'صوت المستخدم',
    },
  },
  compliance: {
    headerTitle: 'الامتثال',
    subtitle: 'تحرس، تراقب، توثّق',
    agentName: 'ضي',
    fraudSignals: 'إشارات الاحتيال',
    moderationLog: 'سجل تدقيق المحتوى',
    pdplAudit: 'سجل PDPL',
    actions: {
      dailySweep: 'فحص يومي شامل',
    },
    decisions: {
      approved: 'موافق',
      flagged: 'موسوم',
      blocked: 'محظور',
    },
    review: {
      confirmedFraud: 'احتيال',
      falsePositive: 'سليم',
    },
  },
  upgradeModal: {
    defaultHeadline: 'ارفع مستواك على وصل',
    defaultBody: 'استفد من باقات وصل المدفوعة لتسريع رحلتك المهنية.',
    defaultCta: 'عرض الباقات',
    maybeLater: 'ربما لاحقاً',
  },
  health: {
    segments: {
      vip: 'كبار العملاء',
      active: 'نشط',
      warm_lead: 'دافئ',
      hot_lead: 'حار',
      at_risk: 'في خطر',
      dormant: 'خامل',
      churned: 'متخلٍّ',
    },
  },
  agents: {
    al_mukhadram: { ar: 'المخضرم', role: 'نجاح العملاء' },
    hassan: { ar: 'حسن', role: 'مختبر الإيرادات' },
    fatima: { ar: 'فاطمة', role: 'ذكاء المنتج' },
    dhai: { ar: 'ضي', role: 'الامتثال' },
    hussein: { ar: 'حسين', role: 'العمليات' },
    mohammed: { ar: 'محمد', role: 'المالية' },
  },
};

const EN_KEYS = {
  personaSwitcher: {
    customer_success: 'Customer Success',
    revenue_lab: 'Revenue Lab',
    product_intel: 'Product Intel',
    compliance: 'Compliance',
  },
  customerSuccess: {
    headerTitle: 'Customer Success',
    subtitle: 'Retains, nurtures, lifts',
    agentName: 'Al-Mukhadram',
    agentTagline: 'Seasoned customer success lead',
    actions: {
      welcomeSequence: 'Draft welcome sequence',
      dailyRescues: 'Daily rescue drafts',
      recomputeHealth: 'Recompute health',
      flagVips: 'Flag VIPs',
    },
    healthCohorts: 'Health Cohorts',
    topHealthScores: 'Top Health Scores',
    whatsappMessages: 'WhatsApp Messages',
    emailMessages: 'Email Messages',
  },
  revenueLab: {
    headerTitle: 'Revenue Lab',
    subtitle: 'Drafts pitches, runs experiments, converts',
    agentName: 'Hassan',
    agentTagline: 'Revenue copywriter',
    hotLeads: 'Hot Leads',
    pendingPitches: 'Pending Pitches',
    experiments: 'Experiments',
    referrals: 'Referrals',
    actions: {
      hotPitches: 'Hot upgrade pitches',
      proposeExperiment: 'Propose experiment',
      newReferral: 'New referral code',
    },
  },
  productIntel: {
    headerTitle: 'Product Intelligence',
    subtitle: 'Observes, suggests, never executes',
    agentName: 'Fatima',
    suggestOnlyBadge: 'suggest-only mode',
    frictionPatterns: 'Friction Patterns',
    weeklyReport: 'Weekly Report',
    userVoiceThemes: 'User Voice Themes',
    recommendations: 'Recommendations',
    actions: {
      detectFriction: 'Detect friction',
      generateWeeklyReport: 'Generate weekly report',
      digestUserVoice: 'Digest user voice',
    },
  },
  compliance: {
    headerTitle: 'Compliance',
    subtitle: 'Guards, monitors, records',
    agentName: 'Dhai',
    fraudSignals: 'Fraud Signals',
    moderationLog: 'Moderation Log',
    pdplAudit: 'PDPL Audit Log',
    actions: {
      dailySweep: 'Daily sweep',
    },
    decisions: {
      approved: 'Approved',
      flagged: 'Flagged',
      blocked: 'Blocked',
    },
    review: {
      confirmedFraud: 'Fraud',
      falsePositive: 'OK',
    },
  },
  upgradeModal: {
    defaultHeadline: 'Level up on Wassel',
    defaultBody: "Unlock Wassel's paid plans to accelerate your career journey.",
    defaultCta: 'View plans',
    maybeLater: 'Maybe later',
  },
  health: {
    segments: {
      vip: 'VIP',
      active: 'Active',
      warm_lead: 'Warm',
      hot_lead: 'Hot',
      at_risk: 'At risk',
      dormant: 'Dormant',
      churned: 'Churned',
    },
  },
  agents: {
    al_mukhadram: { en: 'Al-Mukhadram', role: 'Customer Success' },
    hassan: { en: 'Hassan', role: 'Revenue Lab' },
    fatima: { en: 'Fatima', role: 'Product Intel' },
    dhai: { en: 'Dhai', role: 'Compliance' },
    hussein: { en: 'Hussein', role: 'Operations' },
    mohammed: { en: 'Mohammed', role: 'Finance' },
  },
};

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = target[k] && typeof target[k] === 'object' ? target[k] : {};
      deepMerge(target[k], source[k]);
    } else {
      // only set if missing — don't overwrite existing translations
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
