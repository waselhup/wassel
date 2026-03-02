import React from 'react';
import { Chrome, ArrowRight, CheckCircle } from 'lucide-react';

export default function ExtensionIntegration() {
  const steps = [
    {
      number: 1,
      title: 'Install Extension',
      description: 'Add Wassel extension from Chrome Store in one click',
    },
    {
      number: 2,
      title: 'Sign In',
      description: 'Connect your Wassel account with LinkedIn',
    },
    {
      number: 3,
      title: 'Start Campaign',
      description: 'Launch your first campaign directly from LinkedIn',
    },
    {
      number: 4,
      title: 'Monitor Results',
      description: 'Track performance and responses in real-time',
    },
  ];

  const benefits = [
    'Browse LinkedIn naturally',
    'Identify prospects easily',
    'Send custom messages instantly',
    'Track responses automatically',
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Chrome Extension
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Wassel tools available directly on LinkedIn. No need to switch between apps.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-12 aspect-video flex items-center justify-center">
              <div className="text-center">
                <Chrome size={64} className="text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">
                  Modern Extension Interface
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-8">
              Smart Extension
            </h3>
            <div className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all inline-flex items-center gap-2">
              Download Extension
              <ArrowRight size={20} />
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Simple Installation Steps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {step.number}
                  </div>

                  <div className="pt-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">
                      {step.title}
                    </h4>
                    <p className="text-gray-600 text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-12 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">
            Ready to Get Started?
          </h3>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of users achieving remarkable results with Wassel
          </p>
          <button className="bg-white text-blue-600 font-semibold px-8 py-4 rounded-lg hover:shadow-lg transition-all inline-flex items-center gap-2">
            Start Free Trial
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
