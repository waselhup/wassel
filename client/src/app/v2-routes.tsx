import { lazy, Suspense, type ReactElement } from 'react';
import { useRoute } from 'wouter';

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
 * V2Routes — owns every URL under `/v2/*`.
 *
 * The legacy router in App.tsx delegates to this component when the path starts
 * with `/v2`, so v2 pages live in their own subtree without touching anything
 * the existing app already does.
 *
 * Returns `null` if no v2 path matched, letting the parent fall through to its
 * default `<LandingPage />` behaviour for unknown URLs.
 */
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
    return (
      <Suspense fallback={<V2Loader />}>
        <Landing />
      </Suspense>
    );
  }
  if (matchLogin || matchSignup) {
    return (
      <Suspense fallback={<V2Loader />}>
        <Auth />
      </Suspense>
    );
  }
  if (matchPricing) {
    return (
      <Suspense fallback={<V2Loader />}>
        <Pricing />
      </Suspense>
    );
  }
  if (matchHome) {
    return (
      <Suspense fallback={<V2Loader />}>
        <Home />
      </Suspense>
    );
  }
  if (matchInput) {
    return (
      <Suspense fallback={<V2Loader />}>
        <RadarInput />
      </Suspense>
    );
  }
  if (matchLoading) {
    return (
      <Suspense fallback={<V2Loader />}>
        <RadarLoading />
      </Suspense>
    );
  }
  if (matchResult) {
    return (
      <Suspense fallback={<V2Loader />}>
        <RadarResult />
      </Suspense>
    );
  }
  if (matchPosts) {
    return (
      <Suspense fallback={<V2Loader />}>
        <Posts />
      </Suspense>
    );
  }
  if (matchProfile) {
    return (
      <Suspense fallback={<V2Loader />}>
        <Profile />
      </Suspense>
    );
  }
  if (matchActivity) {
    return (
      <Suspense fallback={<V2Loader />}>
        <Activity />
      </Suspense>
    );
  }

  return null;
}

export default V2Routes;
