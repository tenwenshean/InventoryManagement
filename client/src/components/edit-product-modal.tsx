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
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      barcode: "",
    },
  });

  // Reset form when product data loads
  useEffect(() => {
    if (product) {
      console.log("📝 Loading product data into form:", product);
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
        barcode: product.barcode || "",
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
      return response.json();
    },
    onSuccess: () => {
      console.log("✅ Product updated successfully");
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
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
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
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
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter barcode" {...field} data-testid="input-edit-product-barcode" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                    <FormLabel>Current Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                    <FormLabel>Min Stock Level</FormLabel>
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
                    <FormLabel>Max Stock Level</FormLabel>
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