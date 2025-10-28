// Simple in-memory cache for API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, expiresInMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: expiresInMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  invalidateUser(userId: string): void {
    this.clear(userId);
  }
}

export const cache = new SimpleCache();
