import { storage } from "../../../firebaseClient";
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
 * Convert image to base64 string for storing in Firestore
 * @param file - The image file to convert
 * @returns Base64 string representation of the image
 */
async function convertImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to convert image to base64"));
    };
    
    reader.readAsDataURL(file);
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
    // Create a reference to the file location
    const storageRef = ref(storage, path);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
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
  
  // Adjust file size limit based on storage method
  const maxSize = STORAGE_METHOD === 'base64' 
    ? 2 * 1024 * 1024  // 2MB for Base64 (to keep Firestore documents small)
    : 5 * 1024 * 1024; // 5MB for Firebase Storage
  
  const maxSizeMB = STORAGE_METHOD === 'base64' ? '2MB' : '5MB';
  
  if (file.size > maxSize) {
    return `Image size must be less than ${maxSizeMB}`;
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
