/**
 * Public company / legal information surfaced in footers, About, Contact,
 * Privacy, Terms and Refund pages.
 *
 * Real values only — fields that aren't issued yet stay as `null` and the
 * UI renders nothing (or a "تسجيل قيد الإصدار" badge) instead of placeholder
 * digits. Publishing fake CR/VAT/phone numbers on a live commercial site
 * is a Ministry of Commerce / ZATCA violation, so this module enforces
 * the discipline.
 */

export interface CompanyLegalInfo {
  brandAr: string;
  brandEn: string;
  /** Saudi commercial registration number (س.ت) — null until issued */
  commercialRegistration: string | null;
  /** VAT (15%) registration number — null until registered */
  vatNumber: string | null;
  /** Customer support phone — null until provisioned */
  phone: string | null;
  /** General support email */
  email: string;
  /** Refund-specific email */
  refundEmail: string;
  /** Privacy / data-protection email */
  privacyEmail: string;
  /** City of operations */
  city: string;
  /** Country */
  country: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: 'SA';
  /** Business hours, AR */
  businessHoursAr: string;
  /** Business hours, EN */
  businessHoursEn: string;
  /** Timezone label, e.g. "GMT+3 (Riyadh)" */
  timezone: string;
}

export const COMPANY_LEGAL_INFO: CompanyLegalInfo = {
  brandAr: 'وصّل',
  brandEn: 'Wassel',
  commercialRegistration: '7052843203',
  vatNumber: null,
  phone: null,
  email: 'support@wasselhub.com',
  refundEmail: 'support@wasselhub.com',
  privacyEmail: 'support@wasselhub.com',
  city: 'الرياض',
  country: 'المملكة العربية السعودية',
  countryCode: 'SA',
  businessHoursAr: 'الأحد – الخميس، 9:00 ص – 6:00 م',
  businessHoursEn: 'Sunday – Thursday, 9:00 AM – 6:00 PM',
  timezone: 'GMT+3 (Riyadh)',
};

export const COMPLIANCE_AR = {
  digitalRegulation:
    'نلتزم بأنظمة المملكة العربية السعودية ومتطلبات هيئة الاتصالات والفضاء والتقنية.',
  dataProtection:
    'نحمي بياناتك وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية.',
  ecommerce:
    'تشغّل المنصّة وفق نظام التجارة الإلكترونية السعودي.',
  linkedin:
    'نستخدم واجهات معتمدة فقط ولا نخالف شروط منصّات الطرف الثالث.',
} as const;

export const COMPLIANCE_EN = {
  digitalRegulation:
    'We comply with the regulations of the Communications, Space & Technology Commission (CST) of Saudi Arabia.',
  dataProtection:
    'We protect personal data per the Saudi Personal Data Protection Law (PDPL).',
  ecommerce:
    'The platform operates under the Saudi E-commerce Law.',
  linkedin:
    'We use only sanctioned APIs and respect third-party platform terms.',
} as const;

export interface PaymentMethodInfo {
  id: string;
  ar: string;
  en: string;
}

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  { id: 'mada',         ar: 'مدى',        en: 'mada' },
  { id: 'visa',         ar: 'فيزا',       en: 'Visa' },
  { id: 'mastercard',   ar: 'ماستركارد',   en: 'Mastercard' },
  { id: 'apple-pay',    ar: 'أبل باي',     en: 'Apple Pay' },
  { id: 'stc-pay',      ar: 'STC Pay',    en: 'STC Pay' },
];

export const PAYMENT_INFO = {
  providerAr: 'ميسر (Moyasar)',
  providerEn: 'Moyasar',
  providerUrl: 'https://moyasar.com',
  currencyAr: 'ريال سعودي',
  currencyEn: 'SAR',
  refundPeriodDays: 14,
  refundProcessingDaysMin: 3,
  refundProcessingDaysMax: 5,
  // Surfaced as a "coming soon" badge until Moyasar registration is live.
  isLive: false as boolean,
} as const;

/** Year for footer copyright, kept central so we update once. */
export const COPYRIGHT_YEAR = 2026;
