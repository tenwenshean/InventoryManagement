// app.tsx
import { Route, Switch, useLocation, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { auth } from "@/lib/firebaseClient";
import { CartProvider } from "@/contexts/CartContext";

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
import Orders from "@/pages/orders";
import CustomerPortal from "@/pages/customer";
import CustomerProfile from "@/pages/customer-profile";
import ShopPage from "@/pages/shop";
import ShopDetailsPage from "@/pages/shop-details";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";

// Optional: you can wrap all authenticated routes with a layout (with sidebar)
import Sidebar from "@/components/sidebar";

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();

  // Check if current route is customer portal
  const isCustomerPortal = location === "/customer" || location === "/customer-profile" || location === "/shop" || location.startsWith("/shop/") || location === "/cart" || location === "/checkout";
  
  // Check if current route is enterprise dashboard
  const isEnterpriseDashboard = [
    "/dashboard",
    "/inventory", 
    "/products",
    "/accounting",
    "/qr-codes",
    "/reports",
    "/settings",
    "/scan",
    "/orders"
  ].some(route => location.startsWith(route));

  // Track the context where user logged in (customer vs enterprise)
  useEffect(() => {
    // Don't run context checks if auth is still loading
    if (isLoading || !user) return;

    let loginContext = localStorage.getItem('loginContext');

    console.log("Context switch check:", {
      loginContext,
      hasUser: !!user,
      location,
      isCustomerPortal,
      isEnterpriseDashboard,
      providerId: user.providerData[0]?.providerId,
      isLoading
    });

    // If no login context is set but user exists, determine from provider
    if (!loginContext) {
      console.log("⚠️ No login context found, detecting from provider...");
      
      const providerId = user.providerData[0]?.providerId;
      
      if (providerId === 'google.com') {
        console.log("✅ Google provider detected - setting enterprise context");
        localStorage.setItem('loginContext', 'enterprise');
        loginContext = 'enterprise';
      } else if (providerId === 'phone') {
        console.log("✅ Phone provider detected - setting customer context");
        localStorage.setItem('loginContext', 'customer');
        loginContext = 'customer';
      } else if (providerId === 'password') {
        console.log("✅ Email/password provider detected - setting customer context");
        localStorage.setItem('loginContext', 'customer');
        loginContext = 'customer';
      } else {
        console.log("⚠️ Unknown provider:", providerId, "- allowing access");
        // Don't set context for unknown providers, allow them to access any area
        return;
      }
    }

    // Only enforce context separation if explicitly trying to access wrong area
    // Add a delay to prevent logout during initial page load/refresh
    const timeoutId = setTimeout(() => {
      // Redirect root path based on login context
      if (location === "/") {
        if (loginContext === 'customer') {
          console.log("✅ Customer user at root - redirecting to /customer");
          setLocation("/customer");
        } else if (loginContext === 'enterprise') {
          console.log("✅ Enterprise user at root - redirecting to /dashboard");
          setLocation("/dashboard");
        }
        return;
      }

      // If accessing enterprise dashboard but logged in as customer
      if (isEnterpriseDashboard && loginContext === 'customer') {
        console.log("🚫 Customer trying to access enterprise - redirecting");
        setLocation("/customer");
        return;
      }

      // If accessing customer portal but logged in as enterprise
      // Don't allow enterprise users to access customer-specific pages
      if (isCustomerPortal && loginContext === 'enterprise') {
        console.log("🚫 Enterprise user trying to access customer portal - redirecting");
        setLocation("/dashboard");
        return;
      }
    }, 100); // Small delay to let auth state stabilize after refresh

    return () => clearTimeout(timeoutId);
  }, [user, location, isCustomerPortal, isEnterpriseDashboard, logout, setLocation, isLoading]);

  return (
    <div className="flex">
      {!isCustomerPortal && <Sidebar />}
      <main className={isCustomerPortal ? "flex-1" : "flex-1 ml-64 p-6"}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/customer" component={CustomerPortal} />
          <Route path="/customer-profile" component={CustomerProfile} />
          <Route path="/shop/:shopSlug" component={ShopDetailsPage} />
          <Route path="/shop" component={ShopPage} />
          <Route path="/cart" component={CartPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/scan/:code" component={ScanPage} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/products" component={Products} />
          <Route path="/accounting" component={Accounting} />
          <Route path="/orders" component={Orders} />
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
      "/orders",
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
      <Route path="/customer-profile" component={CustomerProfile} />
      <Route path="/shop/:shopSlug" component={ShopDetailsPage} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
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
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}