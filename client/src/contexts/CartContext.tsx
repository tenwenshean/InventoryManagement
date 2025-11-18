import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
        cartCount
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
