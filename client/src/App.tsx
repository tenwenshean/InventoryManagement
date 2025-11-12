// app.tsx
import { Route, Switch, useLocation, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { auth } from "@/lib/firebaseClient";

// Pages
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Products from "@/pages/products";
import Accounting from "@/pages/accounting-new";
import QRCodes from "@/pages/qr-codes";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import ScanPage from "@/pages/scan";
import CustomerPortal from "@/pages/customer";
import ShopPage from "@/pages/shop";

// Optional: you can wrap all authenticated routes with a layout (with sidebar)
import Sidebar from "@/components/sidebar";

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();

  // Check if current route is customer portal
  const isCustomerPortal = location === "/customer" || location === "/shop";
  
  // Check if current route is enterprise dashboard
  const isEnterpriseDashboard = [
    "/dashboard",
    "/inventory", 
    "/products",
    "/accounting",
    "/qr-codes",
    "/reports",
    "/settings",
    "/scan"
  ].some(route => location.startsWith(route));

  // Force logout enterprise users when they access customer routes
  useEffect(() => {
    const handleCustomerPortalAccess = async () => {
      if (isCustomerPortal) {
        const user = auth.currentUser;
        if (user) {
          // Check if user is enterprise (Google or Email login)
          const isEnterpriseUser = user.providerData.some(
            (provider: any) => provider.providerId === 'google.com'
          ) || (user.email && !user.phoneNumber);

          if (isEnterpriseUser) {
            console.log("Enterprise user accessing customer portal - forcing logout");
            await logout();
          }
        }
      }
    };

    handleCustomerPortalAccess();
  }, [location, isCustomerPortal, logout]);

  // Force logout phone users (customers) when they access enterprise routes
  useEffect(() => {
    const handleEnterpriseDashboardAccess = async () => {
      if (isEnterpriseDashboard) {
        const user = auth.currentUser;
        if (user) {
          // Check if user is phone-only (customer account)
          const isPhoneUser = user.phoneNumber && user.providerData.some(
            (provider: any) => provider.providerId === 'phone'
          );
          const hasGoogleAuth = user.providerData.some(
            (provider: any) => provider.providerId === 'google.com'
          );
          
          // If phone user without Google auth, they're a customer - log them out
          if (isPhoneUser && !hasGoogleAuth) {
            console.log("Customer account detected on enterprise dashboard - logging out");
            await logout();
            setLocation("/");
          }
        }
      }
    };

    handleEnterpriseDashboardAccess();
  }, [location, isEnterpriseDashboard, logout, setLocation]);

  // Redirect root to dashboard when authenticated (but not on customer pages)
  useEffect(() => {
    if (location === "/" && !isCustomerPortal) {
      setLocation("/dashboard");
    }
  }, [location, setLocation, isCustomerPortal]);

  return (
    <div className="flex">
      {!isCustomerPortal && <Sidebar />}
      <main className={isCustomerPortal ? "flex-1" : "flex-1 ml-64 p-6"}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/customer" component={CustomerPortal} />
          <Route path="/shop" component={ShopPage} />
          <Route path="/scan/:code" component={ScanPage} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/products" component={Products} />
          <Route path="/accounting" component={Accounting} />
          <Route path="/qr-codes" component={QRCodes} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function UnauthenticatedApp() {
  const [location, setLocation] = useLocation();

  // Prevent access to authenticated routes
  useEffect(() => {
    const protectedRoutes = [
      "/dashboard",
      "/inventory",
      "/products",
      "/accounting",
      "/qr-codes",
      "/reports",
      "/settings",
    ];

    if (protectedRoutes.some((route) => location.startsWith(route))) {
      console.log("Redirecting to landing - not authenticated");
      setLocation("/");
    }
  }, [location, setLocation]);

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/customer" component={CustomerPortal} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/scan/:code" component={ScanPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Debug logging
  useEffect(() => {
    console.log("Auth State:", { isAuthenticated, isLoading, user: user?.email });
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}