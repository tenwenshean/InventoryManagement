import { Package, Home, Box, Calculator, BarChart3, QrCode, Settings, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import type { User as UserType } from "@shared/schema";

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth() as { user?: UserType };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Inventory", href: "/inventory", icon: Box },
    { name: "Products", href: "/products", icon: Package },
    { name: "Accounting", href: "/accounting", icon: Calculator },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "QR Codes", href: "/qr-codes", icon: QrCode },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen fixed left-0 top-0 z-10">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="bg-primary rounded-lg p-2">
            <Package className="text-primary-foreground" size={20} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground" data-testid="text-app-title">
              InventoryPro
            </h2>
            <p className="text-xs text-muted-foreground">Enterprise Edition</p>
          </div>
        </div>
      </div>

      <nav className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <button
                  onClick={() => setLocation(item.href)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="text-primary-foreground text-sm" size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || "User"}
              </p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors justify-start p-0"
            data-testid="button-logout"
          >
            <LogOut className="mr-2" size={14} />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
