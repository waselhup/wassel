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

export default function Features() {
  const features = [
    {
      icon: Zap,
      title: 'Smart Automation',
      description: 'Fully automated campaigns with manual control anytime',
      color: 'text-yellow-500',
    },
    {
      icon: MessageSquare,
      title: 'Custom Messages',
      description: 'Smart templates that learn from user responses',
      color: 'text-blue-500',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Deep insights into campaign performance',
      color: 'text-green-500',
    },
    {
      icon: Users,
      title: 'Lead Management',
      description: 'Organize thousands of prospects effortlessly',
      color: 'text-blue-600',
    },
    {
      icon: Clock,
      title: 'Smart Scheduling',
      description: 'Send messages at the optimal time',
      color: 'text-red-500',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Full encryption and privacy compliance',
      color: 'text-green-600',
    },
    {
      icon: Lock,
      title: 'Account Protection',
      description: 'Advanced techniques to protect your account',
      color: 'text-yellow-600',
    },
    {
      icon: Sparkles,
      title: '24/7 Support',
      description: 'Dedicated support team available anytime',
      color: 'text-blue-600',
    },
  ];

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Features That Set Us Apart
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to manage professional LinkedIn campaigns in one place
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index} 
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 border border-gray-100"
              >
                <div className="mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg w-fit">
                    <Icon size={24} className={feature.color} />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>

                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-16">
          <p className="text-gray-600 mb-6">
            This is just the beginning. Discover more advanced features.
          </p>
          <button className="border-2 border-gray-300 text-gray-900 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 transition-all">
            Explore All Features
          </button>
        </div>
      </div>
    </section>
  );
}
