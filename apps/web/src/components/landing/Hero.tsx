import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * Hero Section Component
 * 
 * Premium hero section with:
 * - Strong positioning statement
 * - Emotional clarity
 * - Gradient background
 * - Clear CTA hierarchy
 * - RTL-native layout
 */
export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-premium opacity-5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-wassel-blue-primary-light rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-wassel-blue-primary-light rounded-full blur-3xl opacity-10" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-wassel-blue-primary-light rounded-full mb-8">
          <Sparkles size={16} className="text-wassel-blue-primary" />
          <span className="text-sm font-medium text-wassel-blue-primary">
            إدارة علاقات LinkedIn بذكاء | Smart LinkedIn Management
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-6xl font-bold text-wassel-gray-900 mb-6 leading-tight">
          <span className="bg-gradient-to-r from-wassel-blue-primary to-wassel-blue-500 bg-clip-text text-transparent">
            وصل
          </span>
          {' '}
          <span className="text-wassel-gray-900">
            إلى علاقاتك بثقة
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-xl md:text-2xl text-wassel-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
          منصة احترافية لإدارة حملات LinkedIn بذكاء. 
          من الاستكشاف إلى المتابعة، كل شيء مؤتمت وآمن.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <button className="btn btn-primary px-8 py-4 text-lg flex items-center gap-2 hover:shadow-lg transition-all">
            ابدأ الآن مجاناً
            <ArrowRight size={20} />
          </button>
          <button className="btn btn-secondary px-8 py-4 text-lg">
            شاهد العرض التوضيحي
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-col sm:flex-row gap-8 justify-center items-center text-sm text-wassel-gray-600 border-t border-wassel-gray-200 pt-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-wassel-success rounded-full" />
            <span>لا يتطلب بطاقة ائتمان</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-wassel-success rounded-full" />
            <span>نسخة تجريبية 14 يوم</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-wassel-success rounded-full" />
            <span>دعم عربي 24/7</span>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-wassel-gray-300 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-wassel-blue-primary rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}
