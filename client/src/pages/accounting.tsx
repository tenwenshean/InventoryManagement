import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Calculator } from "lucide-react";
import type { AccountingEntry } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Accounting() {
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

  const { data: entries, isLoading: entriesLoading, error } = useQuery<AccountingEntry[]>({
    queryKey: ["/api/accounting/entries"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [error, toast]);

  if (isLoading || !isAuthenticated) {
    return <div>Loading...</div>;
  }

  const calculateTotals = () => {
    if (!entries) return { totalDebits: 0, totalCredits: 0, balance: 0 };
    
    const totalDebits = entries.reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0);
    const totalCredits = entries.reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0);
    const balance = totalDebits - totalCredits;
    
    return { totalDebits, totalCredits, balance };
  };

  const { totalDebits, totalCredits, balance } = calculateTotals();

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Accounting
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Track financial transactions and inventory valuations
          </p>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Debits</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-debits">
                    ${totalDebits.toLocaleString()}
                  </p>
                </div>
                <div className="bg-chart-1/10 p-3 rounded-lg">
                  <TrendingUp className="text-chart-1" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Credits</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-credits">
                    ${totalCredits.toLocaleString()}
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <TrendingDown className="text-primary" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Net Balance</p>
                  <p className={`text-2xl font-bold ${balance >= 0 ? 'text-chart-2' : 'text-primary'}`} data-testid="text-net-balance">
                    ${Math.abs(balance).toLocaleString()}
                  </p>
                </div>
                <div className="bg-chart-2/10 p-3 rounded-lg">
                  <DollarSign className="text-chart-2" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounting Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calculator size={20} />
              <span>Accounting Entries</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entriesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading entries...</div>
              </div>
            ) : entries && entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Account Type</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Account Name</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Debit</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Credit</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-border hover:bg-muted/50 transition-colors" data-testid={`row-entry-${entry.id}`}>
                        <td className="p-4 text-foreground text-sm" data-testid={`text-entry-date-${entry.id}`}>
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4" data-testid={`badge-entry-type-${entry.id}`}>
                          <Badge variant="outline" className="capitalize">
                            {entry.accountType}
                          </Badge>
                        </td>
                        <td className="p-4 text-foreground font-medium" data-testid={`text-entry-account-${entry.id}`}>
                          {entry.accountName}
                        </td>
                        <td className="p-4 text-foreground" data-testid={`text-entry-debit-${entry.id}`}>
                          {parseFloat(entry.debitAmount || "0") > 0 ? `$${parseFloat(entry.debitAmount || "0").toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4 text-foreground" data-testid={`text-entry-credit-${entry.id}`}>
                          {parseFloat(entry.creditAmount || "0") > 0 ? `$${parseFloat(entry.creditAmount || "0").toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4 text-muted-foreground" data-testid={`text-entry-description-${entry.id}`}>
                          {entry.description || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calculator className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-lg font-semibold text-foreground mb-2">No accounting entries found</h3>
                <p className="text-muted-foreground">
                  Accounting entries will appear here as inventory transactions are processed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
