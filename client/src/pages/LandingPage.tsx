import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import V4BgCircles from '@/components/landing/v4/V4BgCircles';
import V4Nav from '@/components/landing/v4/V4Nav';
import V4Hero from '@/components/landing/v4/V4Hero';
import V4HubSection from '@/components/landing/v4/V4HubSection';
import V4FitsSection from '@/components/landing/v4/V4FitsSection';
import V4BentoSection from '@/components/landing/v4/V4BentoSection';
import V4FinalCTA from '@/components/landing/v4/V4FinalCTA';
import V4Footer from '@/components/landing/v4/V4Footer';

/**
 * Wassel landing page — v4 (Qatalog-inspired).
 * Light background, mint accent, thin 500-weight headlines,
 * floating cards collage hero, bento sections.
 *
 * Brand assets preserved:
 *  - Uses existing WasselLogo SVG component
 *  - Uses existing Cairo (AR) + Inter (EN) fonts
 *  - Brand name "Wassel" / "وصل" unchanged
 */
export default function LandingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Reveal-on-scroll
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.v4-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div
      className="v4-landing"
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={isRTL ? 'ar' : 'en'}
      style={{
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        background: 'var(--v4-bg)',
        color: 'var(--v4-text)',
        minHeight: '100vh',
      }}
    >
      <V4BgCircles />
      <V4Nav />
      <V4Hero />
      <V4HubSection />
      <V4FitsSection />
      <V4BentoSection />
      <V4FinalCTA />
      <V4Footer />
    </div>
  );
}
