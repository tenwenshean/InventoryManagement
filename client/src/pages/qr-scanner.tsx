import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { QrCode, Camera, CheckCircle, XCircle, Loader2, Package } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface TransferSlip {
  id: string;
  transferId: string;
  productId: string;
  productName: string;
  quantity: number;
  fromBranch: string;
  toBranch: string;
  status: "in_transit" | "completed" | "cancelled";
  requestedTimestamp: string;
  notes?: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function QRScanner() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const [qrInput, setQrInput] = useState("");
  const [scannedTransfer, setScannedTransfer] = useState<TransferSlip | null>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receivePin, setReceivePin] = useState("");

  // Fetch branches
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Scan QR mutation
  const scanQRMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const response = await apiRequest("POST", "/api/transfers/scan", { qrData });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to scan QR code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setScannedTransfer(data);
      if (data.status === "in_transit") {
        setReceiveDialogOpen(true);
      } else {
        toast({
          title: "Transfer Already Processed",
          description: `This transfer has been ${data.status}`,
          variant: data.status === "completed" ? "default" : "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Receive transfer mutation
  const receiveTransferMutation = useMutation({
    mutationFn: async (data: { slipId: string; pin: string }) => {
      const response = await apiRequest("POST", "/api/transfers/receive", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to receive transfer");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transfer received successfully",
      });
      setReceiveDialogOpen(false);
      setReceivePin("");
      setScannedTransfer(null);
      setQrInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScanQR = () => {
    if (!qrInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter QR code data",
        variant: "destructive",
      });
      return;
    }

    scanQRMutation.mutate(qrInput);
  };

  const handleReceiveTransfer = () => {
    if (!scannedTransfer) return;

    receiveTransferMutation.mutate({
      slipId: scannedTransfer.id,
      pin: receivePin,
    });
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || "Unknown";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <QrCode size={28} />
          QR Code Scanner
        </h1>
        <p className="text-muted-foreground">
          Scan transfer slip QR codes to receive products
        </p>
      </header>

      {/* Scanner Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera size={20} />
            Scan Transfer Slip QR Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>QR Code Data</Label>
              <Textarea
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder='Paste QR code data here (e.g., {"type":"transfer_slip","transferId":"...","slipId":"..."})'
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste the QR code data or use a QR code scanner app to scan
              </p>
            </div>
            <Button
              onClick={handleScanQR}
              disabled={scanQRMutation.isPending || !qrInput.trim()}
              className="w-full"
            >
              {scanQRMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Scan QR Code
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scanned Transfer Info */}
      {scannedTransfer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package size={20} />
              Transfer Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{scannedTransfer.productName}</h3>
                {scannedTransfer.status === "completed" && (
                  <Badge className="bg-green-500">
                    <CheckCircle className="w-3 h-3 mr-1" /> Completed
                  </Badge>
                )}
                {scannedTransfer.status === "in_transit" && (
                  <Badge className="bg-yellow-500">In Transit</Badge>
                )}
                {scannedTransfer.status === "cancelled" && (
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" /> Cancelled
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Transfer ID</p>
                  <p className="font-medium">{scannedTransfer.transferId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="font-medium">{scannedTransfer.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">From Branch</p>
                  <p className="font-medium">{getBranchName(scannedTransfer.fromBranch)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">To Branch</p>
                  <p className="font-medium">{getBranchName(scannedTransfer.toBranch)}</p>
                </div>
              </div>

              {scannedTransfer.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{scannedTransfer.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Requested</p>
                <p className="text-sm">
                  {new Date(scannedTransfer.requestedTimestamp).toLocaleString()}
                </p>
              </div>

              {scannedTransfer.status === "in_transit" && (
                <Button onClick={() => setReceiveDialogOpen(true)} className="w-full">
                  Receive Transfer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receive Transfer Dialog */}
      <AlertDialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your staff PIN to confirm receipt of this transfer
            </AlertDialogDescription>
          </AlertDialogHeader>
          {scannedTransfer && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Product:</strong> {scannedTransfer.productName}
                </p>
                <p className="text-sm">
                  <strong>Quantity:</strong> {scannedTransfer.quantity}
                </p>
                <p className="text-sm">
                  <strong>From:</strong> {getBranchName(scannedTransfer.fromBranch)}
                </p>
              </div>
              <div>
                <Label>Staff PIN</Label>
                <Input
                  type="password"
                  maxLength={6}
                  value={receivePin}
                  onChange={(e) => setReceivePin(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReceiveTransfer}
              disabled={receivePin.length !== 6 || receiveTransferMutation.isPending}
            >
              {receiveTransferMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Confirm Receipt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
