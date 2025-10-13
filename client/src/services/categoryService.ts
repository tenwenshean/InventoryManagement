// frontend/src/services/categoryService.ts
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebaseClient';
import type { Category, InsertCategory } from '../types';

const CATEGORIES_COLLECTION = 'categories';

// Get all categories
export async function getCategories(): Promise<Category[]> {
  try {
    console.log('📂 Fetching categories from Firestore...');
    const categoriesRef = collection(db, CATEGORIES_COLLECTION);
    const q = query(categoriesRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    
    const categories = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Category;
    });
    
    console.log(`✅ Found ${categories.length} categories`);
    return categories;
  } catch (error) {
    console.error('❌ Error getting categories:', error);
    throw error;
  }
}

// Get single category
export async function getCategory(id: string): Promise<Category | null> {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Category;
    }
    return null;
  } catch (error) {
    console.error('Error getting category:', error);
    throw error;
  }
}

// Create new category
export async function createCategory(categoryData: InsertCategory): Promise<string> {
  try {
    console.log('📂 Creating category in Firestore:', categoryData);
    
    const categoriesRef = collection(db, CATEGORIES_COLLECTION);
    
    const newCategory = {
      ...categoryData,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(categoriesRef, newCategory);
    console.log('✅ Category created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating category:', error);
    throw error;
  }
}

// Update category
export async function updateCategory(id: string, categoryData: Partial<InsertCategory>): Promise<void> {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await updateDoc(docRef, categoryData);
    console.log('✅ Category updated:', id);
  } catch (error) {
    console.error('❌ Error updating category:', error);
    throw error;
  }
}

// Delete category
export async function deleteCategory(id: string): Promise<void> {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
    console.log('✅ Category deleted:', id);
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    throw error;
  }
}