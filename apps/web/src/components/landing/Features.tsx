import React from 'react';
import { 
  Zap, 
  Shield, 
  BarChart3, 
  Users, 
  MessageSquare, 
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';

/**
 * Features Section Component
 * 
 * Clean card layout with:
 * - 8 core features
 * - Icon + title + description
 * - Hover effects
 * - Premium spacing
 */
export default function Features() {
  const features = [
    {
      icon: Zap,
      title: 'أتمتة ذكية',
      description: 'حملات مؤتمتة بالكامل مع إمكانية التحكم اليدوي في أي وقت',
      color: 'text-wassel-warning',
    },
    {
      icon: MessageSquare,
      title: 'رسائل مخصصة',
      description: 'قوالب ذكية تتعلم من ردود المستخدمين وتتحسن تلقائياً',
      color: 'text-wassel-info',
    },
    {
      icon: BarChart3,
      title: 'تحليلات متقدمة',
      description: 'رؤى عميقة عن أداء حملاتك وسلوك الجهات المحتملة',
      color: 'text-wassel-success',
    },
    {
      icon: Users,
      title: 'إدارة الجهات المحتملة',
      description: 'تنظيم وتصنيف آلاف الجهات المحتملة بسهولة',
      color: 'text-wassel-blue-primary',
    },
    {
      icon: Clock,
      title: 'جدولة ذكية',
      description: 'إرسال الرسائل في الوقت الأمثل لكل جهة اتصال',
      color: 'text-wassel-error',
    },
    {
      icon: Shield,
      title: 'أمان من الدرجة الأولى',
      description: 'تشفير كامل وامتثال لمعايير الخصوصية العالمية',
      color: 'text-wassel-success',
    },
    {
      icon: Lock,
      title: 'حماية الحساب',
      description: 'تقنيات متقدمة لحماية حسابك من الحظر',
      color: 'text-wassel-warning',
    },
    {
      icon: Sparkles,
      title: 'دعم عربي 24/7',
      description: 'فريق دعم متخصص يتحدث العربية ويفهم السوق المحلي',
      color: 'text-wassel-blue-primary',
    },
  ];

  return (
    <section className="py-20 px-6 bg-wassel-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-wassel-gray-900 mb-6">
            المميزات التي تميزنا
          </h2>
          <p className="text-xl text-wassel-gray-600 max-w-3xl mx-auto">
            كل ما تحتاجه لإدارة حملات LinkedIn احترافية في مكان واحد
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index} 
                className="card group hover:shadow-lg hover:border-wassel-blue-primary-light transition-all duration-300"
              >
                {/* Icon */}
                <div className="mb-4">
                  <div className="p-3 bg-wassel-blue-primary-light rounded-lg w-fit group-hover:bg-wassel-blue-primary group-hover:text-white transition-all">
                    <Icon size={24} className={`${feature.color} group-hover:text-white transition-colors`} />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-wassel-gray-900 mb-3">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-wassel-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-wassel-gray-600 mb-6">
            هذه مجرد البداية. اكتشف المزيد من الميزات المتقدمة.
          </p>
          <button className="btn btn-secondary">
            استكشف جميع الميزات
          </button>
        </div>
      </div>
    </section>
  );
}
