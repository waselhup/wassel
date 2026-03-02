import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
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
import About from "./pages/About";

/**
 * Protected route wrapper that redirects to login if not authenticated
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحقق من جلستك...</p>
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

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path={"/"} component={Landing} />
      <Route path={"/login"} component={Login} />
      <Route path={"/auth/callback"} component={AuthCallback} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/contact"} component={Contact} />
      <Route path={"/demo"} component={Demo} />
      <Route path={"/extension"} component={Extension} />
      <Route path={"/about"} component={About} />

      {/* Protected routes */}
      <Route path={/^\/dashboard\/import/} component={() => <ProtectedRoute component={LeadImport} />} />
      <Route path={/^\/dashboard\/templates/} component={() => <ProtectedRoute component={Templates} />} />
      <Route path={/^\/dashboard\/leads/} component={() => <ProtectedRoute component={Leads} />} />
      <Route path={/^\/dashboard\/queue/} component={() => <ProtectedRoute component={Queue} />} />
      <Route path={/^\/dashboard\/campaigns/} component={() => <ProtectedRoute component={Campaigns} />} />
      <Route path={/^\/dashboard/} component={() => <ProtectedRoute component={Dashboard} />} />

      {/* 404 */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
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
  );
}

export default App;
