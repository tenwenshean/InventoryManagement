# Login Required for Add to Cart

## Overview
Updated all customer-facing pages to require user authentication before adding items to the shopping cart. Users who are not logged in will be prompted to log in when they attempt to add products to their cart.

## Changes Made

### 1. Customer Landing Page (`client/src/pages/customer.tsx`)

**Updated `handleAddToCart` function:**
- Added authentication check before adding to cart
- Shows login modal if user is not authenticated
- Displays destructive toast notification: "Login Required - Please log in to add items to your cart"
- Only proceeds with cart addition after successful login

```typescript
const handleAddToCart = (product: Product & { companyName?: string }) => {
  // Check if user is logged in
  if (!customerUser) {
    setShowLoginModal(true);
    toast({
      title: "Login Required",
      description: "Please log in to add items to your cart",
      variant: "destructive",
    });
    return;
  }

  addToCart(product);
  toast({
    title: "Added to cart",
    description: `${product.name} has been added to your cart`,
  });
};
```

### 2. Shop Details Page (`client/src/pages/shop-details.tsx`)

**New Features:**
- Added `CustomerLoginModal` import
- Added `showLoginModal` state variable
- Added `customerUser` state variable
- Added Firebase auth state listener
- Added login modal component at the end of the page

**Updated `handleAddToCart` function:**
- Same authentication check as customer page
- Prevents cart additions for non-authenticated users
- Shows login prompt when needed

**Auth State Listener:**
```typescript
useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    setCustomerUser(user);
  });
  return () => unsubscribe();
}, []);
```

**Login Modal Integration:**
```tsx
<CustomerLoginModal
  isOpen={showLoginModal}
  onClose={() => setShowLoginModal(false)}
  onLoginSuccess={(user) => {
    setCustomerUser(user);
    setShowLoginModal(false);
  }}
/>
```

### 3. All Products Shop Page (`client/src/pages/shop.tsx`)

**Updated `handleAddToCart` function:**
- Added authentication check using existing `currentUser` state
- Shows existing login modal if user not authenticated
- Displays login required toast notification
- Already had login modal infrastructure in place

```typescript
const handleAddToCart = (product: Product) => {
  // Check if user is logged in
  if (!currentUser) {
    setShowLoginModal(true);
    toast({
      title: "Login Required",
      description: "Please log in to add items to your cart",
      variant: "destructive",
    });
    return;
  }

  addToCart(product);
  toast({
    title: "Added to cart",
    description: `${product.name} has been added to your cart`,
  });
};
```

## User Experience Flow

### Before Login
1. User browses products on any customer page
2. User clicks "Add to Cart" button
3. System detects user is not logged in
4. Login modal appears automatically
5. Toast notification shows: "Login Required - Please log in to add items to your cart"
6. Product is NOT added to cart

### After Login
1. User completes login via modal
2. Modal closes automatically
3. User clicks "Add to Cart" again
4. Product is added to cart successfully
5. Success toast shows: "Added to cart - {Product Name} has been added to your cart"

## Cart Context Integration

The cart system already supports user-specific carts:
- Cart data is stored in localStorage per user: `shoppingCart_{userId}`
- Cart automatically loads when user logs in
- Cart automatically clears when user logs out
- No cart data persists for non-authenticated users

## Benefits

✅ **Security:** Prevents anonymous cart abuse  
✅ **User Experience:** Clear prompts guide users to log in  
✅ **Data Integrity:** All cart items tied to authenticated users  
✅ **Consistency:** Same behavior across all customer pages  
✅ **User-Specific Carts:** Each user maintains their own cart  

## Testing Checklist

- [ ] Customer landing page - Add to cart without login shows modal
- [ ] Customer landing page - Add to cart after login works
- [ ] Shop details page - Add to cart without login shows modal
- [ ] Shop details page - Add to cart after login works
- [ ] All products shop page - Add to cart without login shows modal
- [ ] All products shop page - Add to cart after login works
- [ ] Search results - Add to cart without login shows modal
- [ ] Product detail modal - Add to cart without login shows modal
- [ ] Toast notifications appear correctly
- [ ] Cart persists after login
- [ ] Cart clears after logout

## Files Modified

1. `client/src/pages/customer.tsx` - Added login check to handleAddToCart
2. `client/src/pages/shop-details.tsx` - Added login modal and authentication check
3. `client/src/pages/shop.tsx` - Added login check to handleAddToCart

## No Breaking Changes

- Existing logged-in users: No change in behavior
- Cart functionality: Unchanged for authenticated users
- Product browsing: Still fully accessible without login
- Only cart additions require authentication
