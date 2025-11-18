# Shop Profile Setup Guide

## Overview
Enterprise users can now fully customize their shop page with branding, contact information, and social media links. Customers visiting your shop will see a professional, customized storefront.

## Features Added

### 1. Shop Profile Settings (Enterprise Side)
Located in **Settings > Shop Profile**, enterprise users can configure:

#### Shop Description
- Multi-line textarea for shop description
- Displayed prominently on the shop page
- Use this to tell customers about your business and what makes you unique

#### Shop Images
- **Banner Image**: 1200x300px recommended, appears at top of shop page
- **Logo Image**: 200x200px recommended, displays as circular profile image
- Direct image upload with Firebase Storage integration
- Live preview of uploaded images

#### Contact Information
- Email address
- Phone number
- Physical address
- Website URL

#### Social Media Links
- Facebook profile/page URL
- Instagram profile URL
- Twitter/X profile URL

### 2. Enhanced Shop Page (Customer Side)
When customers click "Visit Shop" from product details or search for shops, they now see:

#### Visual Elements
- **Shop Banner**: Full-width banner image at the top (if configured)
- **Shop Logo**: Circular profile image next to shop name
- Fallback to default icons if images not uploaded

#### Information Sections
- **About This Shop**: Displays shop description in a card
- **Contact Information Card**: 
  - Email (clickable mailto: link)
  - Phone (clickable tel: link)
  - Address
  - Website (opens in new tab)
  - Social media icons (clickable links to profiles)

#### Products Display
- Grid layout of all products from the shop
- Add to cart functionality
- Out of stock indicators
- Subscribe button to receive coupon notifications

## How to Set Up Your Shop Profile

### Step 1: Navigate to Settings
1. Login to your enterprise account
2. Click on **Settings** in the sidebar
3. Scroll down to the **Shop Profile** section

### Step 2: Add Shop Description
1. Enter a description of your business in the textarea
2. Describe your products, services, and what makes you special
3. This appears as the "About This Shop" section on your public shop page

### Step 3: Upload Images
1. **Banner**: Click "Upload Banner" and select a landscape image (1200x300px recommended)
2. **Logo**: Click "Upload Logo" and select a square image (200x200px recommended)
3. Images are immediately previewed after upload
4. Don't forget to click "Save Changes" after uploading

### Step 4: Add Contact Information
1. Fill in your email, phone, address, and website
2. All fields are optional but help customers reach you
3. Links are automatically made clickable on the shop page

### Step 5: Add Social Media Links
1. Paste full URLs to your social media profiles
2. Icons will appear on your shop page with clickable links
3. Helps customers follow and engage with your brand

### Step 6: Save Your Changes
1. Click the **Save Changes** button at the top of the settings page
2. You'll see a success notification
3. Your shop profile is now live and visible to customers!

## Testing Your Shop Profile

### View Your Shop as a Customer
1. Open your shop in customer mode by visiting: `/shop/[your-user-id]`
2. Or ask a customer to search for your shop name
3. Click "Visit Shop" from any of your product detail cards

### What to Check
- ✓ Banner image displays correctly at top
- ✓ Logo appears as circular profile image
- ✓ Shop description shows in "About This Shop" card
- ✓ Contact information is accurate and links work
- ✓ Social media icons link to correct profiles
- ✓ All products are displayed in grid
- ✓ Subscribe button works for customers

## Technical Details

### Backend Changes
- **API Endpoint**: `PUT /api/users/:userId/settings`
- **Fields Stored in Firestore**:
  - `companyName` (top-level and in settings)
  - `shopDescription` (top-level and in settings)
  - `shopBannerUrl` (top-level and in settings)
  - `shopLogoUrl` (top-level and in settings)
  - `shopEmail` (in settings)
  - `shopPhone` (in settings)
  - `shopAddress` (in settings)
  - `shopWebsite` (in settings)
  - `shopFacebook` (in settings)
  - `shopInstagram` (in settings)
  - `shopTwitter` (in settings)

### Frontend Files Modified
1. **`client/src/pages/settings.tsx`**
   - Added shop profile form section
   - Image upload handlers for banner and logo
   - State management for all shop profile fields
   - Saves all data to backend API

2. **`client/src/pages/shop-details.tsx`**
   - Enhanced layout with banner and logo display
   - About section showing shop description
   - Contact information card with clickable links
   - Social media icons with external links

3. **`api/index.js`**
   - `handleUpdateUserSettings`: Accepts and stores all shop profile fields
   - `handleGetUser`: Returns shop profile data for public viewing

### Image Storage
- Images uploaded via `uploadImage` function from `@/lib/imageUpload`
- Stored in Firebase Storage under folders:
  - `shop-banners/` for banner images
  - `shop-logos/` for logo images
- URLs saved to Firestore user document

## Best Practices

### Images
- Use high-quality images that represent your brand
- Banner: 1200x300px (4:1 aspect ratio) for best display
- Logo: 200x200px square images work perfectly
- Keep file sizes reasonable (under 2MB) for fast loading

### Description
- Keep it concise but informative (2-3 paragraphs)
- Highlight your unique selling points
- Mention your product categories
- Include your business values or mission

### Contact Information
- Use a professional email address
- Include your business phone, not personal
- Complete address helps with local customers
- Website should be your main business site

### Social Media
- Use full URLs (e.g., https://facebook.com/yourpage)
- Keep profiles active and updated
- Only add platforms you actively use
- Match your branding across all platforms

## Customer Experience

### Discovery
Customers can find your shop by:
1. Clicking "Visit Shop" on any of your product cards
2. Searching for your shop name on the customer landing page
3. Direct link: `/shop/[your-user-id]`

### Subscription
- Customers can subscribe to receive coupon notifications
- Bell icon shows subscription status
- One-click subscribe/unsubscribe
- Notifications appear in their notification bell dropdown

### Shopping
- Browse all your products in grid layout
- Click products to see details
- Add to cart directly from shop page
- See real-time stock availability

## Troubleshooting

### Images Not Showing
- Check that you clicked "Save Changes" after uploading
- Verify image uploaded successfully (you should see preview)
- Ensure images are valid formats (jpg, png, gif, webp)
- Clear browser cache and reload

### Shop Shows "Not Found"
- Ensure you've saved at least the company name in settings
- Check that your user account is active
- Verify the shop URL has the correct user ID

### Contact Links Not Working
- Ensure URLs include `https://` for website and social media
- Phone numbers should include country code for best compatibility
- Email addresses should be valid format

### Updates Not Appearing
- Click "Save Changes" button at top of settings
- Wait a few seconds for data to sync
- Refresh the shop page
- Check browser console for any errors

## Future Enhancements (Potential)
- Shop theme color customization
- Business hours display
- Product categories/collections
- Featured products section
- Customer reviews and ratings
- Shop policies (shipping, returns, etc.)
- Multiple banner images (carousel)
- Video introduction
- Team member profiles

## Support
If you encounter issues:
1. Check this guide for solutions
2. Verify all required fields are filled
3. Test in different browsers
4. Check Firebase Storage permissions
5. Review browser console for error messages
