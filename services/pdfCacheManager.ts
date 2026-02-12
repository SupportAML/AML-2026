/**
 * PDF Cache Manager - Reduces Firebase Storage egress to near zero
 * Uses ArrayBuffer (not Blob/URL) so PDF.js never triggers ANY network fetch
 * Two-tier cache: Memory (fast) + IndexedDB (persistent)
 */

interface CachedPDFItem {
  key: string;
  data: ArrayBuffer;
  size: number;
  timestamp: number;
  metadata?: Record<string, string>;
}

class PDFCacheManager {
  private memoryCache = new Map<string, ArrayBuffer>();
  private maxMemoryItems = 10;
  private dbName = 'pdf_cache_db';
  private storeName = 'pdfs_v2';
  private maxCacheSize = 150 * 1024 * 1024; // 150MB
  private maxCacheItems = 25;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async initDB(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 3);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          const store = database.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
    return this.initPromise;
  }

  /**
   * Get cached PDF as ArrayBuffer. When found, PDF.js uses { data } - ZERO network.
   */
  async getCachedPDF(cacheKey: string): Promise<ArrayBuffer | null> {
    if (this.memoryCache.has(cacheKey)) {
      console.log(`[PDF Cache HIT - Memory] ${cacheKey}`);
      const buf = this.memoryCache.get(cacheKey)!;
      // PDF.js DETACHES the buffer when used - always return a fresh copy
      return buf.slice(0);
    }

    const cached = await this.getFromIndexedDB(cacheKey);
    if (cached) {
      console.log(`[PDF Cache HIT - IndexedDB] ${cacheKey}`);
      const copy = cached.data.slice(0);
      this.addToMemoryCache(cacheKey, copy);
      return copy;
    }

    console.log(`[PDF Cache MISS] ${cacheKey}`);
    return null;
  }

  async cachePDF(cacheKey: string, data: ArrayBuffer, metadata: Record<string, string> = {}): Promise<void> {
    this.addToMemoryCache(cacheKey, data);
    await this.addToIndexedDB(cacheKey, data, metadata);
    await this.enforceCacheLimits();
  }

  private addToMemoryCache(key: string, data: ArrayBuffer): void {
    if (this.memoryCache.size >= this.maxMemoryItems && !this.memoryCache.has(key)) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey !== undefined) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, data);
  }

  private async getFromIndexedDB(key: string): Promise<CachedPDFItem | null> {
    try {
      await this.initDB();
      if (!this.db) return null;
      return await new Promise((resolve, reject) => {
        const tx = this.db!.transaction([this.storeName], 'readonly');
        const request = tx.objectStore(this.storeName).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[PDF Cache] IndexedDB read failed:', e);
      return null;
    }
  }

  private async addToIndexedDB(key: string, data: ArrayBuffer, metadata: Record<string, string> = {}): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;
      const item: CachedPDFItem = {
        key,
        data,
        size: data.byteLength,
        timestamp: Date.now(),
        metadata
      };
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction([this.storeName], 'readwrite');
        const request = tx.objectStore(this.storeName).put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[PDF Cache] IndexedDB write failed:', e);
    }
  }

  private async enforceCacheLimits(): Promise<void> {
    if (!this.db) return;
    try {
      const allItems: CachedPDFItem[] = await new Promise((resolve, reject) => {
        const tx = this.db!.transaction([this.storeName], 'readonly');
        const request = tx.objectStore(this.storeName).index('timestamp').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (allItems.length === 0) return;
      allItems.sort((a, b) => a.timestamp - b.timestamp);
      let totalSize = allItems.reduce((s, i) => s + i.size, 0);
      let count = allItems.length;
      const toDelete: string[] = [];
      for (const item of allItems) {
        if (count <= this.maxCacheItems && totalSize <= this.maxCacheSize) break;
        toDelete.push(item.key);
        totalSize -= item.size;
        count--;
      }
      if (toDelete.length === 0) return;
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        toDelete.forEach((k) => store.delete(k));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[PDF Cache] enforceCacheLimits failed:', e);
    }
  }

  clearCache(): void {
    this.memoryCache.clear();
    if (this.db) {
      try {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        tx.objectStore(this.storeName).clear();
      } catch {}
    }
  }
}

export const pdfCacheManager = new PDFCacheManager();
