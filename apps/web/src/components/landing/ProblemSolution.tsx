import React from 'react';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

/**
 * Problem-Solution Section Component
 * 
 * Storytelling approach with:
 * - Clear problem statement
 * - Pain points
 * - Solution overview
 * - Before/after comparison
 */
export default function ProblemSolution() {
  const problems = [
    {
      icon: AlertCircle,
      title: 'الوقت المهدر',
      description: 'ساعات يومية في البحث اليدوي والمتابعة',
    },
    {
      icon: AlertCircle,
      title: 'عدم الاتساق',
      description: 'رسائل غير موحدة وردود عشوائية',
    },
    {
      icon: AlertCircle,
      title: 'فقدان الفرص',
      description: 'عدم القدرة على متابعة الآلاف من الجهات المحتملة',
    },
  ];

  const solutions = [
    {
      icon: CheckCircle,
      title: 'أتمتة ذكية',
      description: 'حملات مؤتمتة بالكامل مع لمسة إنسانية',
    },
    {
      icon: CheckCircle,
      title: 'رسائل موحدة',
      description: 'قوالب مخصصة وشخصية لكل جهة اتصال',
    },
    {
      icon: CheckCircle,
      title: 'تحكم كامل',
      description: 'إدارة آلاف الجهات المحتملة بسهولة',
    },
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-wassel-gray-900 mb-6">
            المشكلة التي نحلها
          </h2>
          <p className="text-xl text-wassel-gray-600 max-w-3xl mx-auto">
            إدارة علاقات LinkedIn يدويًا مرهقة وغير فعالة.
            وصل تحول هذا التحدي إلى فرصة ذهبية.
          </p>
        </div>

        {/* Before & After */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          {/* Before - Problems */}
          <div>
            <h3 className="text-2xl font-bold text-wassel-error mb-8 flex items-center gap-2">
              <span className="text-3xl">❌</span>
              قبل وصل
            </h3>
            <div className="space-y-6">
              {problems.map((problem, index) => {
                const Icon = problem.icon;
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <Icon size={24} className="text-wassel-error mt-1" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-wassel-gray-900 mb-1">
                        {problem.title}
                      </h4>
                      <p className="text-wassel-gray-600">
                        {problem.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* After - Solutions */}
          <div>
            <h3 className="text-2xl font-bold text-wassel-success mb-8 flex items-center gap-2">
              <span className="text-3xl">✅</span>
              مع وصل
            </h3>
            <div className="space-y-6">
              {solutions.map((solution, index) => {
                const Icon = solution.icon;
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <Icon size={24} className="text-wassel-success mt-1" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-wassel-gray-900 mb-1">
                        {solution.title}
                      </h4>
                      <p className="text-wassel-gray-600">
                        {solution.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Impact Statement */}
        <div className="bg-gradient-soft rounded-2xl p-12 text-center">
          <h3 className="text-3xl font-bold text-wassel-gray-900 mb-4">
            النتيجة: زيادة الإنتاجية بـ 10x
          </h3>
          <p className="text-lg text-wassel-gray-700 max-w-2xl mx-auto mb-8">
            قضاء وقت أقل في الإدارة اليدوية، والتركيز على بناء علاقات حقيقية وقيمة.
          </p>
          <button className="btn btn-primary inline-flex items-center gap-2">
            اكتشف كيف يعمل
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
