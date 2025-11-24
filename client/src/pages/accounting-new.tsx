import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Printer, Plus, Calendar, Download, Trash2 } from "lucide-react";
import type { AccountingEntry } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function AccountingNew() {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);
  const [openDialog, setOpenDialog] = useState(false);
  const balanceSheetRef = useRef<HTMLDivElement>(null);
  const [entryToDelete, setEntryToDelete] = useState<AccountingEntry | null>(null);
  const [hasResolvedMonth, setHasResolvedMonth] = useState(false);
  const [companyName, setCompanyName] = useState("Your Company Name");

  // Load company name from settings
  useEffect(() => {
    if (user?.uid) {
      const savedSettings = localStorage.getItem(`settings_${user.uid}`);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setCompanyName(settings.companyName || "Your Company Name");
      }
    }
  }, [user]);

  // Form state for new entry
  const [newEntry, setNewEntry] = useState({
    accountType: "expense" as "asset" | "liability" | "equity" | "revenue" | "expense",
    accountName: "",
    debitAmount: "",
    creditAmount: "",
    description: "",
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "Please log in to continue",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch entries
  const { data: entries, isLoading: entriesLoading, error } = useQuery<AccountingEntry[]>({
    queryKey: queryKeys.accounting.entries(selectedMonth),
    queryFn: async () => {
      const month = selectedMonth!;
      console.log('[accounting-new] Fetching entries for month:', month, 'user:', user?.uid);
      const res = await apiRequest("GET", `/api/accounting/entries?month=${encodeURIComponent(month)}`);
      if (!res.ok) throw new Error("Failed to load accounting entries");
      const data = await res.json();
      console.log('[accounting-new] Received', data.length, 'entries');
      if (data.length > 0) {
        console.log('[accounting-new] Sample entries:');
        data.slice(0, 3).forEach((e: any) => {
          console.log('  - Entry ID:', e.id, '| Entry userId:', e.userId, '| My userId:', user?.uid, '| Match:', e.userId === user?.uid, '| Account:', e.accountName);
        });
      }
      
      // SAFETY FILTER: Only return entries that belong to current user
      const filteredData = data.filter((e: any) => e.userId === user?.uid);
      if (filteredData.length !== data.length) {
        console.warn('[accounting-new] FILTERED OUT', data.length - filteredData.length, 'entries that did not belong to current user!');
        console.warn('[accounting-new] This indicates a backend filtering issue that needs to be fixed.');
      }
      
      return filteredData;
    },
    enabled: isAuthenticated && hasResolvedMonth && Boolean(selectedMonth),
  });

  const { data: allEntries, isLoading: allEntriesLoading } = useQuery<AccountingEntry[]>({
    queryKey: queryKeys.accounting.entriesRoot,
    queryFn: async () => {
      console.log("[accounting-new] Fetching all entries for user:", user?.uid);
      const res = await apiRequest("GET", "/api/accounting/entries?limit=500");
      if (!res.ok) throw new Error("Failed to load accounting history");
      const data = await res.json();
      console.log("[accounting-new] All entries loaded:", data.length);
      
      // SAFETY FILTER: Only return entries that belong to current user
      const filteredData = data.filter((e: any) => e.userId === user?.uid);
      if (filteredData.length !== data.length) {
        console.warn('[accounting-new] FILTERED OUT', data.length - filteredData.length, 'entries from allEntries that did not belong to current user!');
      }
      
      return filteredData;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 30,
  });

  // Fetch sales data (from products sold)
  const { data: salesData } = useQuery({
    queryKey: ["/api/accounting/sales-summary", selectedMonth],
    queryFn: async () => {
      const month = selectedMonth!;
      const res = await apiRequest("GET", `/api/accounting/sales-summary?month=${month}`);
      if (!res.ok) throw new Error("Failed to load sales data");
      return res.json();
    },
    enabled: isAuthenticated && hasResolvedMonth && Boolean(selectedMonth),
  });

  // Create entry mutation
  const createEntryMutation = useMutation({
    mutationFn: async (data: typeof newEntry) => {
      const res = await apiRequest("POST", "/api/accounting/entries", data);
      if (!res.ok) throw new Error("Failed to create entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.entriesRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.entries(selectedMonth) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.reportRoot });
      setOpenDialog(false);
      setNewEntry({
        accountType: "expense",
        accountName: "",
        debitAmount: "",
        creditAmount: "",
        description: "",
      });
      toast({
        title: "Success",
        description: "Accounting entry created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create entry",
        variant: "destructive",
      });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/accounting/entries/${id}`);
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.entriesRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.entries(selectedMonth) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.reportRoot });
      toast({
        title: "Entry deleted",
        description: "The journal entry has been removed",
      });
      setEntryToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete",
        description: error instanceof Error ? error.message : "Could not delete this entry",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "Session expired. Please log in again.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [error, toast]);

  const getEntryMonth = (createdAt: any): string | null => {
    if (!createdAt) return null;
    try {
      if (createdAt instanceof Date) {
        return createdAt.toISOString().slice(0, 7);
      }
      if ((createdAt as any)?.toDate) {
        return (createdAt as any).toDate().toISOString().slice(0, 7);
      }
      const parsed = new Date(createdAt as any);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().slice(0, 7);
    } catch (error) {
      console.error("Error parsing entry month", createdAt, error);
      return null;
    }
  };

  const monthlyEntries = useMemo(() => {
    if (!entries || !selectedMonth) return [] as AccountingEntry[];
    return entries.filter((entry) => getEntryMonth(entry.createdAt) === selectedMonth);
  }, [entries, selectedMonth]);

  const availableMonths = useMemo(() => {
    console.log("Computing available months from allEntries:", allEntries);
    if (!allEntries) return [] as string[];
    const unique = new Set<string>();
    for (const entry of allEntries) {
      console.log("Processing entry:", entry.id, entry.createdAt);
      const month = getEntryMonth(entry.createdAt);
      console.log("Parsed month:", month);
      if (month) unique.add(month);
    }
    const months = Array.from(unique).sort().reverse();
    console.log("Available months:", months);
    return months;
  }, [allEntries]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Wait for allEntries to finish loading before resolving month
    if (allEntriesLoading) {
      console.log("Still loading entries...");
      return;
    }

    console.log("Month resolution check:", { hasResolvedMonth, availableMonths: availableMonths.length, selectedMonth });

    if (!hasResolvedMonth) {
      if (availableMonths.length > 0) {
        console.log("Setting month to latest available:", availableMonths[0]);
        setSelectedMonth(availableMonths[0]);
        setHasResolvedMonth(true);
        return;
      }

      // No entries exist yet, default to current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      console.log("No entries, defaulting to current month:", currentMonth);
      setSelectedMonth(currentMonth);
      setHasResolvedMonth(true);
      return;
    }

    // If month becomes invalid (e.g., entry deleted), switch to available month
    if (availableMonths.length > 0 && selectedMonth && !availableMonths.includes(selectedMonth)) {
      console.log("Selected month not available, switching to:", availableMonths[0]);
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, hasResolvedMonth, isAuthenticated, selectedMonth, allEntriesLoading]);

  const financials = useMemo(() => {
    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];
    const revenue: any[] = [];
    const expenses: any[] = [];

    monthlyEntries.forEach(entry => {
      const debit = parseFloat(entry.debitAmount || "0");
      const credit = parseFloat(entry.creditAmount || "0");
      const item = {
        name: entry.accountName,
        debit,
        credit,
        balance: debit - credit,
        description: entry.description,
      };

      switch (entry.accountType) {
        case "asset": assets.push(item); break;
        case "liability": liabilities.push(item); break;
        case "equity": equity.push(item); break;
        case "revenue": revenue.push(item); break;
        case "expense": expenses.push(item); break;
      }
    });

    if (salesData && salesData.totalRevenue > 0) {
      revenue.push({
        name: "Product Sales",
        debit: 0,
        credit: salesData.totalRevenue,
        balance: salesData.totalRevenue,
        description: `Sales from ${salesData.unitsSold} units sold`,
      });
    }

    if (salesData && salesData.totalCOGS > 0) {
      expenses.push({
        name: "Cost of Goods Sold",
        debit: salesData.totalCOGS,
        credit: 0,
        balance: salesData.totalCOGS,
        description: "Cost of products sold",
      });
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
    const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      assets,
      liabilities,
      equity,
      revenue,
      expenses,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenue,
      totalExpenses,
      netIncome,
    };
  }, [monthlyEntries, salesData]);

  console.log("Component state:", { 
    isLoading, 
    isAuthenticated, 
    allEntriesLoading, 
    hasResolvedMonth, 
    selectedMonth,
    allEntriesCount: allEntries?.length 
  });

  if (isLoading || !isAuthenticated) {
    console.log("Auth loading state:", { isLoading, isAuthenticated });
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (allEntriesLoading || !hasResolvedMonth || !selectedMonth) {
    console.log("Month resolution state:", { allEntriesLoading, hasResolvedMonth, selectedMonth });
    return <div className="flex items-center justify-center min-h-screen">Preparing statements...</div>;
  }

  const activeMonth = selectedMonth as string;

  const handlePrint = () => {
    if (!balanceSheetRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    
    const styles = `
      <style>
        @page { size: A4; margin: 20mm; }
        body { 
          font-family: 'Times New Roman', serif; 
          font-size: 12pt; 
          color: #000;
          margin: 0;
          padding: 20px;
        }
        .header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 18pt; font-weight: bold; text-transform: uppercase; }
        .statement-title { font-size: 14pt; font-weight: bold; margin: 10px 0; }
        .date { font-size: 11pt; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { font-weight: bold; background: #f5f5f5; }
        .amount { text-align: right; font-family: 'Courier New', monospace; }
        .total-row { font-weight: bold; border-top: 2px solid #000; border-bottom: 3px double #000; }
        .section-title { font-weight: bold; font-size: 13pt; margin-top: 20px; }
        .indent { padding-left: 30px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    `;

    w.document.write(`<!DOCTYPE html><html><head><title>Financial Statements</title>${styles}</head><body>`);
    w.document.write(balanceSheetRef.current.innerHTML);
    w.document.write("</body></html>");
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleDownloadLog = () => {
    if (!monthlyEntries.length) {
      toast({
        title: "No entries available",
        description: "Add entries for this month before exporting",
      });
      return;
    }

    const rows = monthlyEntries.map((entry) => [
      new Date(entry.createdAt as any).toLocaleDateString(),
      entry.accountName,
      entry.accountType,
      parseFloat(entry.debitAmount || "0").toFixed(2),
      parseFloat(entry.creditAmount || "0").toFixed(2),
      entry.description ?? "",
    ]);

    const header = ["Date", "Account", "Type", "Debit", "Credit", "Description"];
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const safe = `${value ?? ""}`.replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeMonth = activeMonth || "current-period";
    link.download = `journal-log-${safeMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEntryMutation.mutate(newEntry);
  };

  const monthName = new Date(`${activeMonth}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen space-y-8">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Statements</h1>
          <p className="text-muted-foreground">Professional accounting and financial reporting</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus size={16} />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Accounting Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select
                      value={newEntry.accountType}
                      onValueChange={(value: any) => setNewEntry({ ...newEntry, accountType: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asset">Asset</SelectItem>
                        <SelectItem value="liability">Liability</SelectItem>
                        <SelectItem value="equity">Equity</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name</Label>
                    <Input
                      value={newEntry.accountName}
                      onChange={(e) => setNewEntry({ ...newEntry, accountName: e.target.value })}
                      placeholder="e.g., Office Supplies"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Debit Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newEntry.debitAmount}
                      onChange={(e) => setNewEntry({ ...newEntry, debitAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Credit Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newEntry.creditAmount}
                      onChange={(e) => setNewEntry({ ...newEntry, creditAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newEntry.description || ""}
                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEntryMutation.isPending}>
                    {createEntryMutation.isPending ? "Creating..." : "Create Entry"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleDownloadLog}>
            <Download size={16} />
            Download Log
          </Button>
          <Button variant="outline" className="flex items-center gap-2" onClick={handlePrint}>
            <Printer size={16} />
            Print
          </Button>
        </div>
      </header>

      <div className="mb-4 space-y-2">
        <Label className="flex items-center gap-2">
          <Calendar size={16} />
          Select Month
        </Label>
        <Input
          type="month"
          value={activeMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="max-w-xs"
        />
        {availableMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Quick choose:</span>
            {availableMonths.slice(0, 6).map((month) => (
              <Button
                key={month}
                type="button"
                size="sm"
                variant={month === activeMonth ? "default" : "outline"}
                onClick={() => setSelectedMonth(month)}
              >
                {new Date(`${month}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </Button>
            ))}
          </div>
        )}
        {availableMonths.length > 0 && !availableMonths.includes(activeMonth) && (
          <p className="text-sm text-muted-foreground">
            No entries recorded for this month yet. Try selecting one of the months with data above.
          </p>
        )}
        {availableMonths.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add your first journal entry to start building monthly statements.
          </p>
        )}
      </div>

      <Tabs defaultValue="balance-sheet" className="space-y-4">
        <TabsList>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="entries">Journal Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet">
          <Card className="bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold">Balance Sheet Overview</CardTitle>
              <p className="text-sm text-muted-foreground">As of {monthName}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-emerald-50 p-4 dark:bg-emerald-500/10">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total Assets</p>
                  <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(financials.totalAssets)}
                  </p>
                </div>
                <div className="rounded-lg border bg-sky-50 p-4 dark:bg-sky-500/10">
                  <p className="text-sm font-medium text-sky-800 dark:text-sky-200">Liabilities &amp; Equity</p>
                  <p className="text-2xl font-semibold text-sky-600 dark:text-sky-300">
                    {formatCurrency(financials.totalLiabilities + financials.totalEquity + financials.netIncome)}
                  </p>
                </div>
                <div className="rounded-lg border bg-purple-50 p-4 dark:bg-purple-500/10">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Net Worth</p>
                  <p className="text-2xl font-semibold text-purple-600 dark:text-purple-300">
                    {formatCurrency(financials.totalAssets - financials.totalLiabilities)}
                  </p>
                </div>
              </div>

              <div ref={balanceSheetRef} className="space-y-8 rounded-xl border bg-background/60 p-6">
                <div className="header text-center">
                  <div className="company-name text-lg font-semibold tracking-wide">{companyName}</div>
                  <div className="statement-title text-2xl font-bold">BALANCE SHEET</div>
                  <div className="date text-sm text-muted-foreground">As of {monthName}</div>
                </div>

                <div className="section-title text-lg font-semibold">ASSETS</div>
                <table className="w-full text-sm">
                  <tbody>
                    {financials.assets.map((asset, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="indent py-2">{asset.name}</td>
                        <td className="amount py-2 font-medium">${asset.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                    {financials.assets.length === 0 && (
                      <tr>
                        <td className="indent py-2 text-muted-foreground">No assets recorded</td>
                        <td></td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td className="py-2">Total Assets</td>
                      <td className="amount py-2">{formatCurrency(financials.totalAssets)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-title text-lg font-semibold">LIABILITIES AND EQUITY</div>
                <div className="text-sm font-semibold text-muted-foreground">Liabilities</div>
                <table className="w-full text-sm">
                  <tbody>
                    {financials.liabilities.map((liability, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="indent py-2">{liability.name}</td>
                        <td className="amount py-2 font-medium">${liability.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                    {financials.liabilities.length === 0 && (
                      <tr>
                        <td className="indent py-2 text-muted-foreground">No liabilities recorded</td>
                        <td></td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td className="py-2">Total Liabilities</td>
                      <td className="amount py-2">{formatCurrency(financials.totalLiabilities)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-sm font-semibold text-muted-foreground">Equity</div>
                <table className="w-full text-sm">
                  <tbody>
                    {financials.equity.map((eq, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="indent py-2">{eq.name}</td>
                        <td className="amount py-2 font-medium">{formatCurrency(eq.balance)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="indent py-2">Retained Earnings (Net Income)</td>
                      <td className="amount py-2 font-medium">{formatCurrency(financials.netIncome)}</td>
                    </tr>
                    <tr className="total-row">
                      <td className="py-2">Total Equity</td>
                      <td className="amount py-2">{formatCurrency(financials.totalEquity + financials.netIncome)}</td>
                    </tr>
                    <tr className="total-row" style={{ borderTop: "3px double #000" }}>
                      <td className="py-2">Total Liabilities and Equity</td>
                      <td className="amount py-2">
                        {formatCurrency(financials.totalLiabilities + financials.totalEquity + financials.netIncome)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income-statement">
          <Card className="bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold">Income Statement</CardTitle>
              <p className="text-sm text-muted-foreground">For the month ended {monthName}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-emerald-50 p-4 dark:bg-emerald-500/10">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total Revenue</p>
                  <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(financials.totalRevenue)}
                  </p>
                </div>
                <div className="rounded-lg border bg-rose-50 p-4 dark:bg-rose-500/10">
                  <p className="text-sm font-medium text-rose-800 dark:text-rose-200">Total Expenses</p>
                  <p className="text-2xl font-semibold text-rose-600 dark:text-rose-300">
                    {formatCurrency(financials.totalExpenses)}
                  </p>
                </div>
                <div className="rounded-lg border bg-purple-50 p-4 dark:bg-purple-500/10">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Net Income</p>
                  <p
                    className={`text-2xl font-semibold ${
                      financials.netIncome >= 0
                        ? "text-purple-600 dark:text-purple-300"
                        : "text-rose-600 dark:text-rose-300"
                    }`}
                  >
                    {formatCurrency(financials.netIncome)}
                  </p>
                </div>
              </div>

              <div className="space-y-8 rounded-xl border bg-background/60 p-6">
                <div className="header text-center">
                  <div className="company-name text-lg font-semibold tracking-wide">{companyName}</div>
                  <div className="statement-title text-2xl font-bold">INCOME STATEMENT</div>
                  <div className="date text-sm text-muted-foreground">For the month ended {monthName}</div>
                </div>

                <div className="section-title text-lg font-semibold">REVENUE</div>
                <table className="w-full text-sm">
                  <tbody>
                    {financials.revenue.map((rev, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="indent py-2">{rev.name}</td>
                        <td className="amount py-2 font-medium">{formatCurrency(rev.balance)}</td>
                      </tr>
                    ))}
                    {financials.revenue.length === 0 && (
                      <tr>
                        <td className="indent py-2 text-muted-foreground">No revenue recorded</td>
                        <td></td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td className="py-2">Total Revenue</td>
                      <td className="amount py-2">{formatCurrency(financials.totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-title text-lg font-semibold">EXPENSES</div>
                <table className="w-full text-sm">
                  <tbody>
                    {financials.expenses.map((exp, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="indent py-2">{exp.name}</td>
                        <td className="amount py-2 font-medium">{formatCurrency(exp.balance)}</td>
                      </tr>
                    ))}
                    {financials.expenses.length === 0 && (
                      <tr>
                        <td className="indent py-2 text-muted-foreground">No expenses recorded</td>
                        <td></td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td className="py-2">Total Expenses</td>
                      <td className="amount py-2">{formatCurrency(financials.totalExpenses)}</td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full text-sm">
                  <tbody>
                    <tr
                      className="total-row"
                      style={{
                        borderTop: "3px double #000",
                        backgroundColor: financials.netIncome >= 0 ? "#d4edda" : "#f8d7da",
                      }}
                    >
                      <td className="py-2">Net Income {financials.netIncome >= 0 ? "(Profit)" : "(Loss)"}</td>
                      <td className="amount py-2">${financials.netIncome.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Journal Entries - {monthName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {monthlyEntries.length} {monthlyEntries.length === 1 ? "entry" : "entries"} in this period
                  </p>
                </div>
                <Badge variant="outline" className="uppercase tracking-wide">
                  {activeMonth}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="text-center py-8">Loading entries...</div>
              ) : monthlyEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Account</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-right p-3 font-medium">Debit</th>
                        <th className="text-right p-3 font-medium">Credit</th>
                        <th className="text-left p-3 font-medium">Description</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyEntries.map((entry) => (
                        <tr key={entry.id} className="border-t border-border/60 hover:bg-muted/40">
                          <td className="p-3">{new Date(entry.createdAt as any).toLocaleDateString()}</td>
                          <td className="p-3 font-medium">{entry.accountName}</td>
                          <td className="p-3">
                            <Badge variant="secondary" className="capitalize">
                              {entry.accountType}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono">
                            {parseFloat(entry.debitAmount || "0") > 0
                              ? formatCurrency(parseFloat(entry.debitAmount!))
                              : "-"}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {parseFloat(entry.creditAmount || "0") > 0
                              ? formatCurrency(parseFloat(entry.creditAmount!))
                              : "-"}
                          </td>
                          <td className="p-3 text-muted-foreground">{entry.description || "-"}</td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setEntryToDelete(entry)}
                              disabled={deleteEntryMutation.isPending && entryToDelete?.id === entry.id}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No entries for this month. Click "New Entry" to add one.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!entryToDelete} onOpenChange={(open) => !open && setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete journal entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove{" "}
              {entryToDelete
                ? `"${entryToDelete.accountName}" dated ${new Date(entryToDelete.createdAt as any).toLocaleDateString()}`
                : "this entry"}
              . You can re-create it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEntryMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => entryToDelete && deleteEntryMutation.mutate(entryToDelete.id)}
              disabled={deleteEntryMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEntryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
