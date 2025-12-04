import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { QrCode, MapPin, FileText, Package, DollarSign, Hash, Layers, ArrowRightLeft, PackageCheck, Key, Building2 } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";

interface TransferRecord {
  id: string;
  type: 'transfer' | 'receive';
  staffName: string;
  fromBranch: string;
  toBranch: string;
  timestamp: string;
  productId: string;
}

interface Staff {
  id: string;
  name: string;
  pin: string;
  branch: string;
  createdAt: string;
}

export default function ScanPage() {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const defaultUnitLabel = useMemo(() => {
    try { return localStorage.getItem('app_defaultUnit') || 'units'; } catch { return 'units'; }
  }, []);
  const [, params] = useRoute("/scan/:code");
  const code = params?.code ? decodeURIComponent(params.code) : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState<string>('N/A');
  
  // Transfer/Receive states
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [pin, setPin] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedReceiveBranch, setSelectedReceiveBranch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Get branches and staff from localStorage
  const [branches, setBranches] = useState<string[]>(['Warehouse A']);
  const [currentBranch, setCurrentBranch] = useState<string>('Warehouse A');
  const [staff, setStaff] = useState<Staff[]>([]);
  
  useEffect(() => {
    // Load settings from localStorage - check multiple sources
    const loadSettings = () => {
      try {
        let loadedBranches: string[] = ['Warehouse A'];
        let loadedCurrentBranch = 'Warehouse A';
        let loadedStaff: Staff[] = [];
        
        // Debug: Show all localStorage keys
        console.log('=== SCAN PAGE: Loading Settings ===');
        console.log('All localStorage keys:', Object.keys(localStorage));
        
        // Check global app_ keys first (always available)
        const appBranches = localStorage.getItem('app_branches');
        const appStaff = localStorage.getItem('app_staff');
        const appCurrentBranch = localStorage.getItem('app_currentBranch');
        
        console.log('Raw app_staff value:', appStaff);
        console.log('Raw app_branches value:', appBranches);
        
        if (appBranches) {
          try {
            loadedBranches = JSON.parse(appBranches);
          } catch (e) {
            console.error('Error parsing app_branches:', e);
          }
        }
        
        if (appStaff) {
          try {
            loadedStaff = JSON.parse(appStaff);
          } catch (e) {
            console.error('Error parsing app_staff:', e);
          }
        }
        
        if (appCurrentBranch) {
          loadedCurrentBranch = appCurrentBranch;
        }
        
        // Also check user settings (may have more complete data)
        const userSettingsKeys = Object.keys(localStorage).filter(k => k.startsWith('settings_'));
        for (const key of userSettingsKeys) {
          try {
            const settings = JSON.parse(localStorage.getItem(key) || '{}');
            if (settings.branches && settings.branches.length > 0) {
              loadedBranches = settings.branches;
            }
            if (settings.staff && settings.staff.length > 0) {
              loadedStaff = settings.staff;
            }
            if (settings.currentBranch) {
              loadedCurrentBranch = settings.currentBranch;
            }
          } catch (e) {
            console.error('Error parsing user settings:', e);
          }
        }
        
        console.log('Final loaded settings:', { 
          branches: loadedBranches, 
          currentBranch: loadedCurrentBranch,
          staff: loadedStaff,
          staffCount: loadedStaff.length 
        });
        
        setBranches(loadedBranches);
        setCurrentBranch(loadedCurrentBranch);
        setStaff(loadedStaff);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    
    loadSettings();
    
    // Also listen for storage changes (in case settings are updated in another tab)
    const handleStorageChange = () => {
      loadSettings();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const qrImageUrl = (size = 200) => {
    const target = `${window.location.origin}/scan/${encodeURIComponent(code)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/qr/${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const js = await res.json();
        if (!mounted) return;
        setProduct(js.product);
        
        // Fetch category name if categoryId exists
        if (js.product?.categoryId) {
          try {
            const catRes = await fetch(`/api/public/categories`);
            if (catRes.ok) {
              const categories = await catRes.json();
              const category = categories.find((c: any) => c.id === js.product.categoryId);
              if (category && mounted) {
                setCategoryName(category.name);
              }
            }
          } catch (e) {
            console.error('Failed to fetch category:', e);
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        setError("QR not found or invalid");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [code]);

  // Verify PIN and get staff name
  const verifyPin = (inputPin: string): Staff | null => {
    return staff.find(s => s.pin === inputPin) || null;
  };

  // Handle transfer
  const handleTransfer = () => {
    if (!pin || pin.length !== 6) {
      toast({
        title: "Invalid PIN",
        description: "Please enter a 6-digit PIN.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedBranch) {
      toast({
        title: "Select Branch",
        description: "Please select a destination branch.",
        variant: "destructive",
      });
      return;
    }

    const staffMember = verifyPin(pin);
    if (!staffMember) {
      toast({
        title: "Invalid PIN",
        description: "The PIN entered is not valid. Please check and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    // Create transfer record
    const transferRecord: TransferRecord = {
      id: `transfer_${Date.now()}`,
      type: 'transfer',
      staffName: `${staffMember.name} (${staffMember.branch || 'Unknown branch'})`,
      fromBranch: product?.location || currentBranch,
      toBranch: selectedBranch,
      timestamp: new Date().toISOString(),
      productId: product?.id,
    };

    // Save to localStorage
    try {
      const existingTransfers = JSON.parse(localStorage.getItem('product_transfers') || '[]');
      existingTransfers.push(transferRecord);
      localStorage.setItem('product_transfers', JSON.stringify(existingTransfers));

      toast({
        title: "Transfer Initiated",
        description: `Product transfer to ${selectedBranch} initiated by ${staffMember.name} from ${staffMember.branch || 'Unknown branch'}.`,
      });

      setShowTransferDialog(false);
      setPin("");
      setSelectedBranch("");
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save transfer record.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle receive
  const handleReceive = async () => {
    if (!pin || pin.length !== 6) {
      toast({
        title: "Invalid PIN",
        description: "Please enter a 6-digit PIN.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedReceiveBranch) {
      toast({
        title: "Select Branch",
        description: "Please select the receiving branch.",
        variant: "destructive",
      });
      return;
    }

    const staffMember = verifyPin(pin);
    if (!staffMember) {
      toast({
        title: "Invalid PIN",
        description: "The PIN entered is not valid. Please check and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    const newBranch = selectedReceiveBranch;

    // Create receive record
    const receiveRecord: TransferRecord = {
      id: `receive_${Date.now()}`,
      type: 'receive',
      staffName: `${staffMember.name} (${staffMember.branch || 'Unknown branch'})`,
      fromBranch: product?.location || 'Unknown',
      toBranch: newBranch,
      timestamp: new Date().toISOString(),
      productId: product?.id,
    };

    try {
      // Update product location in the database
      const response = await fetch('/api/public/transfer-receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product?.id,
          newLocation: newBranch,
          staffPin: pin,
          staffName: staffMember.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product location');
      }

      // Save transfer record to localStorage
      const existingTransfers = JSON.parse(localStorage.getItem('product_transfers') || '[]');
      existingTransfers.push(receiveRecord);
      localStorage.setItem('product_transfers', JSON.stringify(existingTransfers));

      // Update local product state to reflect the new location
      setProduct((prev: any) => prev ? { ...prev, location: newBranch } : prev);

      toast({
        title: "Product Received",
        description: `Product location updated to ${newBranch}. Received by ${staffMember.name}.`,
      });

      setShowReceiveDialog(false);
      setPin("");
      setSelectedReceiveBranch("");
    } catch (e) {
      console.error('Error receiving product:', e);
      toast({
        title: "Error",
        description: "Failed to update product location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <QrCode size={28} /> Product Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading product...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 text-lg font-semibold mb-2">{error}</div>
              <p className="text-gray-500">Please scan a valid QR code</p>
            </div>
          ) : !product ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <div className="text-gray-600">QR code not found</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Transfer/Receive Buttons */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:bg-orange-300"
                  onClick={() => setShowTransferDialog(true)}
                  disabled={staff.length === 0}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white disabled:bg-green-300"
                  onClick={() => setShowReceiveDialog(true)}
                  disabled={staff.length === 0}
                >
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Receive
                </Button>
              </div>
              
              {staff.length === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Add staff members in Settings to enable product transfers.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    (Debug: Found {branches.length} branches, {staff.length} staff members)
                  </p>
                </div>
              )}

              {/* Product Image */}
              <div className="flex justify-center">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full max-w-md h-64 object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg shadow-md flex items-center justify-center">
                    <div className="text-center">
                      <Package className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500 font-medium">No Picture Available</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Product Details */}
              <div className="space-y-4">
                {/* Product Name */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
                  {product.description && (
                    <p className="text-gray-600 mt-1">{product.description}</p>
                  )}
                </div>

                {/* Key Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SKU */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Hash className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">SKU</p>
                      <p className="font-semibold text-gray-900">{product.sku}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Price</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Layers className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Category</p>
                      <p className="font-semibold text-gray-900">{categoryName}</p>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Package className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">In Stock</p>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{product.quantity ?? 0} {defaultUnitLabel}</p>
                        {product.quantity > 0 ? (
                          <Badge className="bg-green-500">Available</Badge>
                        ) : (
                          <Badge variant="destructive">Out of Stock</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location */}
                {product.location && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900 uppercase mb-1">Storage Location</p>
                      <p className="text-gray-700">{product.location}</p>
                    </div>
                  </div>
                )}

                {/* Notes/Remarks */}
                {product.notes && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 uppercase mb-1">Notes / Remarks</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{product.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* QR Code */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">QR Code</p>
                <img src={qrImageUrl(140)} alt="QR" className="mx-auto border-2 border-gray-200 rounded-lg" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-orange-500" />
              Transfer Product
            </DialogTitle>
            <DialogDescription>
              Enter your staff PIN and select the destination branch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-pin" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Staff PIN
              </Label>
              <Input
                id="transfer-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination-branch" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Destination Branch
              </Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b !== (product?.location || currentBranch)).map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>From:</strong> {product?.location || currentBranch}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowTransferDialog(false);
              setPin("");
              setSelectedBranch("");
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleTransfer}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-green-500" />
              Receive Product
            </DialogTitle>
            <DialogDescription>
              Enter your staff PIN and select the receiving branch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="receive-pin" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Staff PIN
              </Label>
              <Input
                id="receive-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receive-branch" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Receiving Branch
              </Label>
              <Select value={selectedReceiveBranch} onValueChange={setSelectedReceiveBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select receiving branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Current Location:</strong> {product?.location || 'Unknown'}
              </p>
              <p className="text-sm text-green-800 mt-1">
                <strong>Product:</strong> {product?.name}
              </p>
              {selectedReceiveBranch && (
                <p className="text-sm text-green-800 mt-1">
                  <strong>Will be moved to:</strong> {selectedReceiveBranch}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReceiveDialog(false);
              setPin("");
              setSelectedReceiveBranch("");
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-green-500 hover:bg-green-600"
              onClick={handleReceive}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Confirm Receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


