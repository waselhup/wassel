/**
 * Wassel feature definitions — single source of truth.
 * Used in landing page, sidebar, onboarding, agents, emails, admin.
 *
 * If a feature changes (route, name, description), update it here and
 * every consumer will follow.
 *
 * Positioning rule: Wassel is a "professional AI platform" — never
 * surface "B2B", "cold outreach", "mass email", or "automation" in user copy.
 */

export type FeatureKey =
  | 'profileAnalysis'
  | 'cvTailor'
  | 'posts'
  | 'campaigns'
  | 'knowledgeBase'
  | 'analytics';

export interface FeatureDef {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  route: string;
  icon: string;
  color: string;
}

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  profileAnalysis: {
    id: 'profile_analysis',
    titleAr: 'تحليل البروفايل المهني',
    titleEn: 'Profile Analysis',
    descriptionAr: 'تحليل متعمق لبروفايلك على LinkedIn مع خطة تطوير واضحة',
    descriptionEn: 'Deep LinkedIn profile analysis with a clear growth plan',
    route: '/app/profile-analysis',
    icon: 'Brain',
    color: 'teal',
  },
  cvTailor: {
    id: 'cv_tailor',
    titleAr: 'تخصيص السيرة الذاتية',
    titleEn: 'CV Tailor',
    descriptionAr: 'سيرة ذاتية احترافية مخصصة لكل فرصة تقدم لها',
    descriptionEn: 'A professional CV tailored to every opportunity',
    route: '/app/cv',
    icon: 'FileText',
    color: 'teal',
  },
  posts: {
    id: 'posts',
    titleAr: 'منشورات LinkedIn',
    titleEn: 'LinkedIn Posts',
    descriptionAr: 'محتوى احترافي لحسابك يجذب التفاعل ويبني سمعتك',
    descriptionEn: 'Professional content for your profile that drives engagement',
    route: '/app/posts',
    icon: 'Share2',
    color: 'teal',
  },
  campaigns: {
    id: 'campaigns',
    titleAr: 'التواصل المهني الذكي',
    titleEn: 'Smart Outreach',
    descriptionAr: 'وصول احترافي ومنظم لفرص مهنية جديدة',
    descriptionEn: 'Reach new professional opportunities in a structured way',
    route: '/app/campaigns',
    icon: 'Send',
    color: 'teal',
  },
  knowledgeBase: {
    id: 'knowledge',
    titleAr: 'قاعدة المعرفة',
    titleEn: 'Knowledge Base',
    descriptionAr: 'أدلة ومحتوى لتطوير حضورك المهني على LinkedIn',
    descriptionEn: 'Guides and content to grow your LinkedIn presence',
    route: '/app/knowledge',
    icon: 'BookOpen',
    color: 'teal',
  },
  analytics: {
    id: 'analytics',
    titleAr: 'التحليلات',
    titleEn: 'Analytics',
    descriptionAr: 'تتبع تقدمك وقياس نتائج جهودك المهنية',
    descriptionEn: 'Track your progress and measure your career growth results',
    route: '/app/analytics',
    icon: 'BarChart3',
    color: 'teal',
  },
};

export const FEATURE_LIST: FeatureDef[] = Object.values(FEATURES);

export const getFeature = (id: string): FeatureDef | null => {
  return FEATURE_LIST.find((f) => f.id === id) || null;
};

export const getFeatureByKey = (key: FeatureKey): FeatureDef => FEATURES[key];
