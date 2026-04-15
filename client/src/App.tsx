import React, { Suspense, lazy } from 'react';
import { useRoute, useLocation } from 'wouter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[var(--bg-surface)]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-[var(--accent-secondary)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
    </div>
  </div>
);

// Eagerly loaded pages (needed immediately)
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';

// Lazy loaded pages (loaded on demand)
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Profile = lazy(() => import('./pages/Profile'));
const Tokens = lazy(() => import('./pages/Tokens'));
const Payment = lazy(() => import('./pages/Payment'));
const CVTailor = lazy(() => import('./pages/CVTailor'));
const CampaignList = lazy(() => import('./pages/CampaignList'));
const CampaignNew = lazy(() => import('./pages/CampaignNew'));
const CampaignReport = lazy(() => import('./pages/CampaignReport'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminCampaigns = lazy(() => import('./pages/admin/AdminCampaigns'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

// New Pages
const Pricing = lazy(() => import('./pages/Pricing'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Analytics = lazy(() => import('./pages/Analytics'));
const About = lazy(() => import('./pages/About'));
const Blog = lazy(() => import('./pages/Blog'));
const ProfileAnalysis = lazy(() => import('./pages/ProfileAnalysis'));
const Posts = lazy(() => import('./pages/Posts'));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();

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

  if (!user) {
    navigate('/login');
    return null;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
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
  const [matchAppKnowledge] = useRoute('/app/knowledge');
  const [matchAppProfile] = useRoute('/app/profile');
  const [matchLogin] = useRoute('/login');
  const [matchSignup] = useRoute('/signup');
  const [matchReset] = useRoute('/reset-password');

  // Admin Routes
  const [matchAdminHome] = useRoute('/admin');
  const [matchAdminUsers] = useRoute('/admin/users');
  const [matchAdminCampaigns] = useRoute('/admin/campaigns');
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

  if (match) return <LandingPage />;
  if (matchLogin) return <Login />;
  if (matchSignup) return <Signup />;
  if (matchReset) return <ResetPassword />;

  if (matchPricing) return <Pricing />;
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
    // Redirect old /app/linkedin to /app/profile-analysis
    window.location.replace('/app/profile-analysis');
    return null;
  }
  if (matchAppCv)
    return (
      <ProtectedRoute>
        <CVTailor />
      </ProtectedRoute>
    );
  if (matchAppKnowledge)
    return (
      <ProtectedRoute>
        <KnowledgeBase />
      </ProtectedRoute>
    );
  if (matchAppCampaignsNew)
    return (
      <ProtectedRoute>
        <CampaignNew />
      </ProtectedRoute>
    );
  if (matchAppCampaignsReport)
    return (
      <ProtectedRoute>
        <CampaignReport />
      </ProtectedRoute>
    );
  if (matchAppCampaignsList)
    return (
      <ProtectedRoute>
        <CampaignList />
      </ProtectedRoute>
    );

  if (matchAppProfileAnalysis)
    return (
      <ProtectedRoute>
        <ProfileAnalysis />
      </ProtectedRoute>
    );
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

  // Admin Routes
  if (matchAdminHome)
    return (
      <ProtectedRoute>
        <AdminDashboard />
      </ProtectedRoute>
    );
  if (matchAdminUsers)
    return (
      <ProtectedRoute>
        <AdminUsers />
      </ProtectedRoute>
    );
  if (matchAdminCampaigns)
    return (
      <ProtectedRoute>
        <AdminCampaigns />
      </ProtectedRoute>
    );
  if (matchAdminSettings)
    return (
      <ProtectedRoute>
        <AdminSettings />
      </ProtectedRoute>
    );

  return <LandingPage />;
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