import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeftRight,
  History,
  User,
  Search,
  Package,
  Building2,
  Calendar,
} from "lucide-react";

export default function BranchTransfer() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all location history
  const { data: locationHistory = [], isLoading } = useQuery({
    queryKey: ["location-history"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/location-history");
      if (!response.ok) throw new Error("Failed to fetch location history");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Filter history based on search query
  const filteredHistory = locationHistory.filter((log: any) => {
    const query = searchQuery.toLowerCase();
    return (
      log.productName?.toLowerCase().includes(query) ||
      log.previousBranchName?.toLowerCase().includes(query) ||
      log.newBranchName?.toLowerCase().includes(query) ||
      log.staffName?.toLowerCase().includes(query) ||
      log.reason?.toLowerCase().includes(query)
    );
  });

  const getReasonDisplay = (reason: string) => {
    switch (reason) {
      case "transfer":
      case "transfer_initiated":
        return "Transferred";
      case "quick_receive":
      case "transfer_complete":
        return "Received";
      default:
        return reason || "Unknown";
    }
  };

  const getReasonVariant = (reason: string): "default" | "secondary" | "outline" => {
    switch (reason) {
      case "transfer":
      case "transfer_initiated":
        return "default";
      case "quick_receive":
      case "transfer_complete":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <History size={32} />
              Transfer History
            </CardTitle>
            <p className="text-blue-100 mt-2">
              View all product transfer activities across branches
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search by product, branch, staff, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2"
                />
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <ArrowLeftRight className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Transfers</p>
                    <p className="text-2xl font-bold text-gray-900">{locationHistory.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Filtered Results</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredHistory.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Recent Activity</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {locationHistory.slice(0, 50).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transfer History List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading transfer history...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {searchQuery ? "No matching transfers found" : "No transfer history available"}
                </p>
                {searchQuery && (
                  <p className="text-gray-400 text-sm mt-2">
                    Try adjusting your search criteria
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredHistory.map((log: any, index: number) => (
                  <div
                    key={log.id || index}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-gray-600" />
                          <span className="font-semibold text-gray-900">
                            {log.productName || "Unknown Product"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">
                            <span className="text-red-600">{log.previousBranchName || "Unknown"}</span>
                            {" → "}
                            <span className="text-green-600">{log.newBranchName || "Unknown"}</span>
                          </span>
                        </div>
                      </div>
                      <Badge variant={getReasonVariant(log.reason)}>
                        {getReasonDisplay(log.reason)}
                      </Badge>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600 bg-gray-50 rounded p-3">
                      {log.staffName && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span>By: <span className="font-medium">{log.staffName}</span></span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span>Qty: <span className="font-medium">{log.quantity || 0}</span></span>
                      </div>
                      {log.timestamp && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">
                            {new Date(
                              log.timestamp?.seconds
                                ? log.timestamp.seconds * 1000
                                : log.timestamp
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
