import React from 'react';
import { Star, Users, TrendingUp } from 'lucide-react';

export default function SocialProof() {
  const metrics = [
    {
      icon: Users,
      value: '5,000+',
      label: 'Active Users',
    },
    {
      icon: TrendingUp,
      value: '2.5M+',
      label: 'Messages Sent',
    },
    {
      icon: Star,
      value: '4.9/5',
      label: 'User Rating',
    },
  ];

  const testimonials = [
    {
      name: 'Ahmed Al-Saeed',
      role: 'Founder, Digital Marketing Agency',
      content: 'Wassel transformed how we manage LinkedIn campaigns. 300% increase in engagement.',
      avatar: '👨‍💼',
    },
    {
      name: 'Fatima Al-Zahrani',
      role: 'Sales Manager',
      content: 'Professional tool, easy to use. Arabic support is excellent.',
      avatar: '👩‍💼',
    },
    {
      name: 'Mohammed Al-Otaibi',
      role: 'Consultant',
      content: 'Best investment I made. Results speak for themselves.',
      avatar: '👨‍💼',
    },
  ];

  return (
    <section className="py-20 px-6 bg-[var(--bg-base)]">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="bg-[var(--bg-card)] rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-[rgba(139,92,246,0.08)] rounded-lg">
                    <Icon size={24} className="text-[#8B5CF6]" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2 text-center">
                  {metric.value}
                </div>
                <div className="text-lg font-semibold text-gray-900 text-center">
                  {metric.label}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-4">
            What Our Users Say
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Join thousands of users who trust Wassel to manage their LinkedIn relationships
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-[var(--bg-card)] rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                <p className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <div className="text-2xl">{testimonial.avatar}</div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {testimonial.role}
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
