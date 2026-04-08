import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';

const LandingPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = isArabic ? 'ar' : 'en';
  }, [isArabic]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-text-primary">
      <Navbar />

      <main className="w-full">
        <section id="hero" className="pt-16">
          <Hero />
        </section>
        <section id="features">
          <Features />
        </section>

        <section id="how-it-works">
          <HowItWorks />
        </section>

        <section id="pricing">
          <Pricing />
        </section>

        <section id="faq">
          <FAQ />
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;