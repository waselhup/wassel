// Add personaSwitcher.*, portal.*, finance.* keys to AR/EN translation files
const fs = require('fs');
const path = require('path');

const AR = {
  personaSwitcher: {
    user: 'وضع المستخدم',
    marketing: 'التسويق',
    finance: 'المالية',
  },
  portal: {
    backToUser: 'العودة إلى لوحة المستخدم',
    adminBadge: 'وضع المؤسس',
  },
  finance: {
    headerTitle: 'مركز المالية',
    subtitle: 'الإيراد، التكاليف، الهوامش، والاشتراكات في صفحة واحدة',
    sarSuffix: 'ر.س',
    s1Title: 'النبض المالي',
    tileMrr: 'الإيراد الشهري',
    tileArr: 'الإيراد السنوي',
    tileNewRev: 'إيراد جديد هذا الشهر',
    tileChurn: 'انسحاب هذا الشهر',
    tileMargin: 'صافي الهامش',
    tileCash: 'النقد المتاح',
    cashManual: 'إدخال يدوي',
    s2Title: 'شلال الإيرادات',
    s2Subtitle: 'من إيراد الشهر الماضي إلى إيراد الشهر الحالي — كل تغيير مرئي',
    wfStarting: 'الإيراد الأولي',
    wfNew: 'إيراد جديد',
    wfExpansion: 'توسع',
    wfChurned: 'منسحب',
    wfEnding: 'الإيراد النهائي',
    s3Title: 'توزيع الباقات',
    plan: 'الباقة',
    users: 'المستخدمون',
    mrr: 'الإيراد الشهري',
    avgTokens: 'متوسط الاستخدام',
    costPerUser: 'تكلفة/مستخدم',
    margin: 'الهامش',
    s4Title: 'نشاط المدفوعات',
    cardSuccessful: 'مدفوعات ناجحة',
    cardFailed: 'مدفوعات فاشلة',
    cardRefunds: 'استرجاعات وتسويات',
    noSuccess: 'لا مدفوعات ناجحة في آخر 30 يوم',
    noFailed: '🎉 لا مدفوعات فاشلة هذا الشهر',
    noRefunds: 'لا استرجاعات',
    s5Title: 'إدارة التكاليف',
    costBreakdownTitle: 'تكلفة الـAPI (آخر 30 يوم)',
    topDriversTitle: 'أعلى 10 محركات للتكلفة',
    costSonnet: 'Claude Sonnet (سيرة + حملات)',
    costHaiku: 'Claude Haiku (تحليل لينكدإن)',
    costApify: 'اكتشاف بيانات لينكدإن',
    costInfra: 'بنية تحتية (Supabase + Vercel)',
    negativeMarginAlert: '⚠️ مستخدم {{plan}} ({{email}}) يكلفك {{overSar}} ر.س أكثر من سعر باقته — راجع حدود الاستخدام',
    s6Title: 'إجراءات وتصدير',
    actionExport: 'تصدير CSV لهذا الشهر',
    actionVat: 'تقرير ضريبة (ZATCA)',
    actionInvoice: 'إنشاء فاتورة لمستخدم',
    actionRefund: 'استرجاع دفعة',
    actionEditCash: 'تعديل النقد',
    actionEditRate: 'تعديل سعر الصرف',
    usdRate: 'سعر صرف USD→SAR',
    invoiceTitle: 'إنشاء فاتورة',
    invoiceReady: 'الفاتورة جاهزة — انسخ الرابط للعميل:',
    invoiceUserId: 'معرّف المستخدم (UUID)',
    invoiceAmount: 'المبلغ (ر.س)',
    invoiceDesc: 'الوصف',
    refundTitle: 'استرجاع دفعة',
    refundPaymentId: 'معرّف الدفعة في Moyasar',
    refundReason: 'السبب',
  },
};

const EN = {
  personaSwitcher: {
    user: 'User Mode',
    marketing: 'Marketing',
    finance: 'Finance',
  },
  portal: {
    backToUser: 'Back to User Dashboard',
    adminBadge: 'Founder Mode',
  },
  finance: {
    headerTitle: 'Finance Command Center',
    subtitle: 'Revenue, costs, margins, and subscriptions on one screen',
    sarSuffix: 'SAR',
    s1Title: 'Financial Pulse',
    tileMrr: 'MRR',
    tileArr: 'ARR',
    tileNewRev: 'New revenue this month',
    tileChurn: 'Churn this month',
    tileMargin: 'Net margin',
    tileCash: 'Cash on hand',
    cashManual: 'Manual entry',
    s2Title: 'Revenue Waterfall',
    s2Subtitle: 'From last month MRR to this month MRR — every change visible',
    wfStarting: 'Starting MRR',
    wfNew: 'New MRR',
    wfExpansion: 'Expansion',
    wfChurned: 'Churned',
    wfEnding: 'Ending MRR',
    s3Title: 'Plan Breakdown',
    plan: 'Plan',
    users: 'Users',
    mrr: 'MRR',
    avgTokens: 'Avg tokens',
    costPerUser: 'Cost / user',
    margin: 'Margin',
    s4Title: 'Payment Activity',
    cardSuccessful: 'Successful payments',
    cardFailed: 'Failed payments',
    cardRefunds: 'Refunds & adjustments',
    noSuccess: 'No successful payments in the last 30 days',
    noFailed: '🎉 No failed payments this month',
    noRefunds: 'No refunds',
    s5Title: 'Cost Control',
    costBreakdownTitle: 'API cost (last 30 days)',
    topDriversTitle: 'Top 10 cost drivers',
    costSonnet: 'Claude Sonnet (CV + campaigns)',
    costHaiku: 'Claude Haiku (LinkedIn analysis)',
    costApify: 'LinkedIn discovery',
    costInfra: 'Infra (Supabase + Vercel)',
    negativeMarginAlert: '⚠️ {{plan}} user ({{email}}) is costing {{overSar}} SAR more than their plan — review usage cap',
    s6Title: 'Actions & Exports',
    actionExport: 'Export this month CSV',
    actionVat: 'ZATCA VAT report',
    actionInvoice: 'Generate invoice for user',
    actionRefund: 'Refund payment',
    actionEditCash: 'Edit cash',
    actionEditRate: 'Edit USD→SAR',
    usdRate: 'USD→SAR rate',
    invoiceTitle: 'Generate invoice',
    invoiceReady: 'Invoice ready — copy this link for the customer:',
    invoiceUserId: 'User ID (UUID)',
    invoiceAmount: 'Amount (SAR)',
    invoiceDesc: 'Description',
    refundTitle: 'Refund payment',
    refundPaymentId: 'Moyasar payment ID',
    refundReason: 'Reason',
  },
};

function merge(base, add) {
  for (const k of Object.keys(add)) {
    if (typeof add[k] === 'object' && add[k] !== null && !Array.isArray(add[k])) {
      if (typeof base[k] !== 'object' || base[k] === null) base[k] = {};
      merge(base[k], add[k]);
    } else {
      base[k] = add[k];
    }
  }
}

for (const [lang, keys] of [['ar', AR], ['en', EN]]) {
  const p = path.join('client', 'public', 'locales', lang, 'translation.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  merge(j, keys);
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log(lang, '✅ portal + finance + personaSwitcher keys merged');
}
