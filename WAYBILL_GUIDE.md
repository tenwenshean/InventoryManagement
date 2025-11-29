# 📄 Waybill Template Guide

## Overview
The shipping waybill system has been updated with a professional, printer-friendly template that can be easily saved as PDF.

## Features ✨

### 1. **Professional Design**
- Clean, black and white design optimized for printing
- Clear sections for sender, recipient, and package contents
- Bold tracking number display
- Barcode placeholder area for courier stickers

### 2. **Print-to-PDF Ready**
- Optimized for A4 paper size
- Proper margins and spacing
- Print-friendly styling (removes backgrounds and shadows when printing)
- No auto-print popup - you control when to print

### 3. **Authentication Fixed**
- Token authentication working properly
- Better error messages if authentication fails
- Auto-refreshes token to prevent expiration issues

## How to Use 🚀

### Method 1: From Orders Page (Direct)
1. Go to **Orders** page
2. Find an order with shipment tracking (status: "processing")
3. In the blue "Shipping Information" box, click **"Print Waybill"** button
4. A new window opens with the waybill
5. Click **"Print / Save PDF"** button in the top-right
6. In the print dialog:
   - Select **"Save as PDF"** or **"Microsoft Print to PDF"**
   - Choose destination folder
   - Click Save

### Method 2: From Shipping Dialog
1. Go to **Orders** page
2. Click **"View Shipping Details"** on an order
3. In the shipping dialog, click **"Print Waybill"** button (green)
4. Follow steps 4-6 from Method 1

## Waybill Template Contents 📋

The waybill includes:

### Header Section
- **Order Number**: Your order reference number
- **Order Date**: When the order was placed
- **Company Name**: Your shop/business name

### Tracking Section
- **Large Tracking Number**: Prominently displayed for easy scanning

### Sender & Recipient Information
- **Ship From**: Your business details (from shop settings)
  - Business name
  - Phone number
  - Email
  - Business address
  
- **Ship To**: Customer details
  - Customer name
  - Phone number
  - Email
  - Shipping address

### Package Contents
- Table listing all items in the order
- Quantities and prices
- Item descriptions

### Summary Sections
- **Shipping Information**:
  - Courier service name
  - Shipping cost
  - Package weight
  - Estimated delivery date
  
- **Payment Summary**:
  - Subtotal
  - Shipping fee
  - Total amount

### Barcode Area
- Tracking number displayed in barcode format
- Space for courier barcode sticker

### Footer
- Generation timestamp
- Order ID reference
- Important notices

## Troubleshooting 🔧

### "Unauthorized token" Error
**Fixed!** The system now:
- Auto-refreshes your authentication token
- Provides clear error messages
- Shows HTML error pages instead of blank screens

If you still see this error:
1. Refresh the page and log in again
2. Try opening the waybill again
3. Check browser console for specific error details

### Popup Blocked
If the waybill doesn't open:
1. Look for popup blocker icon in your browser's address bar
2. Click it and select "Always allow popups from this site"
3. Try opening the waybill again

### Print Quality Issues
For best results:
1. Use **"Save as PDF"** instead of physical printing first
2. Check PDF quality
3. Then print the PDF if needed

### Missing Information
If some fields show "N/A" or are empty:
1. Go to **Shop Profile** settings
2. Fill in:
   - Shop Name
   - Shop Address  
   - Shop Phone
3. Save settings
4. Reopen waybill - information will now appear

## Technical Details 🔧

### File Location
Server: `server/routes.ts` (lines ~2463-2930)
- Endpoint: `GET /api/shipping/waybill/:orderId`
- Authentication: Required via token parameter

Client Components:
- `client/src/components/shipping-dialog.tsx` (Print Waybill button)
- `client/src/pages/orders.tsx` (Direct access button)

### Authentication Flow
1. User clicks "Print Waybill"
2. System gets current Firebase user
3. Refreshes authentication token (force refresh)
4. Opens new window with token in URL query parameter
5. Server validates token
6. Returns HTML waybill if authorized

### Styling
- Uses CSS `@media print` for print-specific styling
- `@page` rules for PDF page setup
- `-webkit-print-color-adjust: exact` for color preservation
- Responsive design with CSS Grid

## Browser Compatibility ✅

Tested and working on:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

All modern browsers support "Save as PDF" functionality.

## Tips for Best Results 💡

1. **Always use "Save as PDF" first** before printing physically
2. **Check the PDF** to ensure all information is correct
3. **Print landscape** if you want larger text (optional)
4. **Use the Close button** in the waybill window when done
5. **Keep the PDF** for your records

## Example Workflow 📝

```
Order Placed → Create Shipment → Print Waybill → Save as PDF → 
Attach to Package → Ship → Customer Tracks
```

## Questions? 

The waybill template is fully functional and ready to use. Simply create a shipment for any order, and the "Print Waybill" button will appear automatically.

---

**Last Updated**: November 29, 2025
**Status**: ✅ Fully Operational
