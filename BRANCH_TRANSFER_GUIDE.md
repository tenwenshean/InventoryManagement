# Branch Transfer System - Complete Guide

## Overview

The Branch Transfer System enables secure product transfers between different branch locations using QR code technology and PIN-based authentication. This system provides full audit trails and prevents human errors through multiple validation layers.

## 🎯 Core Features

### ✅ Mandatory Branch Transfer Logic
- Staff scans product QR code
- Selects destination branch
- Enters transfer quantity
- Confirms with staff PIN
- System generates Transfer Slip with unique QR code
- Receiving branch scans Transfer Slip QR
- Receiving staff confirms with PIN
- Product stock and location automatically updated
- Complete audit trail recorded

### 🔐 Authentication & Security
- Uses existing Google login for enterprise users
- Phone number registration for customer portal
- Staff PIN (6-digit) for all transfer actions
- Role-based access (staff, manager, admin)
- No transfer without PIN confirmation
- All actions logged with staff ID and timestamp

### 📊 Data Tracking

#### Transfer Slip Information
```typescript
{
  transferId: "TRF-ABC123-XYZ",          // Human-readable ID
  productId: "product-uuid",
  productName: "Product Name",
  quantity: 10,
  fromBranch: "branch-uuid",
  toBranch: "branch-uuid",
  requestedBy: "staff-uuid",             // Who initiated
  requestedTimestamp: "2025-12-02T...",
  status: "in_transit" | "completed" | "cancelled",
  receivedBy: "staff-uuid",              // Who received
  receivedTimestamp: "2025-12-02T...",
  qrCode: "base64-qr-image",             // Transfer slip QR
  notes: "Optional notes"
}
```

#### Product Location Log
```typescript
{
  productId: "product-uuid",
  previousBranch: "branch-uuid",
  newBranch: "branch-uuid",
  quantity: 10,
  transferSlipId: "slip-uuid",
  changedBy: "staff-uuid",
  reason: "transfer" | "initial_stock" | "adjustment",
  timestamp: "2025-12-02T..."
}
```

### 🛡️ Error Prevention Measures

1. **PIN Validation**
   - Staff must enter PIN before sending transfer
   - Receiving staff must enter PIN to confirm receipt
   - PIN is hashed (SHA-256) for secure storage

2. **Quantity Checks**
   - Cannot transfer more than available stock
   - Real-time stock validation before transfer
   - Quantity updates are atomic (using transactions)

3. **Branch Validation**
   - Cannot transfer to same branch
   - Receiving staff must belong to destination branch
   - Branch existence validated

4. **Confirmation Dialogs**
   - Multiple confirmation steps for all actions
   - Clear display of transfer details before confirmation
   - Cannot proceed without explicit approval

5. **Status Tracking**
   - Transfer status prevents duplicate processing
   - Completed transfers cannot be modified
   - Cancelled transfers restore stock automatically

6. **Audit Logging**
   - Every action recorded with staff ID
   - Timestamps for all state changes
   - Complete location history per product

## 📱 User Interface

### 1. Staff Setup (Settings Page)
**Location:** Settings → Staff Profile & Branch Transfer

- Create staff profile
- Set 6-digit PIN
- Assign to branch
- Choose role (staff/manager/admin)
- Change PIN anytime

### 2. Branch Transfer Page
**Location:** Sidebar → Branch Transfer

**Features:**
- View all products available for transfer
- See pending/completed transfer statistics
- Initiate new transfers
- View transfer history
- Monitor transfer status

**Workflow:**
1. Click "Transfer" on a product
2. Select destination branch
3. Enter quantity
4. Add optional notes
5. Enter staff PIN to confirm
6. View generated Transfer Slip QR code
7. Print or share QR code

### 3. QR Scanner Page
**Location:** Sidebar → QR Scanner

**Features:**
- Scan transfer slip QR codes
- View transfer details
- Confirm receipt with PIN
- Update product location automatically

**Workflow:**
1. Paste QR code data or scan with device
2. View transfer details
3. Verify product and quantity
4. Enter staff PIN to confirm receipt
5. Product automatically added to branch inventory

### 4. Branch Management (Settings Page)
**Location:** Settings → Branches

- Add new branches
- View all branch locations
- Manage branch details (address, contact info)

## 🔧 API Endpoints

### Branches
```
GET    /api/branches              - Get all branches
POST   /api/branches              - Create new branch
```

### Staff
```
GET    /api/staff/profile         - Get current user's staff profile
POST   /api/staff                 - Create staff profile
PUT    /api/staff/pin             - Update staff PIN
POST   /api/staff/verify-pin      - Verify PIN (for dialogs)
```

### Transfers
```
POST   /api/transfers/initiate    - Create new transfer
GET    /api/transfers             - Get transfer slips (with filters)
GET    /api/transfers/:id         - Get specific transfer slip
POST   /api/transfers/scan        - Scan transfer QR and get details
POST   /api/transfers/receive     - Complete transfer (receive)
POST   /api/transfers/cancel      - Cancel pending transfer
```

### Product Location
```
GET    /api/products/:id/location-history  - Get product location logs
```

## 📋 Database Schema

### New Tables

#### `branches`
```sql
id              VARCHAR (UUID, PK)
name            VARCHAR (NOT NULL)
address         TEXT
city            VARCHAR
state           VARCHAR
postalCode      VARCHAR
contactNumber   VARCHAR
isActive        BOOLEAN (default: true)
createdAt       TIMESTAMP
```

