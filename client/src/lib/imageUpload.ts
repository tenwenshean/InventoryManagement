import { storage } from "@/lib/firebaseClient";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Toggle between Firebase Storage and Base64 encoding
// Set to 'base64' for free tier, 'firebase' for Firebase Storage
const STORAGE_METHOD: 'firebase' | 'base64' = 'base64'; // Change to 'firebase' if you want to use Firebase Storage

/**
 * Upload an image file - uses either Firebase Storage or Base64 encoding
 * @param file - The image file to upload
 * @param path - The storage path (e.g., 'products/productId') - only used for Firebase Storage
 * @returns The download URL (Firebase) or base64 string (Base64 method)
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  if (STORAGE_METHOD === 'base64') {
    // Base64 method - completely free, stores in Firestore
    return await convertImageToBase64(file);
  } else {
    // Firebase Storage method - requires Firebase Storage to be enabled
    return await uploadToFirebaseStorage(file, path);
  }
}

/**
 * Compress an image file to reduce its size
 * @param file - The image file to compress
 * @param maxSizeMB - Maximum size in MB (default 1MB)
 * @param maxWidthOrHeight - Maximum width or height in pixels (default 1920)
 * @returns Compressed image as a File object
 */
async function compressImage(
  file: File, 
  maxSizeMB: number = 1, 
  maxWidthOrHeight: number = 1920
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = (height * maxWidthOrHeight) / width;
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = (width * maxWidthOrHeight) / height;
            height = maxWidthOrHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Start with high quality
        let quality = 0.9;
        const targetSize = maxSizeMB * 1024 * 1024;

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // If size is acceptable or quality is already low, use this version
              if (blob.size <= targetSize || quality <= 0.5) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                // Reduce quality and try again
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };

        tryCompress();
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Convert image to base64 string for storing in Firestore
 * @param file - The image file to convert
 * @returns Base64 string representation of the image
 */
async function convertImageToBase64(file: File): Promise<string> {
  // First compress the image to reduce size
  const maxSizeMB = STORAGE_METHOD === 'base64' ? 0.8 : 2; // Target smaller size for base64
  const compressedFile = await compressImage(file, maxSizeMB, 1920);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to convert image to base64"));
    };
    
    reader.readAsDataURL(compressedFile);
  });
}

/**
 * Upload to Firebase Storage (original method)
 * @param file - The image file to upload
 * @param path - The storage path
 * @returns The download URL of the uploaded image
 */
async function uploadToFirebaseStorage(file: File, path: string): Promise<string> {
  try {
    // Compress image before uploading to Firebase Storage
    const compressedFile = await compressImage(file, 2, 1920);
    
    // Create a reference to the file location
    const storageRef = ref(storage, path);
    
    // Upload the compressed file
    const snapshot = await uploadBytes(storageRef, compressedFile);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw new Error("Failed to upload image");
  }
}

/**
 * Delete an image from Firebase Storage
 * Note: Base64 images are stored in Firestore and will be deleted when the product is deleted
 * @param imageUrl - The full URL of the image to delete
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  if (STORAGE_METHOD === 'base64') {
    // Base64 images are stored directly in Firestore
    // They'll be deleted when the product document is deleted
    console.log("Base64 image will be deleted with the product document");
    return;
  }
  
  try {
    // Extract the path from the URL
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    console.error("Error deleting image:", error);
    // Don't throw - image might already be deleted or not exist
  }
}

/**
 * Validate image file before upload
 * @param file - The file to validate
 * @returns Error message if invalid, null if valid
 */
export function validateImageFile(file: File): string | null {
  // Check file type
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return "Please upload a valid image file (JPEG, PNG, GIF, or WebP)";
  }
  
  // Much more relaxed file size limit since we compress automatically
  const maxSize = 10 * 1024 * 1024; // 10MB - we'll compress it down
  
  if (file.size > maxSize) {
    return `Image size must be less than 10MB (don't worry, we'll compress it automatically)`;
  }
  
  return null;
}

/**
 * Get the current storage method being used
 * @returns 'firebase' or 'base64'
 */
export function getStorageMethod(): 'firebase' | 'base64' {
  return STORAGE_METHOD;
}
