import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import InventoryTable from "@/components/inventory-table";

export default function Inventory() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Inventory Management
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Manage your complete inventory and stock levels
          </p>
        </header>

        <InventoryTable showAll={true} />
      </main>
    </div>
  );
}
