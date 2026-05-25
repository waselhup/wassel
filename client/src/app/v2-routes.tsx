import { Suspense, useEffect, type ReactElement, type ReactNode } from 'react';
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry';
import { useLocation, useRoute } from 'wouter';
import { useTranslation } from 'react-i18next';
import { JobsProvider } from '@/lib/v2/jobs';
import { ToastProvider, useToast } from '@/lib/v2/toast';
import type { Job } from '@/lib/v2/jobs';
import ErrorBoundary from '@/components/v2/ErrorBoundary';
import PageTransition from '@/components/v2/PageTransition';
import ResponsiveShell from '@/components/v2/ResponsiveShell';
import Skeleton from '@/components/v2/Skeleton';
import { useAuth } from '@/contexts/AuthContext';

// Lazy-load v2 pages so they don't bloat the main bundle.
const Landing = lazy(() => import('@/pages/v2/Landing'));
const Auth = lazy(() => import('@/pages/v2/Auth'));
const Pricing = lazy(() => import('@/pages/v2/Pricing'));
const PricingProducts = lazy(() => import('@/pages/v2/PricingProducts'));
const AboutPublic   = lazy(() => import('@/pages/v2/public/About'));
const ContactPublic = lazy(() => import('@/pages/v2/public/Contact'));
const PrivacyPublic = lazy(() => import('@/pages/v2/public/Privacy'));
const TermsPublic   = lazy(() => import('@/pages/v2/public/Terms'));
const RefundPublic  = lazy(() => import('@/pages/v2/public/Refund'));
const Billing = lazy(() => import('@/pages/v2/Billing'));
const CheckoutSuccess = lazy(() => import('@/pages/v2/CheckoutSuccess'));
const CheckoutFailed = lazy(() => import('@/pages/v2/CheckoutFailed'));
const Home = lazy(() => import('@/pages/v2/Home'));
const Posts = lazy(() => import('@/pages/v2/Posts'));
const Profile = lazy(() => import('@/pages/v2/Profile'));
// /v2/activity retired — its content lives inside /v2/home as the "Recent
// activity" panel. Legacy path now redirects (see matchActivity below).
// V2-wrapped versions of the real V1 feature pages — they reuse the working
// tRPC/business logic but render inside the V2 ProtectedShell chrome.
const CVBuilder = lazy(() => import('@/pages/v2/CVBuilder'));
const AdminPanel = lazy(() => import('@/pages/v2/AdminPanel'));
const FinancePanel = lazy(() => import('@/pages/v2/FinancePanel'));
const OpsPanel = lazy(() => import('@/pages/v2/OpsPanel'));
const GrowthPanel = lazy(() => import('@/pages/v2/GrowthPanel'));
const WorkforcePanel = lazy(() => import('@/pages/v2/WorkforcePanel'));

// 3-stage profile analysis flow: Input → Loading → Result. State bridges
// stages via sessionStorage (see lib/v2/analysisSession.ts). Stage 1 lives
// at /v2/analyze; the V1 single-page page is no longer routed.
const ProfileInput = lazy(() => import('@/pages/v2/analysis/ProfileInput'));
const AnalysisLoading = lazy(() => import('@/pages/v2/analysis/AnalysisLoading'));
const AnalysisResults = lazy(() => import('@/pages/v2/analysis/AnalysisResults'));

function V2Loader() {
  // Skeleton-shaped fallback that resembles the page chrome — feels less
  // like a hard interruption than a centered spinner while the chunk loads.
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-v2-canvas">
      <div className="h-[52px] border-b border-v2-line" />
      <div className="flex-1 px-[22px] pt-6">
        <Skeleton variant="text" lines={2} className="mb-6" />
        <Skeleton variant="card" className="mb-4" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}

/**
 * Skip-to-content link rendered at the very top. Hidden until focused.
 */
function SkipLink() {
  const { t } = useTranslation();
  return (
    <a
      href="#v2-main"
      className="absolute start-4 top-2 z-[100] -translate-y-12 rounded-v2-md bg-v2-ink px-3 py-2 font-ar text-[13px] font-semibold text-white shadow-lift transition-transform duration-200 ease-out focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
    >
      {t('landing.skipToContent')}
    </a>
  );
}

