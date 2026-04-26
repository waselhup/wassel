import { lazy, Suspense, type ReactElement, type ReactNode } from 'react';
import { useRoute } from 'wouter';
import { JobsProvider } from '@/lib/v2/jobs';
import { ToastProvider, useToast } from '@/lib/v2/toast';
import type { Job } from '@/lib/v2/jobs';

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
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-v2-canvas">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-v2-line border-t-teal-500" />
    </div>
  );
}

/**
 * Wraps the protected v2 surface (Home + Radar + Posts + Profile + Activity)
 * with the jobs/toast providers, and bridges them: when a job settles, fire
 * a toast. Public pages (Landing/Auth/Pricing) deliberately render outside
 * this shell so their Topbar can opt out of pulse + jobs UI.
 */
function ProtectedShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <JobsProviderWithToast>{children}</JobsProviderWithToast>
    </ToastProvider>
  );
}

/**
 * Splits the provider chain so the toast hook is available when JobsProvider
 * boots — onJobSettled needs useToast(), which only resolves under <ToastProvider>.
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
              ? { onAction: () => { window.history.pushState(null, '', job.resultUrl!); window.dispatchEvent(new PopStateEvent('popstate')); }, actionLabel: 'عرض النتيجة' }
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

  // Public pages — no jobs/toast providers; their Topbars pass showPulse=false
  // and showJobsIndicator=false (see the page files).
  if (matchLanding) {
    return <Suspense fallback={<V2Loader />}><Landing /></Suspense>;
  }
  if (matchLogin || matchSignup) {
    return <Suspense fallback={<V2Loader />}><Auth /></Suspense>;
  }
  if (matchPricing) {
    return <Suspense fallback={<V2Loader />}><Pricing /></Suspense>;
  }

  // Protected pages — wrapped in providers so they share one job pool.
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
