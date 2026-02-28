import React from 'react';
import { Chrome, ArrowRight, CheckCircle } from 'lucide-react';

/**
 * Extension Integration Section Component
 * 
 * Explains Chrome extension with:
 * - Visual overview
 * - Key benefits
 * - Installation steps
 * - Integration flow
 */
export default function ExtensionIntegration() {
  const steps = [
    {
      number: 1,
      title: 'تثبيت الإضافة',
      description: 'أضف إضافة وصل من متجر Chrome بنقرة واحدة',
    },
    {
      number: 2,
      title: 'تسجيل الدخول',
      description: 'اربط حسابك على وصل مع حسابك على LinkedIn',
    },
    {
      number: 3,
      title: 'ابدأ الحملة',
      description: 'أطلق حملتك الأولى مباشرة من LinkedIn',
    },
    {
      number: 4,
      title: 'راقب النتائج',
      description: 'تابع الأداء والردود في الوقت الفعلي',
    },
  ];

  const benefits = [
    'تصفح LinkedIn بشكل طبيعي',
    'تحديد الجهات المحتملة بسهولة',
    'إرسال رسائل مخصصة فوراً',
    'تتبع الردود تلقائياً',
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-wassel-gray-900 mb-6">
            إضافة Chrome المتقدمة
          </h2>
          <p className="text-xl text-wassel-gray-600 max-w-3xl mx-auto">
            أدوات وصل متاحة مباشرة على LinkedIn. لا حاجة للتبديل بين التطبيقات.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Left - Visual */}
          <div className="relative">
            <div className="bg-gradient-soft rounded-2xl p-12 aspect-video flex items-center justify-center">
              <div className="text-center">
                <Chrome size={64} className="text-wassel-blue-primary mx-auto mb-4" />
                <p className="text-wassel-gray-600 font-medium">
                  واجهة الإضافة الحديثة
                </p>
              </div>
            </div>
          </div>

          {/* Right - Benefits */}
          <div>
            <h3 className="text-3xl font-bold text-wassel-gray-900 mb-8">
              الإضافة تعمل بذكاء
            </h3>
            <div className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-wassel-success flex-shrink-0" />
                  <span className="text-wassel-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary inline-flex items-center gap-2">
              حمّل الإضافة الآن
              <ArrowRight size={20} />
            </button>
          </div>
        </div>

        {/* Installation Steps */}
        <div>
          <h3 className="text-3xl font-bold text-wassel-gray-900 text-center mb-12">
            خطوات التثبيت البسيطة
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Step Card */}
                <div className="card h-full">
                  {/* Number Badge */}
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-wassel-blue-primary text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {step.number}
                  </div>

                  {/* Content */}
                  <div className="pt-4">
                    <h4 className="text-lg font-semibold text-wassel-gray-900 mb-3">
                      {step.title}
                    </h4>
                    <p className="text-wassel-gray-600 text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-6 w-6 h-0.5 bg-wassel-gray-200 transform -translate-y-1/2" />\n                )}\n              </div>\n            ))}\n          </div>\n        </div>\n\n        {/* CTA Section */}\n        <div className=\"mt-16 bg-gradient-premium rounded-2xl p-12 text-center text-white\">\n          <h3 className=\"text-3xl font-bold mb-4\">\n            جاهز للبدء؟\n          </h3>\n          <p className=\"text-lg opacity-90 mb-8 max-w-2xl mx-auto\">\n            انضم إلى آلاف المستخدمين الذين يحققون نتائج مذهلة مع وصل\n          </p>\n          <button className=\"bg-white text-wassel-blue-primary font-semibold px-8 py-4 rounded-lg hover:shadow-lg transition-all inline-flex items-center gap-2\">\n            ابدأ النسخة التجريبية المجانية\n            <ArrowRight size={20} />\n          </button>\n        </div>\n      </div>\n    </section>\n  );\n}\n
