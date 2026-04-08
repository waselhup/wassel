import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTranslation } from 'react-i18next';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import DashboardHome from './pages/DashboardHome';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Tokens from './pages/Tokens';
import Payment from './pages/Payment';
import LinkedInAnalyzer from './pages/LinkedInAnalyzer';
import CVTailor from './pages/CVTailor';
import CampaignList from './pages/CampaignList';
import CampaignNew from './pages/CampaignNew';
import CampaignReport from './pages/CampaignReport';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCampaigns from './pages/admin/AdminCampaigns';
import AdminSettings from './pages/admin/AdminSettings';

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
  const [matchAppLinkedin] = useRoute('/app/linkedin');
  const [matchAppCv] = useRoute('/app/cv');
  const [matchAppCampaignsList] = useRoute('/app/campaigns');
  const [matchAppCampaignsNew] = useRoute('/app/campaigns/new');
  const [matchAppCampaignsReport] = useRoute('/app/campaigns/:id');
  const [matchAppTokens] = useRoute('/app/tokens');
  const [matchAppPayment] = useRoute('/app/payment');
  const [matchAppProfile] = useRoute('/app/profile');
  const [matchLogin] = useRoute('/login');
  const [matchSignup] = useRoute('/signup');
  const [matchReset] = useRoute('/reset-password');

  // Admin Routes
  const [matchAdminHome] = useRoute('/admin');
  const [matchAdminUsers] = useRoute('/admin/users');
  const [matchAdminCampaigns] = useRoute('/admin/campaigns');
  const [matchAdminSettings] = useRoute('/admin/settings');

  if (match) return <LandingPage />;
  if (matchLogin) return <Login />;
  if (matchSignup) return <Signup />;
  if (matchReset) return <ResetPassword />;

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
  if (matchAppLinkedin)
    return (
      <ProtectedRoute>
        <LinkedInAnalyzer />
      </ProtectedRoute>
    );
  if (matchAppCv)
    return (
      <ProtectedRoute>
        <CVTailor />
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
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;