import { lazy, Suspense, useEffect, type ReactElement, type ReactNode } from 'react';
import { useLocation, useRoute } from 'wouter';
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
const Home = lazy(() => import('@/pages/v2/Home'));
const RadarInput = lazy(() => import('@/pages/v2/RadarInput'));
const RadarLoading = lazy(() => import('@/pages/v2/RadarLoading'));
const RadarResult = lazy(() => import('@/pages/v2/RadarResult'));
const Posts = lazy(() => import('@/pages/v2/Posts'));
const Profile = lazy(() => import('@/pages/v2/Profile'));
const Activity = lazy(() => import('@/pages/v2/Activity'));

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
  return (
    <a
      href="#v2-main"
      className="absolute start-4 top-2 z-[100] -translate-y-12 rounded-v2-md bg-v2-ink px-3 py-2 font-ar text-[13px] font-semibold text-white shadow-lift transition-transform duration-200 ease-out focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
    >
      تخطٍ إلى المحتوى الرئيسي
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
 * Public-page shell: no jobs/toast providers, but still gets ErrorBoundary,
 * skip link, and PageTransition. On desktop renders DesktopShell without the
 * sidebar or jobs/account cluster (Landing/Auth/Pricing don't need them) and
 * with public-marketing nav links instead of app nav.
 */
const PUBLIC_NAV_LINKS = [
  { id: 'home',    label: 'الرئيسية',     href: '/v2' },
  { id: 'pricing', label: 'الأسعار',      href: '/v2/pricing' },
  { id: 'login',   label: 'تسجيل دخول',    href: '/v2/login' },
  { id: 'signup',  label: 'إنشاء حساب',    href: '/v2/signup', cta: true },
];

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <SkipLink />
      <ResponsiveShell
        withSidebar={false}
        showAccountCluster={false}
        showPulse={false}
        navLinks={PUBLIC_NAV_LINKS}
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
  const [matchHome] = useRoute('/v2/home');
  const [matchInput] = useRoute('/v2/analyze');
  const [matchLoading] = useRoute('/v2/analyze/loading');
  const [matchResult] = useRoute('/v2/analyze/result/:id');
  const [matchPosts] = useRoute('/v2/posts');
  const [matchProfile] = useRoute('/v2/me');
  const [matchActivity] = useRoute('/v2/activity');

  if (matchLanding) {
    return <PublicShell><Suspense fallback={<V2Loader />}><Landing /></Suspense></PublicShell>;
  }
  if (matchLogin || matchSignup) {
    return <PublicShell><Suspense fallback={<V2Loader />}><Auth /></Suspense></PublicShell>;
  }
  if (matchPricing) {
    return <PublicShell><Suspense fallback={<V2Loader />}><Pricing /></Suspense></PublicShell>;
  }
  if (matchHome) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Home /></Suspense></ProtectedShell>;
  }
  if (matchInput) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><RadarInput /></Suspense></ProtectedShell>;
  }
  if (matchLoading) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><RadarLoading /></Suspense></ProtectedShell>;
  }
  if (matchResult) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><RadarResult /></Suspense></ProtectedShell>;
  }
  if (matchPosts) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Posts /></Suspense></ProtectedShell>;
  }
  if (matchProfile) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Profile /></Suspense></ProtectedShell>;
  }
  if (matchActivity) {
    return <ProtectedShell><Suspense fallback={<V2Loader />}><Activity /></Suspense></ProtectedShell>;
  }

  return null;
}

export default V2Routes;
