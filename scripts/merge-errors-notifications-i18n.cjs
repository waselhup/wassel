#!/usr/bin/env node
/**
 * Idempotent merge of Sprint 8 (Errors + Notifications) translation keys
 * into client/public/locales/{ar,en}/translation.json. Run repeatedly without
 * duplicating keys; existing keys are NEVER overwritten.
 *
 * Adds two namespaces:
 *   - errors.*        (nested: auth, tokens, ai, linkedin, payment, network,
 *                      validation, database, generic — each has title/body/cta)
 *   - notifications.* (bell, list, settings, templates)
 *
 * The legacy flat `errors.{service_busy,timeout,...}` keys from Sprint 1
 * scaffolding are preserved (deepMerge never overwrites).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AR_PATH = path.join(ROOT, 'client', 'public', 'locales', 'ar', 'translation.json');
const EN_PATH = path.join(ROOT, 'client', 'public', 'locales', 'en', 'translation.json');

const AR_KEYS = {
  errors: {
    auth: {
      required: {
        title: 'تسجيل دخول مطلوب',
        body:  'يرجى تسجيل الدخول للمتابعة.',
        cta:   'تسجيل دخول',
      },
      expired: {
        title: 'انتهت الجلسة',
        body:  'تقدّمك محفوظ. سجّل دخول مرة أخرى للمتابعة.',
        cta:   'تسجيل دخول',
      },
    },
    tokens: {
      insufficient: {
        title: 'رصيدك غير كافٍ',
        body:  'تحتاج توكنات إضافية لإكمال هذه العملية.',
        cta:   'إضافة توكنات',
      },
      refund_failed: {
        title: 'فشل استرداد التوكن',
        body:  'تواصل مع الدعم وسنحل المشكلة بسرعة.',
        cta:   'تواصل مع الدعم',
      },
    },
    ai: {
      rate_limit: {
        title: 'الخدمة مزدحمة قليلاً',
        body:  'تم استرداد {{refundedTokens}} توكن. حاول بعد دقيقة.',
        cta:   'إعادة المحاولة',
      },
      overloaded: {
        title: 'الذكاء الاصطناعي مشغول',
        body:  'تم استرداد توكناتك. أعد المحاولة خلال دقائق.',
        cta:   'إعادة المحاولة',
      },
      timeout: {
        title: 'انتهت المهلة',
        body:  'العملية أخذت وقتاً أطول من المعتاد. تم استرداد {{refundedTokens}} توكن.',
        cta:   'إعادة المحاولة',
      },
      generation_failed: {
        title: 'تعذّر إكمال العملية',
        body:  'تم استرداد {{refundedTokens}} توكن. أعد المحاولة.',
        cta:   'إعادة المحاولة',
      },
    },
    linkedin: {
      not_found: {
        title: 'البروفايل غير موجود',
        body:  'تأكد من الرابط. تم استرداد توكناتك.',
        cta:   'تعديل الرابط',
      },
      private: {
        title: 'البروفايل خاص',
        body:  'اضبط بروفايل LinkedIn ليكون عاماً، أو ارفع سيرة بديلة.',
        cta:   'رفع سيرة',
      },
      invalid_url: {
        title: 'رابط LinkedIn غير صالح',
        body:  'تأكد من الرابط. يفترض أن يبدأ بـ linkedin.com/in/',
        cta:   'تعديل',
      },
      scrape_failed: {
        title: 'تعذّر الوصول للبروفايل',
        body:  'تم استرداد {{refundedTokens}} توكن. أعد المحاولة.',
        cta:   'إعادة المحاولة',
      },
    },
    payment: {
      failed: {
        title: 'فشل الدفع',
        body:  'تم إلغاء الحجز التلقائي. لم يُخصم من حسابك.',
        cta:   'إعادة المحاولة',
      },
      cancelled: {
        title: 'تم إلغاء الدفع',
        body:  'يمكنك إعادة المحاولة في أي وقت.',
        cta:   'إعادة المحاولة',
      },
    },
    network: {
      generic: {
        title: 'مشكلة في الاتصال',
        body:  'تحقق من الإنترنت وأعد المحاولة.',
        cta:   'إعادة المحاولة',
      },
    },
    validation: {
      generic: {
        title: 'بيانات غير صحيحة',
        body:  'راجع الحقول وحاول مجدداً.',
        cta:   'تعديل',
      },
    },
    database: {
      generic: {
        title: 'خطأ في النظام',
        body:  'تواصل مع الدعم لو تكرر.',
        cta:   'تواصل مع الدعم',
      },
      not_found: {
        title: 'لم نجد ما تبحث عنه',
        body:  'ربما تم حذفه أو أن الرابط غير صالح.',
        cta:   'عودة للرئيسية',
      },
    },
    generic: {
      unknown: {
        title: 'حدث خطأ',
        body:  'تم استرداد {{refundedTokens}} توكن إن وُجد. تواصل مع الدعم لو تكرر.',
        cta:   'تواصل مع الدعم',
      },
    },
  },
  notifications: {
    bell: {
      title: 'الإشعارات',
      noUnread: 'لا إشعارات جديدة',
      markAllRead: 'تعليم الكل كمقروء',
      viewAll: 'عرض الكل',
      newBadge: 'جديد',
    },
    list: {
      title: 'الإشعارات',
      filter: {
        all: 'الكل',
        unread: 'غير مقروء',
      },
      empty: 'لا إشعارات بعد',
    },
    settings: {
      title: 'إعدادات الإشعارات',
      email: 'إشعارات البريد الإلكتروني',
      inApp: 'إشعارات داخل التطبيق',
      marketingEmails: 'نصائح ومحتوى وتحديثات',
      marketingEmailsHelp: 'نرسل لك نصائح مهنية أسبوعياً. يمكنك إيقافها في أي وقت.',
      quietHours: 'ساعات الهدوء',
      quietHoursHelp: 'لن نرسل إشعارات خلال هذه الساعات.',
      from: 'من',
      to: 'إلى',
      language: 'لغة الإشعارات',
      testNotification: 'إرسال إشعار تجريبي',
      testSent: 'تم — تحقق من الجرس',
      testFailed: 'فشل الإرسال',
    },
    templates: {
      balance_low: {
        title: 'رصيدك قارب على النفاد',
        body:  'تبقى لك {{balance}} توكن. أضف توكنات لمتابعة رحلتك المهنية.',
        cta:   'إضافة توكنات',
      },
      subscription_renewal: {
        title: 'اشتراكك يتجدد قريباً',
        body:  'اشتراك {{plan}} يتجدد في {{date}} بمبلغ {{amount}} ر.س.',
        cta:   'إدارة الاشتراك',
      },
      bonus_expiring: {
        title: 'مكافأتك تنتهي قريباً',
        body:  '{{bonusTokens}} توكن مكافأة تنتهي في {{date}}. استخدمها قبل أن تخسرها.',
        cta:   'ابدأ الآن',
      },
      payment_succeeded: {
        title: 'تم الدفع بنجاح',
        body:  'تم إضافة {{tokens}} توكن إلى رصيدك.',
        cta:   'عرض السجل',
      },
      next_task_ready: {
        title: 'مهمتك التالية جاهزة',
        body:  '{{taskHeadline}}',
        cta:   'ابدأ الآن',
      },
    },
  },
};

const EN_KEYS = {
  errors: {
    auth: {
      required: {
        title: 'Sign in required',
        body:  'Please sign in to continue.',
        cta:   'Sign in',
      },
      expired: {
        title: 'Session expired',
        body:  'Your progress is saved. Sign in again to continue.',
        cta:   'Sign in',
      },
    },
    tokens: {
      insufficient: {
        title: 'Not enough tokens',
        body:  'You need more tokens to complete this action.',
        cta:   'Add tokens',
      },
      refund_failed: {
        title: 'Refund failed',
        body:  'Contact support and we\'ll sort it out quickly.',
        cta:   'Contact support',
      },
    },
    ai: {
      rate_limit: {
        title: 'Service is busy',
        body:  '{{refundedTokens}} tokens refunded. Try again in a minute.',
        cta:   'Try again',
      },
      overloaded: {
        title: 'AI is overloaded',
        body:  'Your tokens have been refunded. Try again in a few minutes.',
        cta:   'Try again',
      },
      timeout: {
        title: 'Request timed out',
        body:  'The operation took longer than usual. {{refundedTokens}} tokens refunded.',
        cta:   'Try again',
      },
      generation_failed: {
        title: 'Generation failed',
        body:  '{{refundedTokens}} tokens refunded. Try again.',
        cta:   'Try again',
      },
    },
    linkedin: {
      not_found: {
        title: 'Profile not found',
        body:  'Double-check the link. Your tokens were refunded.',
        cta:   'Edit link',
      },
      private: {
        title: 'Profile is private',
        body:  'Set your LinkedIn profile to public, or upload a resume instead.',
        cta:   'Upload resume',
      },
      invalid_url: {
        title: 'Invalid LinkedIn URL',
        body:  'The link should start with linkedin.com/in/',
        cta:   'Edit',
      },
      scrape_failed: {
        title: 'Couldn\'t reach the profile',
        body:  '{{refundedTokens}} tokens refunded. Try again.',
        cta:   'Try again',
      },
    },
    payment: {
      failed: {
        title: 'Payment failed',
        body:  'The hold was cancelled. Nothing was charged to your card.',
        cta:   'Try again',
      },
      cancelled: {
        title: 'Payment cancelled',
        body:  'You can try again any time.',
        cta:   'Try again',
      },
    },
    network: {
      generic: {
        title: 'Connection problem',
        body:  'Check your internet and try again.',
        cta:   'Try again',
      },
    },
    validation: {
      generic: {
        title: 'Invalid input',
        body:  'Review the fields and try again.',
        cta:   'Edit',
      },
    },
    database: {
      generic: {
        title: 'System error',
        body:  'Contact support if it keeps happening.',
        cta:   'Contact support',
      },
      not_found: {
        title: 'Not found',
        body:  'It may have been deleted, or the link is invalid.',
        cta:   'Back to home',
      },
    },
    generic: {
      unknown: {
        title: 'Something went wrong',
        body:  '{{refundedTokens}} tokens refunded if any. Contact support if it keeps happening.',
        cta:   'Contact support',
      },
    },
  },
  notifications: {
    bell: {
      title: 'Notifications',
      noUnread: 'No new notifications',
      markAllRead: 'Mark all as read',
      viewAll: 'View all',
      newBadge: 'New',
    },
    list: {
      title: 'Notifications',
      filter: {
        all: 'All',
        unread: 'Unread',
      },
      empty: 'No notifications yet',
    },
    settings: {
      title: 'Notification settings',
      email: 'Email notifications',
      inApp: 'In-app notifications',
      marketingEmails: 'Tips, content & updates',
      marketingEmailsHelp: 'Weekly career tips. You can stop them any time.',
      quietHours: 'Quiet hours',
      quietHoursHelp: 'We won\'t send notifications during this window.',
      from: 'From',
      to: 'To',
      language: 'Notification language',
      testNotification: 'Send test notification',
      testSent: 'Sent — check the bell',
      testFailed: 'Failed to send',
    },
    templates: {
      balance_low: {
        title: 'Your balance is running low',
        body:  'You have {{balance}} tokens left. Add tokens to continue your career journey.',
        cta:   'Add tokens',
      },
      subscription_renewal: {
        title: 'Your subscription renews soon',
        body:  'Your {{plan}} subscription renews on {{date}} for {{amount}} SAR.',
        cta:   'Manage subscription',
      },
      bonus_expiring: {
        title: 'Your bonus expires soon',
        body:  '{{bonusTokens}} bonus tokens expire on {{date}}. Use them before they\'re gone.',
        cta:   'Start now',
      },
      payment_succeeded: {
        title: 'Payment successful',
        body:  '{{tokens}} tokens added to your balance.',
        cta:   'View history',
      },
      next_task_ready: {
        title: 'Your next task is ready',
        body:  '{{taskHeadline}}',
        cta:   'Start now',
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
