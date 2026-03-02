/**
 * Arabic Localization Strings - Phase 5
 * 
 * Natural Saudi Arabic tone for trust and conversion
 */

export const i18n = {
  // Common
  loading: 'جاري التحميل...',
  error: 'حدث خطأ',
  retry: 'حاول مرة أخرى',
  cancel: 'إلغاء',
  save: 'حفظ',
  delete: 'حذف',
  close: 'إغلاق',
  back: 'رجوع',
  next: 'التالي',
  previous: 'السابق',

  // Errors
  errorNetwork: 'فشل الاتصال بالخادم. تأكد من اتصالك بالإنترنت.',
  errorSession: 'انتهت جلستك. سجل دخول من جديد.',
  errorPermission: 'ليس لديك صلاحية لهذا الإجراء.',
  errorNotFound: 'لم يتم العثور على البيانات المطلوبة.',
  errorGeneric: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
  errorValidation: 'تحقق من البيانات المدخلة.',

  // Loading
  loadingQueue: 'جاري تحميل الطابور...',
  loadingCampaigns: 'جاري تحميل الحملات...',
  loadingLeads: 'جاري تحميل العملاء...',
  loadingClients: 'جاري تحميل العملاء...',

  // Empty States
  emptyLeadsTitle: 'لا توجد عملاء بعد',
  emptyLeadsDesc: 'ابدأ بإضافة عملاء من LinkedIn باستخدام الإضافة',
  emptyCampaignsTitle: 'لا توجد حملات بعد',
  emptyCampaignsDesc: 'أنشئ حملتك الأولى لبدء إدارة العملاء',
  emptyClientsTitle: 'لا توجد عملاء بعد',
  emptyClientsDesc: 'أضف عميل جديد للبدء في إدارة حملاتهم',
  emptyQueueTitle: 'الطابور فارغ',
  emptyQueueDesc: 'لا توجد عملاء جدد في الانتظار',

  // Queue
  queueNew: 'جديد',
  queueApproved: 'موافق عليه',
  queueAll: 'الكل',
  queueApprove: 'موافقة',
  queueReject: 'رفض',
  queueApproveAll: 'موافقة على الكل',
  queueRejectAll: 'رفض الكل',
  queueSelected: 'محدد',

  // Campaigns
  campaignNew: 'حملة جديدة',
  campaignCreate: 'إنشاء حملة',
  campaignEdit: 'تعديل الحملة',
  campaignDelete: 'حذف الحملة',
  campaignActive: 'نشطة',
  campaignDraft: 'مسودة',
  campaignPaused: 'موقوفة',

  // Clients
  clientNew: 'عميل جديد',
  clientAdd: 'إضافة عميل',
  clientEdit: 'تعديل العميل',
  clientDelete: 'حذف العميل',
  clientAll: 'جميع العملاء',

  // Billing
  planStarter: 'المبتدئ',
  planPro: 'احترافي',
  planAgency: 'وكالة',
  usageTitle: 'استخدام الخطة',
  usageRemaining: 'متبقي',
  usageAtLimit: 'تم الوصول للحد',
  usageNearLimit: 'قريب من الحد',
  upgradeTitle: 'ترقية الخطة',
  upgradeDesc: 'قم بالترقية للحصول على المزيد من الميزات',
  upgradeButton: 'تواصل معنا للترقية',
  upgradeFree: 'مجاني',

  // Success Messages
  successSave: 'تم الحفظ بنجاح',
  successDelete: 'تم الحذف بنجاح',
  successAdd: 'تم الإضافة بنجاح',
  successUpdate: 'تم التحديث بنجاح',
  successApprove: 'تم الموافقة بنجاح',
  successReject: 'تم الرفض بنجاح',

  // Warnings
  warningDelete: 'هل أنت متأكد من حذف هذا؟',
  warningUnsaved: 'لديك تغييرات غير محفوظة',

  // Navigation
  navDashboard: 'لوحة التحكم',
  navQueue: 'الطابور',
  navCampaigns: 'الحملات',
  navClients: 'العملاء',
  navSettings: 'الإعدادات',
  navLogout: 'تسجيل الخروج',

  // Auth
  authLogin: 'تسجيل الدخول',
  authLogout: 'تسجيل الخروج',
  authSignup: 'إنشاء حساب',
  authEmail: 'البريد الإلكتروني',
  authPassword: 'كلمة المرور',
  authRemember: 'تذكرني',
  authForgot: 'هل نسيت كلمة المرور؟',
};

export type I18nKey = keyof typeof i18n;

export function t(key: I18nKey): string {
  return i18n[key] || key;
}
