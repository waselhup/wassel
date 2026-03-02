import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white opacity-50" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-10" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full mb-8">
          <Sparkles size={16} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-600">
            Smart LinkedIn Management
          </span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
            Wassel
          </span>
          {' '}
          <span className="text-gray-900">
            Reach with Confidence
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
          Professional platform for managing LinkedIn campaigns intelligently. From discovery to follow-up, everything is automated and secure.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <button className="bg-blue-600 text-white px-8 py-4 text-lg rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg">
            Start Free
            <ArrowRight size={20} className="inline ml-2" />
          </button>
          <button className="border-2 border-gray-300 text-gray-900 px-8 py-4 text-lg rounded-lg font-semibold hover:border-gray-400 transition-all">
            Watch Demo
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-8 justify-center items-center text-sm text-gray-600 border-t border-gray-200 pt-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>24/7 Support</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-gray-300 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-blue-600 rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}
