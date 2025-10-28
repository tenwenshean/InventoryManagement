import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Printer, Plus, Calendar } from "lucide-react";
import type { AccountingEntry } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function AccountingNew() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [openDialog, setOpenDialog] = useState(false);
  const balanceSheetRef = useRef<HTMLDivElement>(null);

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
    queryKey: queryKeys.accounting.entries,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/accounting/entries");
      if (!res.ok) throw new Error("Failed to load accounting entries");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch sales data (from products sold)
  const { data: salesData } = useQuery({
    queryKey: ["/api/accounting/sales-summary", selectedMonth],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/accounting/sales-summary?month=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to load sales data");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Create entry mutation
  const createEntryMutation = useMutation({
    mutationFn: async (data: typeof newEntry) => {
      const res = await apiRequest("POST", "/api/accounting/entries", data);
      if (!res.ok) throw new Error("Failed to create entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.entries });
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

  if (isLoading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Calculate financial statements
  const calculateFinancials = () => {
    const filteredEntries = (entries || []).filter(entry => {
      if (!entry.createdAt) return false;
      try {
        // Handle both Firestore Timestamp and Date objects
        const entryDate = entry.createdAt instanceof Date 
          ? entry.createdAt 
          : new Date(entry.createdAt as any);
        const entryMonth = entryDate.toISOString().slice(0, 7);
        return entryMonth === selectedMonth;
      } catch (e) {
        console.error("Error parsing date:", entry.createdAt, e);
        return false;
      }
    });

    // Group by account type
    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];
    const revenue: any[] = [];
    const expenses: any[] = [];

    filteredEntries.forEach(entry => {
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

    // Add sales data to revenue
    if (salesData && salesData.totalRevenue > 0) {
      revenue.push({
        name: "Product Sales",
        debit: 0,
        credit: salesData.totalRevenue,
        balance: salesData.totalRevenue,
        description: `Sales from ${salesData.unitsSold} units sold`,
      });
    }

    // Add COGS to expenses
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
  };

  const financials = calculateFinancials();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEntryMutation.mutate(newEntry);
  };

  const monthName = new Date(selectedMonth + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-6">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Statements</h1>
            <p className="text-muted-foreground">Professional accounting and financial reporting</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus size={16} className="mr-2" />
                  New Entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Accounting Entry</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Account Type</Label>
                    <Select
                      value={newEntry.accountType}
                      onValueChange={(value: any) => setNewEntry({ ...newEntry, accountType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
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
                  <div>
                    <Label>Account Name</Label>
                    <Input
                      value={newEntry.accountName}
                      onChange={(e) => setNewEntry({ ...newEntry, accountName: e.target.value })}
                      placeholder="e.g., Office Supplies"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Debit Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newEntry.debitAmount}
                        onChange={(e) => setNewEntry({ ...newEntry, debitAmount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
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
                  <div>
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
            <Button variant="outline" onClick={handlePrint}>
              <Printer size={16} className="mr-2" />
              Print
            </Button>
          </div>
        </header>

        <div className="mb-4">
          <Label className="flex items-center gap-2">
            <Calendar size={16} />
            Select Month
          </Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <Tabs defaultValue="balance-sheet" className="space-y-4">
          <TabsList>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
            <TabsTrigger value="entries">Journal Entries</TabsTrigger>
          </TabsList>

          <TabsContent value="balance-sheet">
            <Card className="bg-white">
              <CardContent className="p-8">
                <div ref={balanceSheetRef}>
                  <div className="header">
                    <div className="company-name">Your Company Name</div>
                    <div className="statement-title">BALANCE SHEET</div>
                    <div className="date">As of {monthName}</div>
                  </div>

                  <div className="section-title">ASSETS</div>
                  <table>
                    <tbody>
                      {financials.assets.map((asset, i) => (
                        <tr key={i}>
                          <td className="indent">{asset.name}</td>
                          <td className="amount">${asset.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                      {financials.assets.length === 0 && (
                        <tr><td className="indent text-muted-foreground">No assets recorded</td><td></td></tr>
                      )}
                      <tr className="total-row">
                        <td>Total Assets</td>
                        <td className="amount">${financials.totalAssets.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="section-title">LIABILITIES AND EQUITY</div>
                  <div className="section-title" style={{ fontSize: '12pt', marginTop: '10px' }}>Liabilities</div>
                  <table>
                    <tbody>
                      {financials.liabilities.map((liability, i) => (
                        <tr key={i}>
                          <td className="indent">{liability.name}</td>
                          <td className="amount">${liability.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                      {financials.liabilities.length === 0 && (
                        <tr><td className="indent text-muted-foreground">No liabilities recorded</td><td></td></tr>
                      )}
                      <tr className="total-row">
                        <td>Total Liabilities</td>
                        <td className="amount">${financials.totalLiabilities.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="section-title" style={{ fontSize: '12pt', marginTop: '20px' }}>Equity</div>
                  <table>
                    <tbody>
                      {financials.equity.map((eq, i) => (
                        <tr key={i}>
                          <td className="indent">{eq.name}</td>
                          <td className="amount">${eq.balance.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="indent">Retained Earnings (Net Income)</td>
                        <td className="amount">${financials.netIncome.toFixed(2)}</td>
                      </tr>
                      <tr className="total-row">
                        <td>Total Equity</td>
                        <td className="amount">${(financials.totalEquity + financials.netIncome).toFixed(2)}</td>
                      </tr>
                      <tr className="total-row" style={{ borderTop: '3px double #000' }}>
                        <td>Total Liabilities and Equity</td>
                        <td className="amount">${(financials.totalLiabilities + financials.totalEquity + financials.netIncome).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income-statement">
            <Card className="bg-white">
              <CardContent className="p-8">
                <div className="header">
                  <div className="company-name">Your Company Name</div>
                  <div className="statement-title">INCOME STATEMENT</div>
                  <div className="date">For the Month Ended {monthName}</div>
                </div>

                <div className="section-title">REVENUE</div>
                <table>
                  <tbody>
                    {financials.revenue.map((rev, i) => (
                      <tr key={i}>
                        <td className="indent">{rev.name}</td>
                        <td className="amount">${rev.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                    {financials.revenue.length === 0 && (
                      <tr><td className="indent text-muted-foreground">No revenue recorded</td><td></td></tr>
                    )}
                    <tr className="total-row">
                      <td>Total Revenue</td>
                      <td className="amount">${financials.totalRevenue.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-title">EXPENSES</div>
                <table>
                  <tbody>
                    {financials.expenses.map((exp, i) => (
                      <tr key={i}>
                        <td className="indent">{exp.name}</td>
                        <td className="amount">${exp.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                    {financials.expenses.length === 0 && (
                      <tr><td className="indent text-muted-foreground">No expenses recorded</td><td></td></tr>
                    )}
                    <tr className="total-row">
                      <td>Total Expenses</td>
                      <td className="amount">${financials.totalExpenses.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <table>
                  <tbody>
                    <tr className="total-row" style={{ borderTop: '3px double #000', backgroundColor: financials.netIncome >= 0 ? '#d4edda' : '#f8d7da' }}>
                      <td>Net Income {financials.netIncome >= 0 ? '(Profit)' : '(Loss)'}</td>
                      <td className="amount">${financials.netIncome.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entries">
            <Card>
              <CardHeader>
                <CardTitle>Journal Entries - {monthName}</CardTitle>
              </CardHeader>
              <CardContent>
                {entriesLoading ? (
                  <div className="text-center py-8">Loading entries...</div>
                ) : entries && entries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Account</th>
                          <th className="text-left p-3">Type</th>
                          <th className="text-right p-3">Debit</th>
                          <th className="text-right p-3">Credit</th>
                          <th className="text-left p-3">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries
                          .filter(entry => {
                            const entryDate = new Date(entry.createdAt as any);
                            return entryDate.toISOString().slice(0, 7) === selectedMonth;
                          })
                          .map((entry) => (
                            <tr key={entry.id} className="border-t">
                              <td className="p-3">
                                {new Date(entry.createdAt as any).toLocaleDateString()}
                              </td>
                              <td className="p-3 font-medium">{entry.accountName}</td>
                              <td className="p-3 capitalize">{entry.accountType}</td>
                              <td className="p-3 text-right font-mono">
                                {parseFloat(entry.debitAmount || "0") > 0 ? `$${parseFloat(entry.debitAmount!).toFixed(2)}` : "-"}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {parseFloat(entry.creditAmount || "0") > 0 ? `$${parseFloat(entry.creditAmount!).toFixed(2)}` : "-"}
                              </td>
                              <td className="p-3 text-muted-foreground">{entry.description || "-"}</td>
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
      </main>
    </div>
  );
}
