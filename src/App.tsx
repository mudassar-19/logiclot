import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import AppLayout from "@/components/layout/AppLayout";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Demo from "./pages/Demo";
import NotFound from "./pages/NotFound";
import LearnMore from "./pages/LearnMore";
// New app routes
import NewAppLayout from "./pages/app/AppLayout";
import AppDashboard from "./pages/app/Dashboard";
import Settings from "./pages/app/Settings";
import Preferences from "./pages/app/Preferences";
import BuyList from "./pages/app/BuyList";
import BiddingMap from "./pages/app/BiddingMap";

import MultiStepSignup from "./pages/signup/MultiStepSignup";
// Admin routes
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminDealerships from "./pages/admin/AdminDealerships";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminData from "./pages/admin/AdminData";
import AdminAIEngine from "./pages/admin/AdminAIEngine";
import AdminCampaigns from "./pages/admin/AdminCampaigns";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminSettings from "./pages/admin/AdminSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 1000 * 30, // Cache active queries for 30 seconds
    },
  },
});

// Protected route wrapper for /app/* routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userRole, loading } = useAuth();
  
  if (loading || userRole === undefined) {
    return (
      <div className="min-h-screen bg-[#f8f8fb] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth?tab=login" replace />;
  }
  
  // If authenticated but no role yet (no org), redirect to onboarding step 2
  if (userRole === null) {
    return <Navigate to="/get-started?step=2" replace />;
  }
  
  return <>{children}</>;
};

// Redirect authenticated users away from public marketing pages
const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes with standard layout */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<PublicOnlyRoute><Home /></PublicOnlyRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/learn-more" element={<LearnMore />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            </Route>
            
            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/overview" replace />} />
              <Route path="overview" element={<AdminOverview />} />
              <Route path="dealerships" element={<AdminDealerships />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="data" element={<AdminData />} />
              <Route path="ai-engine" element={<AdminAIEngine />} />
              <Route path="campaigns" element={<AdminCampaigns />} />
              <Route path="billing" element={<AdminBilling />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            
            {/* Demo route - public, no layout wrapper needed */}
            <Route path="/demo" element={<Demo />} />
            
            {/* Get Started redirects to auth signup */}
            <Route path="/get-started" element={<MultiStepSignup />} />
            
            {/* Protected /app/* routes with Skote-style layout + onboarding */}
            <Route path="/app" element={
              <ProtectedRoute>
                <OnboardingProvider>
                  <NewAppLayout />
                </OnboardingProvider>
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<AppDashboard />} />
              <Route path="preferences" element={<Preferences />} />
              <Route path="buy-list" element={<BuyList />} />
              <Route path="lane-strategy" element={<BiddingMap />} />
              <Route path="bidding-map" element={<Navigate to="/app/lane-strategy" replace />} />
              
              <Route path="settings" element={<Settings />} />
            </Route>
            
            {/* Legacy dashboard routes - redirect to new app */}
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/dashboard/*" element={<Navigate to="/app/dashboard" replace />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
