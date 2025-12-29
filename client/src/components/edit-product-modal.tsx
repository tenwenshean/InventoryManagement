import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { uploadImage, validateImageFile } from "@/lib/imageUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Image as ImageIcon, Trash2, Plus } from "lucide-react";
import { insertProductSchema } from "@/types";
import type { Product, Category } from "@/types";

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}

const editProductSchema = insertProductSchema.partial();

export default function EditProductModal({ isOpen, onClose, productId }: EditProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get branches from localStorage
  const [branches, setBranches] = useState<string[]>(['Warehouse A']);
  const [originalLocation, setOriginalLocation] = useState<string | null>(null);
  
  useEffect(() => {
    try {
      // First try app_branches (auto-saved when branches change)
      const appBranches = localStorage.getItem('app_branches');
      if (appBranches) {
        const parsed = JSON.parse(appBranches);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBranches(parsed);
          return;
        }
      }
      
      // Fallback to settings_* keys
      const userIds = Object.keys(localStorage).filter(k => k.startsWith('settings_'));
      if (userIds.length > 0) {
        const settingsKey = userIds[0];
        const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        if (settings.branches && settings.branches.length > 0) {
          setBranches(settings.branches);
        }
      }
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
  }, [isOpen]);

  // Fetch product data via API
  const { data: product, isLoading: productLoading } = useQuery<Product | null>({
    queryKey: [...queryKeys.products.detail(productId)],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products/${productId}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      return response.json();
    },
    enabled: isOpen && !!productId,
  });

  // Fetch categories via API
  const { data: categories } = useQuery<Category[]>({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
    enabled: isOpen,
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const res = await apiRequest("DELETE", `/api/categories/${categoryId}`);
      if (!res.ok) throw new Error("Failed to delete category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicCategories.all });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCategory = (categoryId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this category?")) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/categories", { name });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicCategories.all });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      setNewCategoryName("");
      setIsAddingCategory(false);
      // Auto-select the new category
      form.setValue("categoryId", data.id);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      createCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  const form = useForm<z.infer<typeof editProductSchema>>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: "",
      categoryId: "",
      price: "",
      costPrice: "",
      quantity: 0,
      minStockLevel: 0,
      maxStockLevel: 0,
      location: "",
      supplier: "",
      notes: "",
    },
  });

  // Update form when product data loads
  useEffect(() => {
    if (product) {
      console.log("Loading product data into form:", product);
      // Track original location for transfer history
      setOriginalLocation(product.location || null);
      
      form.reset({
        name: product.name,
        description: product.description || "",
        sku: product.sku,
        categoryId: product.categoryId || "",
        price: product.price,
        costPrice: product.costPrice || "",
        quantity: product.quantity || 0,
        minStockLevel: product.minStockLevel || 0,
        maxStockLevel: product.maxStockLevel || 0,
        location: product.location || "",
        supplier: product.supplier || "",
        notes: product.notes || "",
      });
      
      // Reset image states when product changes
      setRemoveExistingImage(false);
      setSelectedImage(null);
      
      // Set existing image preview if available
      if (product.imageUrl) {
        setImagePreview(product.imageUrl);
      } else {
        setImagePreview(null);
      }
    }
  }, [product, form]);

  const updateProductMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editProductSchema> & { imageUrl?: string }) => {
      console.log("🔄 Updating product:", productId, data);
      const response = await apiRequest("PUT", `/api/products/${productId}`, data);
      if (!response.ok) throw new Error("Failed to update product");
      return { ...data, id: productId };
    },
    onSuccess: (data) => {
      console.log("✅ Product updated successfully");
      
      // Check if location changed and record in transfer history
      if (data.location && data.location !== originalLocation) {
        try {
          const transferRecord = {
            id: `admin_${Date.now()}`,
            type: 'admin-update',
            staffName: 'Admin',
            fromBranch: originalLocation || 'Unknown',
            toBranch: data.location,
            timestamp: new Date().toISOString(),
            productId: productId,
          };
          const existingTransfers = JSON.parse(localStorage.getItem('product_transfers') || '[]');
          existingTransfers.push(transferRecord);
          localStorage.setItem('product_transfers', JSON.stringify(existingTransfers));
          console.log('📝 Recorded location change in transfer history');
        } catch (e) {
          console.error('Failed to record transfer history:', e);
        }
      }
      
      // Invalidate both enterprise and public product queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("❌ Update product error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        title: "Invalid Image",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setSelectedImage(file);
    setRemoveExistingImage(false); // Reset remove flag when new image is selected
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    console.log("🗑️ User clicked remove image button");
    setSelectedImage(null);
    setImagePreview(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    console.log("✅ Image removal state set - will remove on save");
  };

  const onSubmit = async (data: z.infer<typeof editProductSchema>) => {
    console.log("📤 Form submitted with data:", data);
    console.log("🔍 Current states:", {
      removeExistingImage,
      hasSelectedImage: !!selectedImage,
      hasImagePreview: !!imagePreview,
      productHasImage: !!product?.imageUrl
    });
    
    let imageUrl: string | undefined = product?.imageUrl || undefined;

    // If user clicked remove, set imageUrl to empty
    if (removeExistingImage && !selectedImage) {
      imageUrl = "";  // Send empty string instead of undefined to explicitly remove
      console.log("🗑️ Removing existing image - setting imageUrl to empty string");
    }
    // Upload new image if selected
    else if (selectedImage) {
      try {
        setIsUploadingImage(true);
        const timestamp = Date.now();
        const fileName = `${timestamp}_${selectedImage.name}`;
        imageUrl = await uploadImage(selectedImage, `products/${fileName}`);
        console.log("✅ Image uploaded:", imageUrl);
      } catch (error) {
        console.error("❌ Image upload error:", error);
        toast({
          title: "Image Upload Failed",
          description: "Failed to upload image. The product will be updated without changing the image.",
          variant: "destructive",
        });
      } finally {
        setIsUploadingImage(false);
      }
    }

    updateProductMutation.mutate({ ...data, imageUrl });
  };

  if (productLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] w-[95vw]">
          <div className="flex items-center justify-center p-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2">Loading product...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!product) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] w-[95vw]">
          <div className="flex items-center justify-center p-6">
            <p className="text-destructive">Product not found</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-foreground">
            Edit Product
          </DialogTitle>
          <DialogDescription>
            Update the product information and details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Image Upload Section */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <FormLabel>Product Image</FormLabel>
              {removeExistingImage && !selectedImage && (
                <p className="text-sm text-orange-600 mt-1">
                  Image will be removed when you save
                </p>
              )}
              <div className="mt-2">
                {imagePreview ? (
                  <div className="relative inline-block w-full">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveImage}
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 mb-4">
                      {removeExistingImage ? "No image selected" : "Upload a product image"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="edit-product-image-upload"
                    />
                    <label htmlFor="edit-product-image-upload">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Image
                      </Button>
                    </label>
                    <p className="text-xs text-gray-400 mt-2">
                      JPG, PNG, GIF or WebP (Max 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} data-testid="input-edit-product-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter SKU" {...field} data-testid="input-edit-product-sku" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter product description"
                      className="resize-none"
                      {...field}
                      data-testid="textarea-edit-product-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-product-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <div key={category.id} className="relative group">
                            <SelectItem value={category.id} className="pr-10">
                              {category.name}
                            </SelectItem>
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-opacity"
                              onClick={(e) => handleDeleteCategory(category.id, e)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <div className="p-2 border-t">
                          {!isAddingCategory ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => setIsAddingCategory(true)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add New Category
                            </Button>
                          ) : (
                            <div className="flex gap-2">
                              <Input
                                placeholder="Category name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddCategory();
                                  }
                                  if (e.key === "Escape") {
                                    setIsAddingCategory(false);
                                    setNewCategoryName("");
                                  }
                                }}
                                autoFocus
                                className="h-8"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleAddCategory}
                                disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                                className="h-8"
                              >
                                {createCategoryMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Add"
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIsAddingCategory(false);
                                  setNewCategoryName("");
                                }}
                                className="h-8"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-product-location">
                          <SelectValue placeholder="Select warehouse location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., ABC Supplies Inc." {...field} required data-testid="input-edit-product-supplier" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes or remarks"
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="textarea-edit-product-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-edit-product-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-edit-product-cost-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Quantity <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        data-testid="input-edit-product-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock Level (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-edit-product-min-stock"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Stock Level (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-edit-product-max-stock"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateProductMutation.isPending}
                data-testid="button-cancel-edit-product"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProductMutation.isPending || isUploadingImage}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-submit-edit-product"
              >
                {(updateProductMutation.isPending || isUploadingImage) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isUploadingImage ? "Uploading Image..." : "Update Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}