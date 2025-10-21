# How to Upload Product Photos - User Guide

## For Enterprise Users (Administrators)

### Adding a New Product with Photo

1. **Navigate to Products Page**
   - Click on "Products" in the sidebar menu

2. **Open Add Product Modal**
   - Click the "+ Add Product" button

3. **Upload Product Image**
   - Look for the "Product Image (Optional)" section at the top of the form
   - You'll see a dashed border box with an image icon
   - Click the "Choose Image" button
   - Select an image from your computer (JPG, PNG, GIF, or WebP)
   - The image will preview immediately after selection
   - Maximum file size: 5MB

4. **Fill in Product Details**
   - Enter product name, SKU, category, price, etc.
   - All required fields must be filled

5. **Submit**
   - Click "Create Product" button
   - If an image was selected, you'll see "Uploading Image..." status
   - Product will be created with the uploaded photo

### Editing an Existing Product to Add/Change Photo

1. **Navigate to Inventory or Products Page**
   - Find the product you want to edit

2. **Open Edit Modal**
   - Click the pencil (Edit) icon next to the product

3. **Change Product Image**
   - If the product already has an image, it will be displayed
   - To remove the image, click the "X" button in the top-right corner of the image
   - To add or replace the image, click "Choose Image" button
   - Select a new image from your computer

4. **Update Product**
   - Click "Update Product" button
   - The product will be updated with the new image

### Tips for Best Results
- **Image Quality**: Use high-quality images for better presentation
- **Image Size**: Keep images under 5MB (smaller is better for faster loading)
- **Aspect Ratio**: Square images (1:1 ratio) work best for consistent display
- **File Format**: PNG recommended for products with transparent backgrounds
- **Image Content**: Ensure the product is clearly visible and centered

## For Customer Users

### Viewing Product Photos

1. **Browse Products**
   - Product photos are automatically displayed on the customer portal
   - No login required to view products

2. **Product Display Locations**
   - **Recently Added Section**: Large product cards with prominent images
   - **Search Results**: Compact product cards with smaller images
   - All product listings show the uploaded photos

3. **No Image Available**
   - If a product doesn't have a photo, a default package icon is shown
   - This ensures a consistent browsing experience

## Supported Image Formats
- ✅ JPEG/JPG (`.jpg`, `.jpeg`)
- ✅ PNG (`.png`)
- ✅ GIF (`.gif`)
- ✅ WebP (`.webp`)

## File Size Limits
- Maximum: 5MB per image
- Recommended: 500KB - 2MB for optimal loading speed

## Common Issues & Solutions

### "Please upload a valid image file"
- **Cause**: The file type is not supported
- **Solution**: Convert your image to JPG, PNG, GIF, or WebP format

### "Image size must be less than 5MB"
- **Cause**: The file is too large
- **Solution**: Compress the image using tools like:
  - Online: TinyPNG, Compressor.io, Squoosh
  - Desktop: Photoshop, GIMP, Preview (Mac)

### Image Upload Fails
- **Possible Causes**:
  - Poor internet connection
  - Browser issues
  - Firebase Storage configuration
- **Solutions**:
  - Check your internet connection
  - Try refreshing the page
  - Try a different browser
  - Contact system administrator

### Image Doesn't Display on Customer Portal
- **Possible Causes**:
  - Upload failed but product was created
  - Browser cache issue
- **Solutions**:
  - Edit the product and re-upload the image
  - Clear browser cache and refresh
  - Check browser console for errors

## Best Practices

### For Product Photography
1. **Use Good Lighting**: Natural light works best
2. **Clean Background**: White or neutral backgrounds are preferred
3. **Multiple Angles**: Consider showing product from different angles (future feature)
4. **Consistent Style**: Use similar backgrounds and lighting for all products
5. **Show Scale**: Include size reference when helpful

### For Image Management
1. **Organize Files**: Name your images clearly before uploading
2. **Optimize First**: Compress images before uploading
3. **Backup Images**: Keep original high-res versions elsewhere
4. **Update Regularly**: Update product images when product changes
5. **Delete Unused**: Remove old images to save storage space

## Technical Details

### Where Images Are Stored
- Images are stored in Firebase Storage
- Storage path: `products/{timestamp}_{filename}`
- Each image gets a unique, publicly accessible URL

### Image Display Specifications
- **Inventory Table**: 40x40px thumbnails
- **Customer Recently Added**: Full-width, 248px height
- **Customer Search Results**: Full-width, 132px height
- All images use `object-cover` to maintain aspect ratio

### Performance
- Images load on-demand (not preloaded)
- Firebase provides automatic CDN distribution
- Images are cached by browser for faster subsequent loads

## Need Help?
If you encounter any issues not covered in this guide:
1. Check the browser console for error messages
2. Verify Firebase Storage is properly configured
3. Contact your system administrator
4. Refer to `PHOTO_UPLOAD_IMPLEMENTATION.md` for technical details
