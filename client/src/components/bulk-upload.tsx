import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createProduct } from "@/services/productService";
import type { InsertProduct } from "@/types";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedProduct extends InsertProduct {
  rowNumber: number;
}

interface UploadResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; product?: string }>;
}

export default function BulkUploadModal({ isOpen, onClose }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const parseCSV = (text: string): ParsedProduct[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error("CSV file is empty or invalid");
    }

    // Parse header
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    // Expected headers
    const requiredHeaders = ["name", "sku", "price", "categoryid"];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
    }

    // Parse rows
    const products: ParsedProduct[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      if (values.length < headers.length) continue;

      const product: any = { rowNumber: i + 1 };
      headers.forEach((header, index) => {
        product[header] = values[index];
      });

      // Convert to InsertProduct format
      products.push({
        name: product.name || "",
        sku: product.sku || "",
        description: product.description || "",
        categoryId: product.categoryid || "",
        price: product.price || "0",
        costPrice: product.costprice || "0",
        quantity: parseInt(product.quantity) || 0,
        minStockLevel: parseInt(product.minstocklevel) || 0,
        maxStockLevel: parseInt(product.maxstocklevel) || 100,
        barcode: product.barcode || "",
        isActive: true,
        rowNumber: i + 1,
      });
    }

    return products;
  };

  const uploadMutation = useMutation({
    mutationFn: async (products: ParsedProduct[]) => {
      const results: UploadResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      for (const product of products) {
        try {
          // Validate required fields
          if (!product.name || !product.sku || !product.categoryId) {
            throw new Error("Missing required fields (name, sku, or categoryId)");
          }

          await createProduct(product);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: product.rowNumber,
            product: product.name,
            error: error.message || "Unknown error",
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setUploadResult(results);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      if (results.failed === 0) {
        toast({
          title: "Success!",
          description: `Successfully imported ${results.success} products`,
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Imported ${results.success} products, ${results.failed} failed`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process CSV file",
        variant: "destructive",
      });
    },
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "text/csv") {
      setFile(droppedFile);
      setUploadResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setUploadResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const products = parseCSV(text);
      uploadMutation.mutate(products);
    } catch (error: any) {
      toast({
        title: "Parse Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setFile(null);
    setUploadResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Bulk Upload Products</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple products at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* CSV Format Info */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm text-foreground">CSV Format Required:</h4>
            <p className="text-xs text-muted-foreground">
              name, sku, description, categoryId, price, costPrice, quantity, minStockLevel, maxStockLevel, barcode
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Required fields:</strong> name, sku, categoryId, price
            </p>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-green-600" size={20} />
                  <span className="font-medium text-foreground">
                    {uploadResult.success} products imported successfully
                  </span>
                </div>
              </div>
              
              {uploadResult.failed > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="text-destructive" size={20} />
                    <span className="font-medium text-destructive">
                      {uploadResult.failed} products failed
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                    {uploadResult.errors.map((err, idx) => (
                      <div key={idx} className="text-muted-foreground">
                        Row {err.row}: {err.product || "Unknown"} - {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drag & Drop Area */}
          {!uploadResult && (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
                }
              `}
            >
              {file ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="text-primary" size={40} />
                    <div className="text-left">
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFile(null)}
                      className="ml-auto"
                    >
                      <X size={20} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="mx-auto text-muted-foreground" size={48} />
                  <div>
                    <p className="text-foreground font-medium mb-1">
                      Drag and drop your CSV file here
                    </p>
                    <p className="text-sm text-muted-foreground">or</p>
                  </div>
                  <label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span>Browse Files</span>
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
            >
              {uploadResult ? "Close" : "Cancel"}
            </Button>
            {!uploadResult && (
              <Button
                onClick={handleUpload}
                disabled={!file || uploadMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {uploadMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Upload Products
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}