# Easy Parcel Integration - Shipping & Waybill System

This document explains the Easy Parcel integration for shipping management and waybill printing in the Inventory Management System.

## 🚀 Features

### For Sellers (Enterprise Users)
- **Create Shipments**: Generate shipping labels through Easy Parcel API
- **Print Waybills**: Download and print waybills in PDF format
- **Multiple Couriers**: Choose from various courier services (DHL, GDEX, NinjaVan, etc.)
- **Bulk Waybill**: Print multiple waybills at once
- **Real-time Rates**: Get shipping rates based on weight and destination
- **Order Tracking**: Share tracking numbers with customers automatically

### For Customers
- **Track Orders**: Real-time tracking of shipment status
- **Tracking Timeline**: View complete delivery history with timestamps
- **Estimated Delivery**: See expected delivery dates
- **Courier Information**: Know which courier is handling the delivery

## 📋 Setup Instructions

### 1. Get Easy Parcel API Key

1. Visit [Easy Parcel](https://www.easyparcel.com/)
2. Sign up for a business account
3. Navigate to API Settings in your dashboard
4. Generate an API key

### 2. Configure Environment Variables

Add your Easy Parcel API key to your environment variables:

```env
EASYPARCEL_API_KEY=your_easyparcel_api_key_here
```

**For Vercel deployment:**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add `EASYPARCEL_API_KEY` with your key value
4. Redeploy your application

**For local development:**
Add the variable to your `.env` file in the root directory.

### 3. Complete Business Profile

Sellers must complete their business profile with a valid address:

1. Go to **Settings** page
2. Fill in **Business Address** field
3. Ensure the address includes a valid 5-digit Malaysian postcode
4. Save settings

## 🎯 How to Use

### Creating a Shipment (Seller)

1. **Navigate to Orders Page**
   - Go to the "Order Management" page
   - Find the order you want to ship

2. **Create Shipment**
   - Click "Create Shipment" button on a pending order
   - Enter package weight (in kg)
   - Select courier service from available options
   - (Optional) Add insurance value for high-value items
   - Click "Create Shipment"

3. **Print Waybill**
   - After shipment creation, waybill PDF will open automatically
   - You can also click "Print Waybill" button anytime
   - Attach the printed waybill to your package

4. **Ship the Package**
   - The customer receives automatic notification with tracking number
   - Package is ready for courier pickup

### Tracking a Shipment (Customer)

1. **View Orders**
   - Go to Customer Profile page
   - View your order history

2. **Track Order**
   - Find orders with shipment information
   - Click "Track Order" button
   - View real-time tracking updates

3. **Tracking Information**
   - Current status
   - Tracking timeline with locations
   - Estimated delivery date
   - Courier name

## 🔧 API Endpoints

### Create Shipment
```
POST /api/shipping/create
```
**Body:**
```json
{
  "orderId": "order_id_here",
  "serviceId": "courier_service_id",
  "weight": 1.5,
  "insuranceValue": 100
}
```

### Track Shipment
```
GET /api/shipping/track/:trackingNo
```

### Download Waybill
```
GET /api/shipping/waybill/:orderId
```
Returns PDF file

### Get Available Services
```
GET /api/shipping/services?pickupPostcode=12345&dropPostcode=54321&weight=1.5
```

### Bulk Waybill Download
```
POST /api/shipping/bulk-waybill
```
**Body:**
```json
{
  "orderIds": ["order1", "order2", "order3"]
}
```
Returns combined PDF file

## 📦 Database Schema Updates

The `orders` collection now includes these new fields:

```typescript
{
  // Existing fields...
  shipmentId: string,           // Tracking number
  easyParcelOrderId: string,    // Easy Parcel's order ID
  waybillUrl: string,           // URL to waybill PDF
  courier: string,              // Courier name (e.g., "DHL")
  estimatedDelivery: string,    // ISO date string
  shippingCost: number,         // Shipping cost in MYR
  // ...
}
```

## 🎨 UI Components

### ShippingDialog Component
- Located at: `client/src/components/shipping-dialog.tsx`
- Used by sellers to create shipments
- Shows available courier services with pricing
- Handles shipment creation and waybill generation

### TrackingDialog Component
- Located at: `client/src/components/tracking-dialog.tsx`
- Used by customers to track orders
- Displays tracking timeline
- Shows current status and estimated delivery

## 🔐 Security Features

- **Authentication Required**: All shipping endpoints require valid user authentication
- **Authorization Checks**: Users can only create shipments for their own orders
- **API Key Protection**: Easy Parcel API key is stored securely in environment variables
- **Order Ownership Verification**: Both sellers and customers can only access their own data

## 📊 Supported Couriers

Easy Parcel supports multiple courier services:
- **DHL**: International and domestic shipping
- **GDEX**: Malaysia's leading courier
- **NinjaVan**: Fast local delivery
- **Pos Laju**: National postal service
- **J&T Express**: E-commerce delivery
- **City-Link Express**: Next-day delivery
- And many more...

The available couriers depend on:
- Pickup location
- Delivery location
- Package weight
- Service availability

## 🛠️ Troubleshooting

### "Shipping service not configured" Error
- **Cause**: Easy Parcel API key is missing
- **Solution**: Add `EASYPARCEL_API_KEY` to environment variables

### "No courier services available" Error
- **Causes**: 
  - Invalid pickup or delivery postcode
  - Package weight too high/low
  - Service not available for the route
- **Solution**: 
  - Verify business address has valid postcode
  - Check customer shipping address format
  - Adjust package weight

### "Please complete your business profile" Error
- **Cause**: Business address not set in seller profile
- **Solution**: Go to Settings and add complete business address with postcode

### Waybill Not Printing
- **Causes**:
  - Pop-up blocker enabled
  - PDF viewer not available
- **Solution**:
  - Allow pop-ups for this site
  - Check browser PDF settings
  - Try "View Waybill Online" button

## 📝 Address Format

For best results, use this address format:

```
Street Address, Building/Unit Number
Area/District
Postcode City
State
Country
```

Example:
```
No. 123, Jalan ABC, Taman XYZ
Bandar Utama
47800 Petaling Jaya
Selangor
Malaysia
```

The system automatically extracts:
- Postcode (5 digits)
- City
- State
- Country

## 🔄 Workflow

### Complete Shipping Workflow

```
1. Customer places order
   ↓
2. Seller receives order notification
   ↓
3. Seller clicks "Create Shipment"
   ↓
4. System fetches available courier services
   ↓
5. Seller selects courier and confirms
   ↓
6. Easy Parcel creates shipment
   ↓
7. Waybill PDF generated automatically
   ↓
8. Tracking number saved to order
   ↓
9. Customer notified with tracking info
   ↓
10. Seller prints waybill and ships package
   ↓
11. Customer can track order in real-time
   ↓
12. Package delivered
```

## 🌟 Best Practices

1. **Complete Profile First**: Ensure business address is complete before creating shipments
2. **Accurate Weight**: Enter accurate package weight for correct pricing
3. **Insurance for High-Value Items**: Add insurance for items over RM 500
4. **Print Immediately**: Print waybill right after creation to avoid delays
5. **Bulk Processing**: Use bulk waybill for multiple orders to save time
6. **Track Regularly**: Check tracking status to proactively handle delivery issues

## 📞 Support

For Easy Parcel API issues:
- Email: api@easyparcel.com
- Documentation: https://docs.easyparcel.com/

For integration issues:
- Check console logs for detailed error messages
- Verify environment variables are set correctly
- Ensure business profile is complete

## 🚀 Future Enhancements

Planned features:
- [ ] Automatic courier selection based on best rates
- [ ] Scheduled pickups
- [ ] Return shipment management
- [ ] Shipping reports and analytics
- [ ] Webhook integration for real-time tracking updates
- [ ] International shipping support
- [ ] Batch shipment creation from order list