#### `staff`
```sql
id              VARCHAR (UUID, PK)
userId          VARCHAR (NOT NULL) -- Firebase UID
staffName       VARCHAR (NOT NULL)
staffPin        VARCHAR (NOT NULL) -- Hashed PIN
role            VARCHAR (NOT NULL) -- 'staff', 'manager', 'admin'
branchId        VARCHAR (FK → branches.id)
isActive        BOOLEAN (default: true)
createdAt       TIMESTAMP
```

#### `transferSlips`
```sql
id                  VARCHAR (UUID, PK)
transferId          VARCHAR (NOT NULL, UNIQUE) -- Human-readable
productId           VARCHAR (FK → products.id)
productName         VARCHAR
quantity            INTEGER
fromBranch          VARCHAR (FK → branches.id)
toBranch            VARCHAR (FK → branches.id)
requestedBy         VARCHAR (FK → staff.id)
requestedTimestamp  TIMESTAMP
status              VARCHAR ('in_transit', 'completed', 'cancelled')
receivedBy          VARCHAR (FK → staff.id)
receivedTimestamp   TIMESTAMP
qrCode              VARCHAR (base64 QR image)
notes               TEXT
createdAt           TIMESTAMP
```

#### `productLocationLogs`
```sql
id              VARCHAR (UUID, PK)
productId       VARCHAR (FK → products.id)
previousBranch  VARCHAR (FK → branches.id)
newBranch       VARCHAR (FK → branches.id)
quantity        INTEGER
transferSlipId  VARCHAR (FK → transferSlips.id)
changedBy       VARCHAR (FK → staff.id)
reason          VARCHAR ('transfer', 'initial_stock', 'adjustment')
timestamp       TIMESTAMP
```

### Modified Tables

#### `products`
Added field:
```sql
currentBranch   VARCHAR  -- Current branch ID
```

## 🚀 Getting Started

### Step 1: Set Up Branches
1. Go to **Settings**
2. Scroll to **Branches** section
3. Click **Add Branch**
4. Enter branch details
5. Save

### Step 2: Create Staff Profile
1. Go to **Settings**
2. Find **Staff Profile & Branch Transfer** section
3. Click **Set Up Staff Profile**
4. Enter your name, role, and select branch
5. Create a 6-digit PIN
6. Confirm PIN
7. Click **Create Profile**

### Step 3: Initiate Your First Transfer
1. Go to **Branch Transfer** page
2. Find product to transfer
3. Click **Transfer** button
4. Select destination branch
5. Enter quantity
6. Add notes (optional)
7. Enter your PIN
8. View generated QR code

### Step 4: Receive Transfer
1. Go to **QR Scanner** page
2. Scan or paste Transfer Slip QR code
3. Verify transfer details
4. Enter your PIN to confirm
5. Product is added to your branch

## 🔒 Security Best Practices

### PIN Management
- Choose a unique 6-digit PIN
- Don't share your PIN with others
- Change PIN regularly
- Never write PIN down in plain text

### Transfer Verification
- Always verify product details before confirming
- Check quantity matches physical count
- Review transfer history regularly
- Report discrepancies immediately

### Access Control
- Only authorized staff should have profiles
- Assign appropriate roles based on responsibility
- Deactivate staff profiles when no longer needed
- Monitor transfer logs for suspicious activity

## 📊 Reports & Auditing

### Transfer History
View complete history of all transfers:
- Filter by status (in_transit, completed, cancelled)
- Filter by branch (from/to)
- Filter by product
- Search by transfer ID

### Location History
Track product movement:
- View all location changes for a product
- See who moved it and when
- Identify transfer patterns
- Audit stock movements

### Audit Trail
Every action is logged:
- Who initiated the transfer
- When it was initiated
- Who received the transfer
- When it was received
- Any cancellations or modifications

## ⚠️ Troubleshooting

### Cannot Create Staff Profile
**Problem:** "Staff profile required" error
**Solution:** Go to Settings and create your staff profile first

### PIN Rejected
**Problem:** "Invalid PIN" error
**Solution:** 
- Verify you're entering the correct 6-digit PIN
- Try resetting PIN in Settings
- Contact admin if locked out

### Transfer Not Appearing
**Problem:** Transfer doesn't show up after creation
**Solution:**
- Refresh the page
- Check transfer history
- Verify transfer wasn't cancelled

### Cannot Receive Transfer
**Problem:** "Staff must be from destination branch" error
**Solution:** 
- Verify you're assigned to the correct branch in Settings
- Contact admin to update your branch assignment

### Stock Not Updating
**Problem:** Product quantity not changing after transfer
**Solution:**
- Verify transfer status is "completed"
- Check if transfer was cancelled
- Refresh product list
- Contact support if issue persists

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review error messages carefully
3. Contact your system administrator
4. Check audit logs for detailed information

## 🎓 Training Tips

### For New Staff
1. Practice with test products first
2. Familiarize yourself with QR scanner
3. Always double-check quantities
4. Keep your PIN secure
5. Report any issues immediately

### For Managers
1. Set up branches correctly
2. Assign staff to appropriate branches
3. Monitor transfer patterns
4. Review audit logs weekly
5. Train staff on proper procedures

### For Admins
1. Create branch structure first
2. Set up staff profiles for all users
3. Define clear transfer policies
4. Regular audit log reviews
5. Backup transfer data regularly

---

**Version:** 1.0  
**Last Updated:** December 2, 2025  
**System:** InventoryPro Enterprise - Branch Transfer Module
