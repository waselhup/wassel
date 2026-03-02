import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'wouter';

export default function CTA() {
  const features = [
    'Free 14-day trial',
    'No credit card required',
    'Cancel anytime',
    'Dedicated support',
  ];

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-12 md:p-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Ready to Transform Your Campaigns?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join thousands of users achieving exceptional results with Wassel
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/login">
              <button className="bg-blue-600 text-white px-10 py-4 text-lg rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer">
                Start Free Now
                <ArrowRight size={20} />
              </button>
            </Link>
            <Link href="/login">
              <button className="border-2 border-gray-300 text-gray-900 px-10 py-4 text-lg rounded-lg font-semibold hover:border-gray-400 transition-all cursor-pointer">
                Watch Demo
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8 border-t border-gray-200">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <Check size={20} className="text-green-500 flex-shrink-0" />
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-8 justify-center items-center text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600">4.9/5</div>
            <div className="text-sm text-gray-600">User Rating</div>
          </div>
          <div className="hidden sm:block w-px h-12 bg-gray-200" />
          <div>
            <div className="text-3xl font-bold text-blue-600">5,000+</div>
            <div className="text-sm text-gray-600">Active Users</div>
          </div>
          <div className="hidden sm:block w-px h-12 bg-gray-200" />
          <div>
            <div className="text-3xl font-bold text-blue-600">24/7</div>
            <div className="text-sm text-gray-600">Support</div>
          </div>
        </div>
      </div>
    </section>
  );
}
