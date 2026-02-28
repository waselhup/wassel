import React from 'react';
import { Star, Users, TrendingUp } from 'lucide-react';

/**
 * Social Proof Section Component
 * 
 * Trust indicators with:
 * - User testimonials
 * - Key metrics
 * - Company logos (placeholder)
 * - Rating display
 */
export default function SocialProof() {
  const metrics = [
    {
      icon: Users,
      value: '5,000+',
      label: 'مستخدم نشط',
      sublabel: 'Active Users',
    },
    {
      icon: TrendingUp,
      value: '2.5M+',
      label: 'رسالة مرسلة',
      sublabel: 'Messages Sent',
    },
    {
      icon: Star,
      value: '4.9/5',
      label: 'تقييم المستخدمين',
      sublabel: 'User Rating',
    },
  ];

  const testimonials = [
    {
      name: 'أحمد السعيد',
      role: 'مؤسس شركة تسويق رقمي',
      company: 'Digital Growth Co',
      content: 'وصل غيّر طريقة إدارتنا لحملات LinkedIn. زيادة 300% في المشاركات.',
      avatar: '👨‍💼',
    },
    {
      name: 'فاطمة الزهراني',
      role: 'مديرة المبيعات',
      company: 'Tech Solutions KSA',
      content: 'أداة احترافية وسهلة الاستخدام. الدعم العربي ممتاز جداً.',
      avatar: '👩‍💼',
    },
    {
      name: 'محمد العتيبي',
      role: 'صاحب مشروع استشاري',
      company: 'Consulting Plus',
      content: 'أفضل استثمار قررت أن أقوم به. النتائج تتحدث عن نفسها.',
      avatar: '👨‍💼',
    },
  ];

  return (
    <section className="py-20 px-6 bg-wassel-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="card text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-wassel-blue-primary-light rounded-lg">
                    <Icon size={24} className="text-wassel-blue-primary" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-wassel-gray-900 mb-2">
                  {metric.value}
                </div>
                <div className="text-lg font-semibold text-wassel-gray-900 mb-1">
                  {metric.label}
                </div>
                <div className="text-sm text-wassel-gray-600">
                  {metric.sublabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* Testimonials */}
        <div>
          <h2 className="text-4xl font-bold text-wassel-gray-900 text-center mb-4">
            ماذا يقول مستخدمونا
          </h2>
          <p className="text-center text-wassel-gray-600 mb-12 max-w-2xl mx-auto">
            انضم إلى آلاف المستخدمين الذين يثقون بـ وصل لإدارة علاقاتهم على LinkedIn
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="card hover:shadow-lg transition-shadow">
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="fill-wassel-warning text-wassel-warning" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-wassel-gray-700 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-wassel-gray-200">
                  <div className="text-2xl">{testimonial.avatar}</div>
                  <div>
                    <div className="font-semibold text-wassel-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-wassel-gray-600">
                      {testimonial.role}
                    </div>
                    <div className="text-xs text-wassel-gray-500">
                      {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
