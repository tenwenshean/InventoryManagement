# Customer Shipping Profile Feature

## Overview
Implemented a customer profile feature that allows customers to save their shipping details and automatically fill them during checkout. Customers can still manually edit the shipping address during checkout if needed.

## Features Implemented

### 1. Database Schema Updates
- **New Table**: `customerProfiles` - Stores customer shipping information
  - Fields: `customerId`, `displayName`, `phoneNumber`, `address`, `city`, `postalCode`, `country`
  - Timestamps: `createdAt`, `updatedAt`

### 2. API Endpoints
Added three new API endpoints in `server/routes.ts`:

#### GET `/api/customer/profile/:customerId`
- Fetches saved customer profile
- Returns null if profile doesn't exist
- No authentication required (uses customerId from Firebase)

#### POST `/api/customer/profile`
- Creates or updates customer profile
- Saves shipping details to Firestore
- Required fields: `customerId`
- Optional fields: `displayName`, `phoneNumber`, `address`, `city`, `postalCode`, `country`

### 3. Customer Profile Page Updates
**File**: `client/src/pages/customer-profile.tsx`

- Added query to fetch customer profile from database
- Updated form to load saved shipping details from database
- Modified save handler to store shipping details in database (removed localStorage usage)
- Added helpful description text explaining the auto-fill feature
- Profile fields now persist across sessions and devices

### 4. Checkout Page Updates
**File**: `client/src/pages/checkout.tsx`

- Added query to fetch customer profile on page load
- Auto-fills shipping address from saved profile when available
- Combines address fields into a single formatted string: `address, city, postalCode, country`
- Shows success indicator when address is auto-filled from profile
- Includes "Edit in Profile" link for easy profile updates
- Customers can still manually edit the address field during checkout

## User Flow

### First-Time User
1. Customer logs in
2. Goes to checkout → needs to manually enter shipping details
3. Visits "My Profile" page
4. Fills in shipping details and saves
5. Next checkout → shipping details are auto-filled

### Returning User
1. Customer logs in
2. Goes to checkout
3. Shipping address is automatically filled from saved profile
4. Green checkmark indicates "Auto-filled from your saved profile"
5. Customer can edit if needed or click "Edit in Profile" to update permanently
6. Proceeds with order

## Benefits

1. **Convenience**: Saves time for returning customers
2. **Flexibility**: Customers can still edit address during checkout for one-time changes
3. **Accuracy**: Reduces typos from repeatedly entering the same information
4. **Cross-Device**: Profile syncs across all devices via Firebase
5. **User Experience**: Clean UI with helpful indicators and quick edit access

## Technical Details

### Data Storage
- Customer profiles stored in Firestore collection: `customerProfiles`
- Document ID matches Firebase UID for easy retrieval
- Profile data separate from order data for better organization

### Auto-Fill Logic
- Profile fetched using React Query when user is authenticated
- UseEffect hook monitors profile data and auto-fills form fields
- Address fields concatenated with proper formatting
- Original fields preserved in profile for editing

### Profile Management
- Profile page shows all shipping fields individually for easy editing
- Save button updates both Firebase Auth (display name) and Firestore (shipping details)
- Toast notifications confirm successful saves
- Query invalidation ensures fresh data across pages

## Files Modified

1. `shared/schema.ts` - Added customerProfiles table schema
2. `server/routes.ts` - Added profile API endpoints
3. `client/src/pages/customer-profile.tsx` - Updated to save/load from database
4. `client/src/pages/checkout.tsx` - Added auto-fill functionality

## Future Enhancements (Optional)

- Support for multiple saved addresses
- Address validation/autocomplete
- Default shipping address selection
- Billing address separate from shipping address
- Address book management