/**
 * Wraps the protected v2 surface with jobs/toast providers and bridges them:
 * when a job settles, fire a toast.
 *
 * On desktop (≥1024px) ResponsiveShell renders the DesktopShell (sidebar +
 * topbar). On mobile it's a passthrough so each page's own <Phone>+<Topbar>
 * +<BottomNav> chrome continues to work unchanged.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/v2/login', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return <V2Loader />;
  }

  if (!user) return null;

  return <>{children}</>;
}

function ProtectedShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <JobsProviderWithToast>
          <SkipLink />
          <ResponsiveShell withSidebar showAccountCluster showPulse>
            <main id="v2-main" className="min-h-[100dvh] lg:min-h-0">
              <PageTransition>
                <AuthGate>{children}</AuthGate>
              </PageTransition>
            </main>
          </ResponsiveShell>
        </JobsProviderWithToast>
      </ToastProvider>
    </ErrorBoundary>
  );
}

/**
 * Portal shell — auth-gated like ProtectedShell, but renders WITHOUT the
 * user-app sidebar / account cluster / pulse strip. Used by the Marketing
 * and Finance portals so they take over the full viewport with their own
 * PortalLayout chrome.
 */
function PortalShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <JobsProviderWithToast>
          <SkipLink />
          <main id="v2-main" className="min-h-[100dvh]">
            <PageTransition>
              <AuthGate>{children}</AuthGate>
            </PageTransition>
          </main>
        </JobsProviderWithToast>
      </ToastProvider>
    </ErrorBoundary>
  );
}

/**
 * Public-page shell: no jobs/toast providers, but still gets ErrorBoundary,
 * skip link, and PageTransition. On desktop renders DesktopShell without the
 * sidebar or jobs/account cluster (Landing/Auth/Pricing don't need them) and
 * with public-marketing nav links instead of app nav.
 */
function PublicShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const publicNavLinks = [
    { id: 'home',    label: t('landing.publicNav.home'),    href: '/v2' },
    { id: 'pricing', label: t('landing.publicNav.pricing'), href: '/v2/pricing' },
    { id: 'login',   label: t('landing.publicNav.login'),   href: '/v2/login' },
    { id: 'signup',  label: t('landing.publicNav.signup'),  href: '/v2/signup', cta: true },
  ];

  return (
    <ErrorBoundary>
      <SkipLink />
      <ResponsiveShell
        withSidebar={false}
        showAccountCluster={false}
        showPulse={false}
        navLinks={publicNavLinks}
      >
        <main id="v2-main" className="min-h-[100dvh] lg:min-h-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </ResponsiveShell>
    </ErrorBoundary>
  );
}

/**
 * Bridges JobsProvider and ToastProvider — onJobSettled needs useToast(),
 * which only resolves under <ToastProvider>.
 */
