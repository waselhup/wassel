/**
 * Plan Configuration - Phase 4 Monetization
 * 
 * Hardcoded plan definitions for founder-first SaaS
 * No database required - plans are static
 */

export type PlanType = 'starter' | 'pro' | 'agency';

export interface Plan {
  id: PlanType;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  monthlyLeadLimit: number;
  maxCampaigns: number;
  price: number;
  priceAr: string;
  features: string[];
  featuresAr: string[];
  color: string;
  badge: string;
}

export const PLANS: Record<PlanType, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    nameAr: 'المبتدئ',
    description: 'Perfect for testing Wassel',
    descriptionAr: 'مثالي لاختبار وصل',
    monthlyLeadLimit: 100,
    maxCampaigns: 3,
    price: 0,
    priceAr: 'مجاني',
    features: [
      'Up to 100 leads/month',
      '3 campaigns',
      'Basic analytics',
      'Email support',
    ],
    featuresAr: [
      'حتى 100 عميل شهرياً',
      '3 حملات',
      'تحليلات أساسية',
      'دعم البريد الإلكتروني',
    ],
    color: 'blue',
    badge: 'مبتدئ',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    nameAr: 'احترافي',
    description: 'For growing teams',
    descriptionAr: 'للفرق المتنامية',
    monthlyLeadLimit: 500,
    maxCampaigns: 10,
    price: 99,
    priceAr: '99 ر.س/شهر',
    features: [
      'Up to 500 leads/month',
      '10 campaigns',
      'Advanced analytics',
      'Priority support',
      'Multi-client view',
      'Bulk operations',
    ],
    featuresAr: [
      'حتى 500 عميل شهرياً',
      '10 حملات',
      'تحليلات متقدمة',
      'دعم أولوي',
      'عرض متعدد العملاء',
      'العمليات الجماعية',
    ],
    color: 'purple',
    badge: 'احترافي',
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    nameAr: 'وكالة',
    description: 'For agencies & enterprises',
    descriptionAr: 'للوكالات والمؤسسات',
    monthlyLeadLimit: 5000,
    maxCampaigns: 100,
    price: 499,
    priceAr: '499 ر.س/شهر',
    features: [
      'Up to 5000 leads/month',
      'Unlimited campaigns',
      'Custom analytics',
      '24/7 support',
      'Multi-client management',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
    ],
    featuresAr: [
      'حتى 5000 عميل شهرياً',
      'حملات غير محدودة',
      'تحليلات مخصصة',
      'دعم 24/7',
      'إدارة متعددة العملاء',
      'وصول API',
      'تكاملات مخصصة',
      'مدير حساب مخصص',
    ],
    color: 'gold',
    badge: 'وكالة',
  },
};

export function getPlan(planId: PlanType): Plan {
  return PLANS[planId] || PLANS.starter;
}

export function getDefaultPlan(): Plan {
  return PLANS.starter;
}

export function getAllPlans(): Plan[] {
  return Object.values(PLANS);
}

export function checkLeadLimit(usedLeads: number, plan: Plan): boolean {
  return usedLeads < plan.monthlyLeadLimit;
}

export function getRemainingLeads(usedLeads: number, plan: Plan): number {
  return Math.max(0, plan.monthlyLeadLimit - usedLeads);
}

export function getUsagePercentage(usedLeads: number, plan: Plan): number {
  return Math.min(100, (usedLeads / plan.monthlyLeadLimit) * 100);
}
