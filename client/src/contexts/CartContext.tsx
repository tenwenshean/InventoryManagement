import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import type { Product } from "@/types";

interface CartItem {
  product: Product & { companyName?: string };
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product & { companyName?: string }) => void;
  updateCartQuantity: (productId: string, newQuantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  validateAndCleanCart: () => Promise<{ removedProducts: string[] }>;
  isValidating: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Validate cart items against existing products
  const validateAndCleanCart = useCallback(async (): Promise<{ removedProducts: string[] }> => {
    if (cart.length === 0) {
      return { removedProducts: [] };
    }

    setIsValidating(true);
    const removedProducts: string[] = [];

    try {
      // Fetch all available products - use direct fetch to avoid apiRequest throwing on error
      const API_BASE = (import.meta as any)?.env?.VITE_API_BASE || "";
      const response = await fetch(`${API_BASE}/api/public/products`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.error("Failed to fetch products for cart validation:", response.status);
        setIsValidating(false);
        return { removedProducts: [] };
      }

      const availableProducts: Product[] = await response.json();
      const availableProductIds = new Set(availableProducts.map(p => p.id));

      // Filter out products that no longer exist
      const validCart = cart.filter(item => {
        const exists = availableProductIds.has(item.product.id);
        if (!exists) {
          removedProducts.push(item.product.name);
          console.log(`Removing non-existent product from cart: ${item.product.name} (ID: ${item.product.id})`);
        }
        return exists;
      });

      // Update cart if any products were removed
      if (removedProducts.length > 0) {
        setCart(validCart);
        // Update localStorage
        if (currentUserId) {
          localStorage.setItem(`shoppingCart_${currentUserId}`, JSON.stringify(validCart));
        }
      }
    } catch (error) {
      console.error("Error validating cart:", error);
    } finally {
      setIsValidating(false);
    }

    return { removedProducts };
  }, [cart, currentUserId]);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        // Load user-specific cart from localStorage
        const savedCart = localStorage.getItem(`shoppingCart_${user.uid}`);
        setCart(savedCart ? JSON.parse(savedCart) : []);
      } else {
        setCurrentUserId(null);
        // Clear cart when user logs out
        setCart([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save cart to localStorage whenever it changes (only if user is logged in)
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`shoppingCart_${currentUserId}`, JSON.stringify(cart));
    }
  }, [cart, currentUserId]);

  const addToCart = (product: Product & { companyName?: string }) => {
    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    // Remove user-specific cart from localStorage
    if (currentUserId) {
      localStorage.removeItem(`shoppingCart_${currentUserId}`);
    }
  };

  const cartTotal = cart.reduce(
    (total, item) => total + parseFloat(item.product.price) * item.quantity,
    0
  );

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
        validateAndCleanCart,
        isValidating
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