function JobsProviderWithToast({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  return (
    <JobsProvider
      onJobSettled={(job: Job) => {
        if (job.status === 'completed') {
          showToast({
            tone: 'success',
            message: 'اكتملت المهمة',
            description: job.title,
            ...(job.resultUrl
              ? {
                  onAction: () => {
                    window.history.pushState(null, '', job.resultUrl!);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  },
                  actionLabel: 'عرض النتيجة',
                }
              : {}),
          });
        } else if (job.status === 'failed') {
          showToast({
            tone: 'error',
            message: 'فشلت المهمة',
            description: job.error ?? job.title,
          });
        }
      }}
    >
      {children}
    </JobsProvider>
  );
}

function V2Routes(): ReactElement | null {
  const [matchLanding] = useRoute('/v2');
  const [matchLogin] = useRoute('/v2/login');
  const [matchSignup] = useRoute('/v2/signup');
  const [matchPricing] = useRoute('/v2/pricing');
  const [matchPricingProducts] = useRoute('/v2/pricing/products');
  const [matchAbout]   = useRoute('/v2/about');
  const [matchContact] = useRoute('/v2/contact');
  const [matchPrivacy] = useRoute('/v2/privacy');
  const [matchTerms]   = useRoute('/v2/terms');
  const [matchRefund]  = useRoute('/v2/refund');
  const [matchBilling] = useRoute('/v2/billing');
  const [matchCheckoutSuccess] = useRoute('/v2/checkout/success');
  const [matchCheckoutFailed] = useRoute('/v2/checkout/failed');
  const [matchHome] = useRoute('/v2/home');
  const [matchAnalyze] = useRoute('/v2/analyze');
  const [matchAnalyzeLoading] = useRoute('/v2/analyze/loading');
  const [matchAnalyzeResult] = useRoute('/v2/analyze/result/:id');
  const [matchCvs] = useRoute('/v2/cvs');
  const [matchPosts] = useRoute('/v2/posts');
  const [matchProfile] = useRoute('/v2/me');
  const [matchActivity] = useRoute('/v2/activity');
  const [matchAdmin] = useRoute('/v2/admin');
  const [matchMarketing] = useRoute('/v2/marketing');
  const [matchFinance] = useRoute('/v2/finance');
  const [matchOps] = useRoute('/v2/ops');
  const [matchGrowth] = useRoute('/v2/growth');
  const [matchWorkforce] = useRoute('/v2/workforce');

  if (matchLanding) {
    return <PublicShell><Suspense fallback={<V2Loader />}><Landing /></Suspense></PublicShell>;
  }
  if (matchLogin || matchSignup) {
    return <PublicShell><Suspense fallback={<V2Loader />}><Auth /></Suspense></PublicShell>;
  }
  if (matchPricingProducts) {
    return <PublicShell><Suspense fallback={<V2Loader />}><PricingProducts /></Suspense></PublicShell>;
  }
  if (matchPricing) {
    return <PublicShell><Suspense fallback={<V2Loader />}><Pricing /></Suspense></PublicShell>;
  }
  if (matchAbout) {
    return <PublicShell><Suspense fallback={<V2Loader />}><AboutPublic /></Suspense></PublicShell>;
  }
  if (matchContact) {
    return <PublicShell><Suspense fallback={<V2Loader />}><ContactPublic /></Suspense></PublicShell>;
  }
  if (matchPrivacy) {
    return <PublicShell><Suspense fallback={<V2Loader />}><PrivacyPublic /></Suspense></PublicShell>;
  }
  if (matchTerms) {
    return <PublicShell><Suspense fallback={<V2Loader />}><TermsPublic /></Suspense></PublicShell>;
  }
  if (matchRefund) {
    return <PublicShell><Suspense fallback={<V2Loader />}><RefundPublic /></Suspense></PublicShell>;
  }
  if (matchBilling) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Billing /></Suspense></ProtectedShell>;
  }
  // Checkout return URLs from Moyasar's hosted form. Auth-gated because we
  // poll a user-scoped tRPC query (pricing.getPaymentStatus) — if a guest
  // somehow lands here we want them to log in before seeing transaction data.
  if (matchCheckoutSuccess) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CheckoutSuccess /></Suspense></ProtectedShell>;
  }
  if (matchCheckoutFailed) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CheckoutFailed /></Suspense></ProtectedShell>;
  }
  if (matchHome) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Home /></Suspense></ProtectedShell>;
  }
  // 3-stage analysis flow — each route renders a dedicated V2 page so the
  // user gets a focused screen per stage instead of the V1 single-page mash.
  if (matchAnalyze) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><ProfileInput /></Suspense></ProtectedShell>;
  }
  if (matchAnalyzeLoading) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><AnalysisLoading /></Suspense></ProtectedShell>;
  }
  if (matchAnalyzeResult) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><AnalysisResults /></Suspense></ProtectedShell>;
  }
  // /v2/cvs renders the real CV Tailor page (form + Claude generation +
  // DOCX/PDF export) inside the V2 ProtectedShell chrome.
  if (matchCvs) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CVBuilder /></Suspense></ProtectedShell>;
  }
  if (matchPosts) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Posts /></Suspense></ProtectedShell>;
  }
  if (matchProfile) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Profile /></Suspense></ProtectedShell>;
  }
  if (matchActivity) {
    // Activity has been folded into the Home dashboard. Bookmarks redirect.
    window.history.replaceState({}, '', '/v2/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return null;
  }
  // /v2/admin is the legacy path — redirect to /v2/marketing so old bookmarks
  // still work but the canonical URL reflects the persona.
  if (matchAdmin) {
    window.history.replaceState({}, '', '/v2/marketing');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return null;
  }
  // Marketing portal — uses its own PortalLayout, not the ProtectedShell.
  // We still need the auth guard from ProtectedShell's logic, so we let the
  // AdminPanel component itself wrap the dashboard in PortalLayout and
  // perform the admin gate.
  if (matchMarketing) {
    return <PortalShell><Suspense fallback={<V2Loader />}><AdminPanel /></Suspense></PortalShell>;
  }
  if (matchFinance) {
    return <PortalShell><Suspense fallback={<V2Loader />}><FinancePanel /></Suspense></PortalShell>;
  }
  if (matchOps) {
    return <PortalShell><Suspense fallback={<V2Loader />}><OpsPanel /></Suspense></PortalShell>;
  }
  if (matchGrowth) {
    return <PortalShell><Suspense fallback={<V2Loader />}><GrowthPanel /></Suspense></PortalShell>;
  }
  if (matchWorkforce) {
    return <PortalShell><Suspense fallback={<V2Loader />}><WorkforcePanel /></Suspense></PortalShell>;
  }

  return null;
}

export default V2Routes;
