import { Suspense, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
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
import { trpc } from '@/lib/trpc';

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
const ContentPreflight = lazy(() => import('@/pages/v2/ContentPreflight'));
const ContentGenerating = lazy(() => import('@/pages/v2/ContentGenerating'));
const ContentEditor = lazy(() => import('@/pages/v2/ContentEditor'));
const Profile = lazy(() => import('@/pages/v2/Profile'));
// /v2/activity retired — its content lives inside /v2/home as the "Recent
// activity" panel. Legacy path now redirects (see matchActivity below).
// V2-wrapped versions of the real V1 feature pages — they reuse the working
// tRPC/business logic but render inside the V2 ProtectedShell chrome.
const CVBuilder = lazy(() => import('@/pages/v2/CVBuilder'));
const CVPreflight = lazy(() => import('@/pages/v2/CVPreflight'));
const CVBuilding = lazy(() => import('@/pages/v2/CVBuilding'));
const CVEditor = lazy(() => import('@/pages/v2/CVEditor'));
const AdminPanel = lazy(() => import('@/pages/v2/AdminPanel'));
const FinancePanel = lazy(() => import('@/pages/v2/FinancePanel'));
const OpsPanel = lazy(() => import('@/pages/v2/OpsPanel'));
const GrowthPanel = lazy(() => import('@/pages/v2/GrowthPanel'));
const WorkforcePanel = lazy(() => import('@/pages/v2/WorkforcePanel'));
const CustomerSuccessPanel = lazy(() => import('@/pages/v2/CustomerSuccessPanel'));
const RevenueLabPanel = lazy(() => import('@/pages/v2/RevenueLabPanel'));
const ProductIntelPanel = lazy(() => import('@/pages/v2/ProductIntelPanel'));
const CompliancePanel = lazy(() => import('@/pages/v2/CompliancePanel'));
const WarRoomPanel = lazy(() => import('@/pages/v2/WarRoomPanel'));

// 3-stage profile analysis flow: Input → Loading → Result. State bridges
// stages via sessionStorage (see lib/v2/analysisSession.ts). Stage 1 lives
// at /v2/analyze; the V1 single-page page is no longer routed.
const ProfileInput = lazy(() => import('@/pages/v2/analysis/ProfileInput'));
const AnalysisLoading = lazy(() => import('@/pages/v2/analysis/AnalysisLoading'));
const AnalysisResults = lazy(() => import('@/pages/v2/analysis/AnalysisResults'));

// Career Copilot — Sprint 2 surfaces.
const OnboardingWizard = lazy(() => import('@/pages/onboarding/OnboardingWizard'));
const CareerProfileSettings = lazy(() => import('@/pages/v2/CareerProfileSettings'));
const PrivacyAndData = lazy(() => import('@/pages/v2/PrivacyAndData'));

// Career Copilot — Sprint 8 surfaces.
const Notifications         = lazy(() => import('@/pages/v2/Notifications'));
const NotificationSettings  = lazy(() => import('@/pages/v2/NotificationSettings'));

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
// Routes that an unboarded user is allowed to visit (otherwise we'd risk a
// redirect loop, or hide PDPL controls from someone trying to delete their
// data before onboarding). Anything else under /v2 triggers the redirect.
const ONBOARDING_BYPASS_PREFIXES = [
  '/v2/onboarding',
  '/v2/settings',
  '/v2/billing',
  '/v2/checkout',
  '/v2/me',
  '/v2/war-room',
  '/v2/notifications',
];

function shouldBypassOnboardingRedirect(location: string): boolean {
  return ONBOARDING_BYPASS_PREFIXES.some((p) => location === p || location.startsWith(p + '/'));
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();
  const [careerProfileChecked, setCareerProfileChecked] = useState(false);
  const checkedForUserRef = useRef<string | null>(null);
  const appOpenPingedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/v2/login', { replace: true });
    }
  }, [loading, user, navigate]);

  // Smart dedup: ping the server once per user/session so the notification
  // engine can skip email-only sends that would arrive while the user is
  // actively in-app (10-min window). Fire-and-forget — failures are silent.
  useEffect(() => {
    if (loading || !user) return;
    if (appOpenPingedForUserRef.current === user.id) return;
    appOpenPingedForUserRef.current = user.id;
    trpc.notifications.markAppOpened().catch(() => { /* silent */ });
  }, [loading, user]);

  // After login, fetch the career_profile once per user/session. If null and
  // we're not already on an onboarding-bypass route, redirect to /v2/onboarding.
  useEffect(() => {
    if (loading || !user) return;
    if (checkedForUserRef.current === user.id) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await trpc.careerProfile.get();
        if (cancelled) return;
        checkedForUserRef.current = user.id;
        setCareerProfileChecked(true);
        if (!result?.profile && !shouldBypassOnboardingRedirect(location)) {
          navigate('/v2/onboarding', { replace: true });
        }
      } catch (e) {
        // Failing to fetch shouldn't strand the user — let them through.
        // The careerProfile router being unavailable (e.g. during Sprint 1
        // before migration apply) is a known transient.
        console.warn('[AuthGate] careerProfile.get failed (non-blocking):', e);
        checkedForUserRef.current = user.id;
        setCareerProfileChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user, location, navigate]);

  if (loading) {
    return <V2Loader />;
  }

  if (!user) return null;

  // Block render until the first career_profile check resolves, so a fresh
  // user doesn't see /v2/home flash before redirecting to onboarding.
  if (!careerProfileChecked) {
    return <V2Loader />;
  }

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
  const [matchCvsNew] = useRoute('/v2/cvs/new');
  const [matchCvsBuilding] = useRoute('/v2/cvs/building');
  const [matchCvsEditor] = useRoute('/v2/cvs/:id');
  const [matchPosts] = useRoute('/v2/posts');
  const [matchPostsNew] = useRoute('/v2/posts/new/:type');
  const [matchPostsGenerating] = useRoute('/v2/posts/generating');
  const [matchPostsEditor] = useRoute('/v2/posts/:id');
  const [matchProfile] = useRoute('/v2/me');
  const [matchActivity] = useRoute('/v2/activity');
  const [matchOnboarding] = useRoute('/v2/onboarding');
  const [matchSettingsCareer] = useRoute('/v2/settings/career');
  const [matchSettingsPrivacy] = useRoute('/v2/settings/privacy');
  const [matchSettingsNotifications] = useRoute('/v2/settings/notifications');
  const [matchNotifications] = useRoute('/v2/notifications');
  const [matchAdmin] = useRoute('/v2/admin');
  const [matchMarketing] = useRoute('/v2/marketing');
  const [matchFinance] = useRoute('/v2/finance');
  const [matchOps] = useRoute('/v2/ops');
  const [matchGrowth] = useRoute('/v2/growth');
  const [matchWorkforce] = useRoute('/v2/workforce');
  const [matchCustomerSuccess] = useRoute('/v2/customer-success');
  const [matchRevenueLab] = useRoute('/v2/revenue-lab');
  const [matchProductIntel] = useRoute('/v2/product-intel');
  const [matchCompliance] = useRoute('/v2/compliance');
  const [matchWarRoom] = useRoute('/v2/war-room');

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
  if (matchOnboarding) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><OnboardingWizard /></Suspense></ProtectedShell>;
  }
  if (matchSettingsCareer) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CareerProfileSettings /></Suspense></ProtectedShell>;
  }
  if (matchSettingsPrivacy) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><PrivacyAndData /></Suspense></ProtectedShell>;
  }
  if (matchSettingsNotifications) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><NotificationSettings /></Suspense></ProtectedShell>;
  }
  if (matchNotifications) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Notifications /></Suspense></ProtectedShell>;
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
  // Sprint 4 — Resume v2: list → preflight → building → editor.
  // Order matters: /v2/cvs/new must match BEFORE /v2/cvs/:id so the slug
  // 'new' isn't treated as a version id.
  if (matchCvsNew) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CVPreflight /></Suspense></ProtectedShell>;
  }
  if (matchCvsBuilding) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CVBuilding /></Suspense></ProtectedShell>;
  }
  if (matchCvsEditor) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CVEditor /></Suspense></ProtectedShell>;
  }
  if (matchCvs) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><CVBuilder /></Suspense></ProtectedShell>;
  }
  // Sprint 5 — Content v2: hub → preflight → generating → editor.
  // Order matters: more-specific routes match before /v2/posts/:id catches them.
  if (matchPostsNew) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><ContentPreflight /></Suspense></ProtectedShell>;
  }
  if (matchPostsGenerating) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><ContentGenerating /></Suspense></ProtectedShell>;
  }
  if (matchPosts) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Posts /></Suspense></ProtectedShell>;
  }
  if (matchPostsEditor) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><ContentEditor /></Suspense></ProtectedShell>;
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
  if (matchCustomerSuccess) {
    return <PortalShell><Suspense fallback={<V2Loader />}><CustomerSuccessPanel /></Suspense></PortalShell>;
  }
  if (matchRevenueLab) {
    return <PortalShell><Suspense fallback={<V2Loader />}><RevenueLabPanel /></Suspense></PortalShell>;
  }
  if (matchProductIntel) {
    return <PortalShell><Suspense fallback={<V2Loader />}><ProductIntelPanel /></Suspense></PortalShell>;
  }
  if (matchCompliance) {
    return <PortalShell><Suspense fallback={<V2Loader />}><CompliancePanel /></Suspense></PortalShell>;
  }
  if (matchWarRoom) {
    return <PortalShell><Suspense fallback={<V2Loader />}><WarRoomPanel /></Suspense></PortalShell>;
  }

  return null;
}

export default V2Routes;
