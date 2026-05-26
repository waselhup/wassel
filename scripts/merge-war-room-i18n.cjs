#!/usr/bin/env node
/**
 * Idempotent merge of War Room translation keys into the existing
 * client/public/locales/{ar,en}/translation.json files.
 * Run repeatedly without duplicating keys.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AR_PATH = path.join(ROOT, 'client', 'public', 'locales', 'ar', 'translation.json');
const EN_PATH = path.join(ROOT, 'client', 'public', 'locales', 'en', 'translation.json');

const AR_KEYS = {
  personaSwitcher: {
    war_room: 'غرفة القيادة',
  },
  warRoom: {
    title: 'غرفة القيادة',
    subtitle: '8 وكلاء جاهزون للعمل',
    morningBrief: 'تقرير الصباح',
    askPlaceholder: 'اكتب رسالتك للفريق...',
    askAgent: 'اسأل وكيلاً',
    send: 'إرسال',
    speakInstead: 'تكلم بدلاً من الكتابة',
    readAloud: 'اقرأ بصوت عالٍ',
    stopReading: 'أوقف القراءة',
    voiceUnsupported: 'متصفحك لا يدعم الصوت',
    thinking: 'الفريق يفكر...',
    knows: 'يعرف',
    ofYourDecisions: 'من قراراتك',
    memoryBadgeAria: '{{count}} قرار محفوظ',
    weeklyJournal: 'يوميات الأسبوع — من فارس',
    basedOn: 'بناء على {{count}} قرار في أسبوع {{week}}',
    generateJournalCta: 'اطلب تقرير الأسبوع من فارس',
    quickActions: 'خيارات سريعة',
    quick: {
      morningBrief: 'صباح الخير، أعطني brief',
      approveSafe: 'وافق على الآمن',
      showYesterday: 'أرني أمس',
    },
    expressions: {
      neutral: 'محايد',
      happy: 'سعيد',
      thinking: 'يفكر',
      concerned: 'قلق',
      excited: 'متحمس',
      frustrated: 'محبط',
    },
    decisions: {
      approve: 'موافقة',
      reject: 'رفض',
      edit: 'تعديل',
      approve_with_changes: 'موافقة مع تعديل',
      ask_question: 'سؤال',
      defer: 'تأجيل',
    },
    agents: {
      faris: { role: 'مدير العمليات', tagline: 'هادئ ومنظم' },
      sayed: { role: 'مدير الإبداع', tagline: 'متحمس ومباشر' },
      al_mukhadram: { role: 'نجاح العملاء', tagline: 'دافئ كعم كبير' },
      hassan: { role: 'مهندس الإيرادات', tagline: 'أرقام بدون مجاملة' },
      fatima: { role: 'بحوث المنتج', tagline: 'صامتة وحاسمة' },
      dhai: { role: 'الامتثال', tagline: 'حامي البزنس' },
      hussein: { role: 'هندسة المنصة', tagline: 'غير مرئي إلا عند الحاجة' },
      mohammed: { role: 'المحاسبة', tagline: 'كل قرار له تكلفة' },
    },
    header: {
      backToUser: 'لوحة المستخدم',
      languageToggle: 'تبديل اللغة',
    },
    status: {
      idle: 'متاح',
      thinking: 'يفكر',
      speaking: 'يتحدث',
      offline: 'غير متصل',
    },
    errors: {
      sessionFailed: 'تعذر بدء الجلسة',
      sendFailed: 'تعذر إرسال الرسالة',
      briefFailed: 'تعذر توليد تقرير الصباح',
    },
  },
};

const EN_KEYS = {
  personaSwitcher: {
    war_room: 'War Room',
  },
  warRoom: {
    title: 'War Room',
    subtitle: '8 agents ready to work',
    morningBrief: 'Morning Brief',
    askPlaceholder: 'Type a message to the team...',
    askAgent: 'Ask an agent',
    send: 'Send',
    speakInstead: 'Speak instead',
    readAloud: 'Read aloud',
    stopReading: 'Stop reading',
    voiceUnsupported: 'Your browser does not support voice',
    thinking: 'Team is thinking...',
    knows: 'Knows',
    ofYourDecisions: 'of your decisions',
    memoryBadgeAria: '{{count}} stored decisions',
    weeklyJournal: 'Weekly Journal — from Faris',
    basedOn: 'Based on {{count}} decisions in week {{week}}',
    generateJournalCta: 'Request weekly journal from Faris',
    quickActions: 'Quick options',
    quick: {
      morningBrief: 'Good morning, give me brief',
      approveSafe: 'Approve all safe',
      showYesterday: 'Show me yesterday',
    },
    expressions: {
      neutral: 'Neutral',
      happy: 'Happy',
      thinking: 'Thinking',
      concerned: 'Concerned',
      excited: 'Excited',
      frustrated: 'Frustrated',
    },
    decisions: {
      approve: 'Approve',
      reject: 'Reject',
      edit: 'Edit',
      approve_with_changes: 'Approve with changes',
      ask_question: 'Ask question',
      defer: 'Defer',
    },
    agents: {
      faris: { role: 'COO', tagline: 'Calm and organized' },
      sayed: { role: 'Creative Director', tagline: 'Energetic and direct' },
      al_mukhadram: { role: 'Customer Success', tagline: 'Warm like an elder' },
      hassan: { role: 'Revenue Engineer', tagline: 'Numbers without flattery' },
      fatima: { role: 'Product Research', tagline: 'Silent and decisive' },
      dhai: { role: 'Compliance', tagline: 'Business guardian' },
      hussein: { role: 'Platform Engineering', tagline: 'Invisible until needed' },
      mohammed: { role: 'Accounting', tagline: 'Every decision has a cost' },
    },
    header: {
      backToUser: 'User app',
      languageToggle: 'Toggle language',
    },
    status: {
      idle: 'Idle',
      thinking: 'Thinking',
      speaking: 'Speaking',
      offline: 'Offline',
    },
    errors: {
      sessionFailed: 'Could not start session',
      sendFailed: 'Could not send message',
      briefFailed: 'Could not generate morning brief',
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
