import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import Topbar from '@/components/v2/Topbar';
import Button from '@/components/v2/Button';

/**
 * Public mobile topbar used by legal/about/contact pages. Mirrors the
 * Landing/Pricing topbar (brand mark + sign-in CTA) so users on mobile
 * always have a way back to the home page from any public surface.
 *
 * Hidden on desktop (lg+) because PublicShell renders the DesktopTopbar
 * with full nav links there instead.
 */
export default function PublicTopbar() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const BrandMark = (
    <button
      type="button"
      onClick={() => navigate('/v2')}
      className="flex items-center gap-2 px-2 py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 rounded-v2-md"
      aria-label={t('landing.publicNav.home')}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="9"   stroke="var(--teal-700)" strokeWidth="1.4" />
        <circle cx="11" cy="11" r="5"   stroke="var(--teal-700)" strokeWidth="1.4" />
        <circle cx="11" cy="11" r="1.4" fill="var(--teal-700)" />
      </svg>
      <span className="font-ar text-[16px] font-bold text-v2-ink">{t('landing.brand')}</span>
    </button>
  );

  return (
    <div className="lg:hidden">
      <Topbar
        bg="canvas"
        leading={BrandMark}
        showPulse={false}
        showJobsIndicator={false}
        trailing={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/v2/login')}
          >
            {t('landing.hero.signIn')}
          </Button>
        }
      />
    </div>
  );
}
