import React, { Suspense, lazy, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';
import V2Routes from './app/v2-routes';

/**
 * Replace the current URL with `to` and render nothing. Used to retire
 * legacy public pages that have v2 equivalents while preserving inbound
 * links and bookmarks.
 */
function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[var(--bg-surface)]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-[var(--accent-secondary)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
    </div>
  </div>
);

// Eagerly loaded pages (needed immediately).
// Note: LandingPage, Login, Signup were retired in favor of /v2 — their
// legacy paths now redirect (see PUBLIC redirects below).
import ResetPassword from './pages/ResetPassword';

// Lazy loaded pages (loaded on demand). CVTailor / ProfileAnalysis / Admin*
// are imported by their V2 wrappers in client/src/pages/v2/, not here, so
// the legacy /app/cv, /app/profile-analysis and /admin* paths only redirect
// rather than render the V1 chrome.
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Profile = lazy(() => import('./pages/Profile'));
const Tokens = lazy(() => import('./pages/Tokens'));
const Payment = lazy(() => import('./pages/Payment'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));

// New Pages
// Pricing retired in favor of /v2/pricing — legacy /pricing redirects.
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Analytics = lazy(() => import('./pages/Analytics'));
const About = lazy(() => import('./pages/About'));
const Blog = lazy(() => import('./pages/Blog'));
const Posts = lazy(() => import('./pages/Posts'));
const MyTickets = lazy(() => import('./pages/MyTickets'));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  // Defer navigate() to an effect so we don't update one router during the
  // render of another. Unauthenticated users land on /v2/login (the v1
  // /login route already redirects there).
  useEffect(() => {
    if (!loading && !user) {
      // Use the browser to avoid coupling to wouter's setLocation during render.
      window.history.replaceState({}, '', '/v2/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-surface)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[var(--accent-secondary)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
          <p className="text-[var(--text-secondary)]">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  // v2 redesign — owns everything under /v2/*. We check the location prefix
  // directly because wouter wildcards (`:rest*`) only match a single segment.
  const [location] = useLocation();
  const matchV2 = location === '/v2' || location.startsWith('/v2/');

  const [match] = useRoute('/');
  const [matchAppHome] = useRoute('/app');
  const [matchAppSetup] = useRoute('/app/setup');
  const [matchAppLinkedin] = useRoute('/app/linkedin');  // redirect → profile-analysis
  const [matchAppCv] = useRoute('/app/cv');
  const [matchAppCampaignsList] = useRoute('/app/campaigns');
  const [matchAppCampaignsNew] = useRoute('/app/campaigns/new');
  const [matchAppCampaignsReport] = useRoute('/app/campaigns/:id');
  const [matchAppTokens] = useRoute('/app/tokens');
  const [matchAppPayment] = useRoute('/app/payment');
  const [matchAppComingSoon] = useRoute('/app/coming-soon');
  const [matchAppProfile] = useRoute('/app/profile');
  const [matchLogin] = useRoute('/login');
  const [matchSignup] = useRoute('/signup');
  const [matchReset] = useRoute('/reset-password');

  // Admin Routes
  const [matchAdminHome] = useRoute('/admin');
  const [matchAdminUsers] = useRoute('/admin/users');
  const [matchAdminSettings] = useRoute('/admin/settings');

  // New routes
  const [matchPricing] = useRoute('/pricing');
  const [matchPrivacy] = useRoute('/privacy');
  const [matchTerms] = useRoute('/terms');
  const [matchAbout] = useRoute('/about');
  const [matchBlog] = useRoute('/blog');
  const [matchAppAnalytics] = useRoute('/app/analytics');
  const [matchAppProfileAnalysis] = useRoute('/app/profile-analysis');
  const [matchAppPosts] = useRoute('/app/posts');
  const [matchAppTickets] = useRoute('/app/tickets');
  const [matchAppAdmin] = useRoute('/app/admin');

  if (matchV2) return <V2Routes />;

  // Public routes that have a v2 equivalent → redirect (preserve bookmarks).
  // /reset-password and /about, /blog, /privacy, /terms keep their legacy v1
  // pages until the corresponding v2 versions land in Phase G.
  if (match)        return <Redirect to="/v2" />;
  if (matchLogin)   return <Redirect to="/v2/login" />;
  if (matchSignup)  return <Redirect to="/v2/signup" />;
  if (matchPricing) return <Redirect to="/v2/pricing" />;

  // Legacy /app/cv, /app/profile-analysis, /admin*, /app/admin routes are
  // now V2-only. Anyone landing on a legacy path is bounced into V2 so they
  // never see the old chrome. Other /app/* pages (DashboardHome, Profile,
  // etc.) keep working until they get full V2 equivalents.
  if (matchAppCv)              return <Redirect to="/v2/cvs" />;
  if (matchAppProfileAnalysis) return <Redirect to="/v2/analyze" />;
  if (matchAdminHome)          return <Redirect to="/v2/admin" />;
  if (matchAdminUsers)         return <Redirect to="/v2/admin" />;
  if (matchAdminSettings)      return <Redirect to="/v2/admin" />;
  if (matchAppAdmin)           return <Redirect to="/v2/admin" />;

  if (matchReset) return <ResetPassword />;

  if (matchPrivacy) return <PrivacyPolicy />;
  if (matchTerms) return <TermsOfService />;
  if (matchAbout) return <About />;
  if (matchBlog) return <Blog />;

  // Protected app routes
  if (matchAppHome)
    return (
      <ProtectedRoute>
        <DashboardHome />
      </ProtectedRoute>
    );
  if (matchAppSetup)
    return (
      <ProtectedRoute>
        <Onboarding />
      </ProtectedRoute>
    );
  if (matchAppProfile)
    return (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    );
  if (matchAppTokens)
    return (
      <ProtectedRoute>
        <Tokens />
      </ProtectedRoute>
    );
  if (matchAppPayment)
    return (
      <ProtectedRoute>
        <Payment />
      </ProtectedRoute>
    );
  if (matchAppLinkedin) {
    // Legacy /app/linkedin → V2 analyze (kept as a redirect for any
    // outstanding bookmarks).
    return <Redirect to="/v2/analyze" />;
  }
  if (matchAppComingSoon)
    return (
      <ProtectedRoute>
        <ComingSoon />
      </ProtectedRoute>
    );
  if (matchAppCampaignsNew || matchAppCampaignsReport || matchAppCampaignsList) {
    window.location.replace('/app/coming-soon?feature=campaigns');
    return null;
  }

  if (matchAppPosts)
    return (
      <ProtectedRoute>
        <Posts />
      </ProtectedRoute>
    );
  if (matchAppAnalytics)
    return (
      <ProtectedRoute>
        <Analytics />
      </ProtectedRoute>
    );
  if (matchAppTickets)
    return (
      <ProtectedRoute>
        <MyTickets />
      </ProtectedRoute>
    );

  // Unknown path → land users on v2 home (matches the new default).
  return <Redirect to="/v2" />;
};

const App: React.FC = () => {
  return (
    <Sentry.ErrorBoundary fallback={<div className="p-8 text-center text-red-500">Something went wrong. Please refresh.</div>}>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <AppRoutes />
        </Suspense>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
};

export default App;