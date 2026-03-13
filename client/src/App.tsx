import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import ClientDashboard from "./pages/ClientDashboard";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import Leads from "./pages/Leads";
import Queue from "./pages/Queue";
import LeadImport from "./pages/LeadImport";
import Templates from "./pages/Templates";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Demo from "./pages/Demo";
import Extension from "./pages/Extension";
import ExtensionPairing from "./pages/ExtensionPairing";
import About from "./pages/About";
import Invite from "./pages/Invite";
import Onboarding from "./pages/Onboarding";
import Connected from "./pages/Connected";
import OAuthError from "./pages/OAuthError";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignWizard from "./pages/CampaignWizard";

/**
 * Route guard: requires authenticated user (any role).
 * Redirects to /login if not authenticated.
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return <Component />;
}

/**
 * Route guard: requires super_admin role.
 * Client users get redirected to /app.
 */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  if (user.role !== 'super_admin') {
    window.location.href = '/app';
    return null;
  }

  return <Component />;
}

/**
 * Route guard: requires client_user or super_admin.
 * Unauthenticated users get redirected to /login.
 */
function ClientRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return <Component />;
}

/**
 * Legacy /dashboard/* redirect — sends to /admin or /app based on role.
 */
function LegacyRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/login';
    return null;
  }

  if (user.role === 'super_admin') {
    window.location.href = '/admin';
  } else {
    window.location.href = '/app';
  }
  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path={"/"} component={Landing} />
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/auth/callback"} component={AuthCallback} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/contact"} component={Contact} />
      <Route path={"/demo"} component={Demo} />
      <Route path={"/extension"} component={Extension} />
      <Route path={"/about"} component={About} />
      <Route path="/invite/:token" component={Invite} />
      <Route path={"/connected"} component={Connected} />
      <Route path={"/oauth/error"} component={OAuthError} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />

      {/* Client dashboard routes (/app/*) — any authenticated user */}
      <Route path={/^\/app\/onboarding/} component={() => <ClientRoute component={Onboarding} />} />
      <Route path={/^\/app\/import/} component={() => <ClientRoute component={LeadImport} />} />
      <Route path={/^\/app\/extension/} component={() => <ClientRoute component={ExtensionPairing} />} />
      <Route path={/^\/app\/templates/} component={() => <ClientRoute component={Templates} />} />
      <Route path={/^\/app\/leads/} component={() => <ClientRoute component={Leads} />} />
      <Route path={/^\/app\/queue/} component={() => <ClientRoute component={Queue} />} />
      <Route path="/app/campaigns/new" component={() => <ClientRoute component={CampaignWizard} />} />
      <Route path="/app/campaigns/:id" component={() => <ClientRoute component={CampaignDetail} />} />
      <Route path={/^\/app\/campaigns/} component={() => <ClientRoute component={Campaigns} />} />
      <Route path={/^\/app/} component={() => <ClientRoute component={ClientDashboard} />} />

      {/* Super admin dashboard routes (/admin/*) — super_admin only */}
      <Route path={/^\/admin\/operate/} component={() => <AdminRoute component={Dashboard} />} />
      <Route path={/^\/admin/} component={() => <AdminRoute component={Dashboard} />} />

      {/* Legacy /dashboard routes — role-aware redirects */}
      <Route path={/^\/dashboard/} component={() => <LegacyRedirect />} />

      {/* 404 */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const lang = typeof window !== 'undefined' ? localStorage.getItem('wassel_lang') || 'en' : 'en';
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </div>
  );
}

export default App;
