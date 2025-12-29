import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: any;
  timestamp: number;
  userId?: string;
}

class ServerCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL = 120000; // 2 minutes default

  set(key: string, data: any, ttl?: number, userId?: string) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      userId
    });

    // Auto-expire
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl || this.defaultTTL);
  }

  get(key: string, userId?: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // If userId is provided, ensure it matches
    if (userId && entry.userId !== userId) return null;

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear() {
    this.cache.clear();
  }

  clearUserCache(userId: string) {
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.userId === userId) {
        this.cache.delete(key);
      }
    }
  }

  // Delete cache entries matching a pattern (e.g., "/api/categories")
  deleteByPattern(pattern: string) {
    const entries = Array.from(this.cache.keys());
    for (const key of entries) {
      if (key.includes(pattern)) {
        console.log(`[CACHE INVALIDATE] ${key}`);
        this.cache.delete(key);
      }
    }
  }
}

export const serverCache = new ServerCache();

// Middleware to cache GET requests
export function cacheMiddleware(ttl: number = 120000) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const userId = (req as any).user?.uid;
    const cacheKey = `${req.originalUrl}:${userId || 'public'}`;
    
    const cached = serverCache.get(cacheKey, userId);
    if (cached) {
      console.log(`[CACHE HIT] ${req.originalUrl}`);
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      if (res.statusCode === 200) {
        console.log(`[CACHE SET] ${req.originalUrl}`);
        serverCache.set(cacheKey, data, ttl, userId);
      }
      return originalJson(data);
    };

    next();
  };
}
