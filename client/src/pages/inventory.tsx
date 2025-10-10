import { useAuth } from "@/hooks/useAuth";
import InventoryTable from "@/components/inventory-table";

export default function Inventory() {
  const { isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
          Inventory Management
        </h1>
        <p className="text-muted-foreground" data-testid="text-page-subtitle">
          Manage your complete inventory and stock levels
        </p>
      </header>

      <InventoryTable showAll={true} />
    </>
  );
}