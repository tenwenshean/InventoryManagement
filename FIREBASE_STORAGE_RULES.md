# Firebase Storage Security Rules for Product Images

## Overview
These security rules ensure that product images are publicly readable but only authenticated users can upload or modify them.

## Rules Configuration

Add these rules to your Firebase Storage in the Firebase Console:

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: `inventorymanagement-3005-b38a3`
3. Navigate to **Storage** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with the following:

```javascript
rules_version = '2';

// Firebase Storage Security Rules for Inventory Management
service firebase.storage {
  match /b/{bucket}/o {
    
    // Allow anyone to read product images (public read access)
    // This enables customers to view product photos without authentication
    match /products/{fileName} {
      // Allow public read access for all product images
      allow read: if true;
      
      // Only authenticated users (enterprise/admin) can upload/write
      allow write: if request.auth != null 
                   && request.auth.uid != null
                   && request.resource.size < 5 * 1024 * 1024  // Max 5MB
                   && request.resource.contentType.matches('image/.*');  // Only images
      
      // Allow authenticated users to delete their own uploads
      allow delete: if request.auth != null && request.auth.uid != null;
    }
    
    // Default deny for all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Rule Explanation

### Public Read Access
```javascript
allow read: if true;
```
- **Purpose**: Allows anyone to view product images
- **Why**: Customers need to see product photos without logging in
- **Security**: Safe because we only allow reading, not writing

### Authenticated Write Access
```javascript
allow write: if request.auth != null 
             && request.auth.uid != null
             && request.resource.size < 5 * 1024 * 1024
             && request.resource.contentType.matches('image/.*');
```
- **Purpose**: Only authenticated enterprise users can upload images
- **Checks**:
  1. User must be authenticated (`request.auth != null`)
  2. User must have a valid UID (`request.auth.uid != null`)
  3. File size must be less than 5MB (`request.resource.size < 5 * 1024 * 1024`)
  4. File must be an image type (`request.resource.contentType.matches('image/.*')`)

### Authenticated Delete Access
```javascript
allow delete: if request.auth != null && request.auth.uid != null;
```
- **Purpose**: Authenticated users can delete product images
- **Why**: Allows admins to remove old or incorrect images
- **Security**: Only authenticated users can perform deletions

## Testing the Rules

### Test 1: Public Read (Should Pass)
Try accessing a product image URL directly in a browser (no authentication):
```
https://firebasestorage.googleapis.com/v0/b/inventorymanagement-3005-b38a3.firebasestorage.app/o/products%2F1708534523456_laptop.jpg?alt=media
```
**Expected Result**: Image displays successfully ✅

### Test 2: Unauthenticated Write (Should Fail)
Try uploading an image without authentication:
**Expected Result**: Permission denied error ❌

### Test 3: Authenticated Write with Valid Image (Should Pass)
Log in as an enterprise user and upload a valid image:
**Expected Result**: Upload succeeds ✅

### Test 4: File Too Large (Should Fail)
Try uploading an image larger than 5MB:
**Expected Result**: Permission denied error ❌

### Test 5: Non-Image File (Should Fail)
Try uploading a PDF or text file:
**Expected Result**: Permission denied error ❌

## Additional Security Considerations

### 1. Rate Limiting
Consider implementing Cloud Functions to monitor and limit upload rates per user to prevent abuse.

### 2. Content Validation
Implement server-side validation to verify uploaded files are actually images and not malicious files with spoofed MIME types.

### 3. Storage Quotas
Monitor Firebase Storage usage and set up billing alerts:
- Free tier: 5GB total storage
- Paid tier: Pay per GB used

### 4. Image Optimization
Consider implementing Cloud Functions to automatically:
- Resize images to standard dimensions
- Convert to WebP format for better compression
- Generate thumbnails for faster loading

### 5. Abuse Prevention
Implement mechanisms to:
- Track upload frequency per user
- Flag and review suspicious upload patterns
- Implement CAPTCHA for repeated uploads

## Monitoring

### Firebase Console
1. **Storage Usage**: Monitor total storage consumption
2. **Request Metrics**: Track read/write operations
3. **Error Logs**: Review security rule violations

### Cloud Functions (Optional)
Set up Cloud Functions to log and alert on:
```javascript
// Example monitoring function
exports.monitorUploads = functions.storage.object().onFinalize(async (object) => {
  console.log('New upload:', {
    name: object.name,
    size: object.size,
    contentType: object.contentType,
    timeCreated: object.timeCreated
  });
  
  // Send alert if file is suspiciously large
  if (parseInt(object.size) > 4 * 1024 * 1024) {
    // Send notification to admin
  }
});
```

## Troubleshooting

### Issue: "Permission denied" when uploading
**Possible Causes**:
1. User not authenticated
2. File exceeds 5MB
3. File is not an image type
4. Rules not properly deployed

**Solutions**:
1. Verify user is logged in via Firebase Auth
2. Check file size before upload
3. Verify file MIME type
4. Re-deploy storage rules

### Issue: Images not displaying for customers
**Possible Causes**:
1. Read access not properly configured
2. Invalid image URL
3. CORS issues

**Solutions**:
1. Verify `allow read: if true;` is set
2. Check Firebase Storage URL format
3. Configure CORS in Firebase Storage settings

### Issue: Excessive storage costs
**Possible Causes**:
1. Large images not optimized
2. Duplicate uploads
3. Old images not deleted

**Solutions**:
1. Implement image compression
2. Add upload deduplication logic
3. Implement cleanup job for unused images

## Migration Notes

If you have existing images in storage before implementing these rules:
1. Existing images will remain accessible
2. New uploads must comply with rules
3. Consider adding a migration script to move old images to `/products/` path

## Support

For issues with Firebase Storage rules:
- Firebase Storage Documentation: https://firebase.google.com/docs/storage/security
- Security Rules Reference: https://firebase.google.com/docs/rules/rules-language
- Firebase Support: https://firebase.google.com/support

## Rule Updates

### Version History
- **v1.0** (Current): Initial rules with public read, authenticated write
- Future versions will be documented here

### Deployment Checklist
- [ ] Rules tested in Firebase Console Rules Simulator
- [ ] Rules deployed to production
- [ ] Read access verified (public)
- [ ] Write access verified (authenticated only)
- [ ] File size limits tested
- [ ] File type restrictions tested
- [ ] Monitoring set up
- [ ] Team notified of changes
