import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LandingNav from '@/components/landing/LandingNav';
import LandingHero from '@/components/landing/LandingHero';
import SocialProof from '@/components/landing/SocialProof';
import BentoFeatures from '@/components/landing/BentoFeatures';
import HowItWorksTimeline from '@/components/landing/HowItWorksTimeline';
import ProductDemo from '@/components/landing/ProductDemo';
import TestimonialsGrid from '@/components/landing/TestimonialsGrid';
import PricingCards from '@/components/landing/PricingCards';
import LandingFooter from '@/components/landing/LandingFooter';

/**
 * Wassel landing page — world-class composition.
 *
 * Configuration:
 *  - To activate the demo video, set `DEMO_VIDEO_URL` below to a YouTube or
 *    Vimeo URL (e.g. "https://youtu.be/abc123"). Leaving it undefined shows a
 *    polished "coming soon" state but keeps the UI interactive.
 */
const DEMO_VIDEO_URL: string | undefined = undefined;

export default function LandingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const demoRef = useRef<HTMLDivElement>(null);

  function scrollToDemo() {
    const el = document.getElementById('demo');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={isRTL ? 'ar' : 'en'}
      style={{
        background: '#fff',
        color: '#0B1220',
        fontFamily: isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif',
        minHeight: '100vh',
      }}
    >
      <LandingNav />
      <LandingHero onWatchDemo={scrollToDemo} />
      <SocialProof />
      <BentoFeatures />
      <HowItWorksTimeline />
      <ProductDemo ref={demoRef} videoUrl={DEMO_VIDEO_URL} />
      <TestimonialsGrid />
      <PricingCards />
      <LandingFooter />
    </div>
  );
}
