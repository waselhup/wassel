/**
 * Wassel feature definitions — single source of truth.
 * Used in landing page, sidebar, onboarding, agents, emails, admin.
 *
 * If a feature changes (route, name, description), update it here and
 * every consumer will follow.
 */

export type FeatureKey =
  | 'profileAnalysis'
  | 'cvTailor'
  | 'posts'
  | 'campaigns'
  | 'discovery'
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
    descriptionAr:
      'يحلل الذكاء الاصطناعي بروفايلك على LinkedIn ويعطيك درجة من 100 مع نقاط قوة وضعف وخطة تحسين',
    descriptionEn:
      'AI analyzes your LinkedIn profile, gives you a score out of 100, identifies strengths and weaknesses, and provides an action plan',
    route: '/app/profile-analysis',
    icon: 'Brain',
    color: 'teal',
  },
  cvTailor: {
    id: 'cv_tailor',
    titleAr: 'تخصيص السيرة الذاتية',
    titleEn: 'CV Tailor',
    descriptionAr:
      'إنشاء سيرة ذاتية مخصصة لكل وظيفة بالذكاء الاصطناعي مع 3 أنماط مختلفة',
    descriptionEn:
      'Generate tailored CV for any job description with AI, choose from 3 styles',
    route: '/app/cv',
    icon: 'FileText',
    color: 'teal',
  },
  posts: {
    id: 'posts',
    titleAr: 'منشورات LinkedIn',
    titleEn: 'LinkedIn Posts',
    descriptionAr:
      'إنشاء منشورات احترافية على LinkedIn بالذكاء الاصطناعي مع اختيار النبرة والأسلوب',
    descriptionEn:
      'Generate professional LinkedIn posts with AI, choose tone and style',
    route: '/app/posts',
    icon: 'Share2',
    color: 'teal',
  },
  campaigns: {
    id: 'campaigns',
    titleAr: 'الحملات الذكية',
    titleEn: 'Smart Campaigns',
    descriptionAr:
      'أتمتة التواصل على LinkedIn — اكتشاف جمهور مستهدف، رسائل شخصية، تتبع النتائج',
    descriptionEn:
      'Automate LinkedIn outreach — find prospects, personalize messages, track results',
    route: '/app/campaigns',
    icon: 'Send',
    color: 'teal',
  },
  discovery: {
    id: 'discovery',
    titleAr: 'اكتشاف الجمهور',
    titleEn: 'Prospect Discovery',
    descriptionAr:
      'ابحث عن جمهورك المستهدف على LinkedIn بناءً على معايير متقدمة',
    descriptionEn:
      'Find your target audience on LinkedIn with advanced filters',
    route: '/app/campaigns',
    icon: 'Search',
    color: 'teal',
  },
  knowledgeBase: {
    id: 'knowledge',
    titleAr: 'قاعدة المعرفة',
    titleEn: 'Knowledge Base',
    descriptionAr: 'موارد وأدلة لتحسين استخدام وصّل والتسويق على LinkedIn',
    descriptionEn:
      'Resources and guides to maximize Wassel and LinkedIn marketing',
    route: '/app/knowledge',
    icon: 'BookOpen',
    color: 'teal',
  },
  analytics: {
    id: 'analytics',
    titleAr: 'التحليلات',
    titleEn: 'Analytics',
    descriptionAr: 'تتبع أداء حملاتك، استهلاك التوكنز، ورؤى حول نشاطك',
    descriptionEn:
      'Track campaign performance, token usage, and activity insights',
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
