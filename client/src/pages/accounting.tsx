import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Calculator, Printer, RefreshCw } from "lucide-react";
import type { AccountingEntry } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Accounting() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

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
    queryKey: queryKeys.accounting.entries(selectedMonth),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/accounting/entries?month=${encodeURIComponent(selectedMonth)}`);
      if (!res.ok) throw new Error("Failed to load accounting entries");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // Data stays fresh for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnMount: false, // Don't refetch on mount if data is still fresh
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: true,
  });

  const { data: report, isLoading: reportLoading, isFetching } = useQuery({
    queryKey: queryKeys.accounting.report(selectedMonth),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/accounting/report?month=${encodeURIComponent(selectedMonth)}`);
      if (!res.ok) throw new Error("Failed to load accounting report");
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // Data stays fresh for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnMount: false, // Don't refetch on mount if data is still fresh
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: true,
  });

  const reportRef = useRef<HTMLDivElement | null>(null);

  const handlePrintReport = () => {
    if (!reportRef.current) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    const styles = `
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 40px; color: #111; }
        h1 { text-align: center; margin-bottom: 10px; }
        h2 { margin-top: 30px; margin-bottom: 15px; font-size: 18px; }
        h3 { margin-top: 20px; margin-bottom: 10px; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f7f7f7; font-weight: 600; }
        .totals-row { font-weight: bold; background: #f9f9f9; }
        .text-right { text-align: right; }
        @media print {
          body { padding: 20px; }
          h1 { font-size: 24px; }
        }
      </style>
    `;
    w.document.write(`<!doctype html><html><head><title>Balance Sheet - ${new Date().toLocaleDateString()}</title>${styles}</head><body>`);
    w.document.write(`<h1>Balance Sheet & Accounting Report</h1>`);
    w.document.write(`<p style="text-align:center; color:#666; margin-bottom:30px;">Generated on ${new Date().toLocaleString()}</p>`);
    w.document.write(reportRef.current.innerHTML);
    w.document.write("</body></html>");
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

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

  const { totalDebits, totalCredits, balance } = useMemo(() => {
    if (!entries) return { totalDebits: 0, totalCredits: 0, balance: 0 };

    const totals = entries.reduce(
      (acc, entry) => {
        const debit = parseFloat(entry.debitAmount || "0");
        const credit = parseFloat(entry.creditAmount || "0");
        acc.totalDebits += debit;
        acc.totalCredits += credit;
        return acc;
      },
      { totalDebits: 0, totalCredits: 0 },
    );

    return { ...totals, balance: totals.totalDebits - totals.totalCredits };
  }, [entries]);

  const monthLabel = useMemo(() => {
    try {
      return new Date(`${selectedMonth}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

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

        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            Reporting Month
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="ml-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Debits ({monthLabel})</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Total Credits ({monthLabel})</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Net Balance ({monthLabel})</p>
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

        {/* Balance Sheet / Inventory Report */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <DollarSign size={20} />
                <span>Balance Sheet & Inventory Report</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  data-testid="button-refresh-report"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePrintReport}
                  data-testid="button-print-report"
                >
                  <Printer size={16} className="mr-2" />
                  Print Report
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={reportRef}>
              {reportLoading && !report ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <div className="text-muted-foreground">Loading balance sheet...</div>
                  <p className="text-sm text-muted-foreground mt-2">Please wait, fetching your data...</p>
                </div>
              ) : report ? (
                <div>
                  {isFetching && (
                    <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 flex items-center">
                      <RefreshCw size={14} className="mr-2 animate-spin" />
                      Updating data in background...
                    </div>
                  )}
                  {/* Inventory Summary (Unsold) */}
                  <h3 className="text-base font-semibold mb-3">Current Inventory (Unsold)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-border">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left text-sm font-medium">Product</th>
                          <th className="p-3 text-left text-sm font-medium">SKU</th>
                          <th className="p-3 text-right text-sm font-medium">Quantity</th>
                          <th className="p-3 text-right text-sm font-medium">Cost Price</th>
                          <th className="p-3 text-right text-sm font-medium">Inventory Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.inventorySummary && report.inventorySummary.length > 0 ? (
                          <>
                            {report.inventorySummary.map((item: any) => (
                              <tr key={item.productId} className="border-t border-border">
                                <td className="p-3">{item.name}</td>
                                <td className="p-3 font-mono text-sm">{item.sku}</td>
                                <td className="p-3 text-right">{item.quantity}</td>
                                <td className="p-3 text-right">${(item.costPrice || 0).toFixed(2)}</td>
                                <td className="p-3 text-right font-medium">${(item.inventoryValue || 0).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-border bg-muted/50">
                              <td colSpan={4} className="p-3 text-right font-semibold">Total Inventory Value</td>
                              <td className="p-3 text-right font-bold text-lg">${(report.totals.totalInventoryValue || 0).toFixed(2)}</td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-muted-foreground">
                              No inventory items found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Sold Summary */}
                  <h3 className="text-base font-semibold mt-8 mb-3">
                    Sales Summary ({monthLabel})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-border">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left text-sm font-medium">Product</th>
                          <th className="p-3 text-left text-sm font-medium">SKU</th>
                          <th className="p-3 text-right text-sm font-medium">Sold Quantity</th>
                          <th className="p-3 text-right text-sm font-medium">Revenue</th>
                          <th className="p-3 text-right text-sm font-medium">COGS</th>
                          <th className="p-3 text-right text-sm font-medium">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.soldSummary && report.soldSummary.length > 0 ? (
                          <>
                            {report.soldSummary.map((s: any) => {
                              const profit = (s.revenue || 0) - (s.cogs || 0);
                              return (
                                <tr key={s.productId} className="border-t border-border">
                                  <td className="p-3">{s.name}</td>
                                  <td className="p-3 font-mono text-sm">{s.sku}</td>
                                  <td className="p-3 text-right">{s.soldQuantity}</td>
                                  <td className="p-3 text-right">${(s.revenue || 0).toFixed(2)}</td>
                                  <td className="p-3 text-right">${(s.cogs || 0).toFixed(2)}</td>
                                  <td className={`p-3 text-right font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ${profit.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-border bg-muted/50">
                              <td colSpan={3} className="p-3 text-right font-semibold">Totals</td>
                              <td className="p-3 text-right font-semibold">${(report.totals.totalRevenue || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-semibold">${(report.totals.totalCOGS || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-bold text-lg text-green-600">
                                ${(report.totals.grossProfit || 0).toFixed(2)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-muted-foreground">
                              No sales recorded yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="p-4 border border-border rounded-lg bg-blue-50">
                      <p className="text-sm text-muted-foreground mb-1">Total Inventory Value</p>
                      <p className="text-xl font-bold text-blue-600">
                        ${(report.totals.totalInventoryValue || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg bg-green-50">
                      <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                      <p className="text-xl font-bold text-green-600">
                        ${(report.totals.totalRevenue || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg bg-purple-50">
                      <p className="text-sm text-muted-foreground mb-1">Gross Profit</p>
                      <p className="text-xl font-bold text-purple-600">
                        ${(report.totals.grossProfit || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calculator className="mx-auto text-muted-foreground mb-4" size={48} />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No report data available</h3>
                  <p className="text-muted-foreground">Report data will appear here once products and transactions are available.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                          {(((entry.createdAt as any)?.toDate ? (entry.createdAt as any).toDate() : entry.createdAt ? new Date(entry.createdAt as any) : null)?.toLocaleDateString()) ?? '-'}
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
