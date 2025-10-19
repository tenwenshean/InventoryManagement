// app.tsx
import { Route, Switch, useLocation, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

// Pages
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Products from "@/pages/products";
import Accounting from "@/pages/accounting";
import QRCodes from "@/pages/qr-codes";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import ScanPage from "@/pages/scan";
import CustomerPortal from "@/pages/customer";

// Optional: you can wrap all authenticated routes with a layout (with sidebar)
import Sidebar from "@/components/sidebar";

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();

  // Redirect root to dashboard when authenticated
  useEffect(() => {
    if (location === "/") {
      setLocation("/dashboard");
    }
  }, [location, setLocation]);

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/customer" component={CustomerPortal} />
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