/**
 * PDF Cache Manager - Reduces Firebase Storage egress
 * Two-tier cache: Memory (fast) + IndexedDB (persistent)
 */

interface CachedPDFItem {
  key: string;
  blob: Blob;
  size: number;
  timestamp: number;
  metadata?: Record<string, string>;
}

class PDFCacheManager {
  private memoryCache = new Map<string, Blob>();
  private maxMemoryItems = 5;
  private dbName = 'pdf_cache_db';
  private storeName = 'pdfs';
  private maxCacheSize = 100 * 1024 * 1024; // 100MB limit
  private maxCacheItems = 20;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async initDB(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
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
   * Get a cached PDF blob if available.
   * @param cacheKey - Stable key (e.g. pdf_${docId})
   * @returns Blob if cached, null if cache miss
   */
  async getCachedPDF(cacheKey: string): Promise<Blob | null> {
    // Check memory cache first
    if (this.memoryCache.has(cacheKey)) {
      console.log(`[PDF Cache HIT - Memory] ${cacheKey}`);
      const blob = this.memoryCache.get(cacheKey)!;
      // LRU: move to end (delete + re-add)
      this.memoryCache.delete(cacheKey);
      this.addToMemoryCache(cacheKey, blob);
      return blob;
    }

    // Check IndexedDB
    const cached = await this.getFromIndexedDB(cacheKey);
    if (cached) {
      console.log(`[PDF Cache HIT - IndexedDB] ${cacheKey}`);
      this.addToMemoryCache(cacheKey, cached.blob);
      return cached.blob;
    }

    console.log(`[PDF Cache MISS] ${cacheKey}`);
    return null;
  }

  /**
   * Store a PDF blob in the cache.
   */
  async cachePDF(cacheKey: string, blob: Blob, metadata: Record<string, string> = {}): Promise<void> {
    this.addToMemoryCache(cacheKey, blob);
    await this.addToIndexedDB(cacheKey, blob, metadata);
    await this.enforceCacheLimits();
  }

  private addToMemoryCache(key: string, blob: Blob): void {
    // Evict oldest if at capacity
    if (this.memoryCache.size >= this.maxMemoryItems && !this.memoryCache.has(key)) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.memoryCache.delete(firstKey);
      }
    }
    this.memoryCache.set(key, blob);
  }

  private async getFromIndexedDB(key: string): Promise<CachedPDFItem | null> {
    await this.initDB();
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private async addToIndexedDB(key: string, blob: Blob, metadata: Record<string, string> = {}): Promise<void> {
    await this.initDB();
    if (!this.db) return;
    const data: CachedPDFItem = {
      key,
      blob,
      size: blob.size,
      timestamp: Date.now(),
      metadata
    };
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async enforceCacheLimits(): Promise<void> {
    if (!this.db) return;

    const allItems: CachedPDFItem[] = await new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (allItems.length === 0) return;

    // Sort by timestamp (oldest first)
    allItems.sort((a, b) => a.timestamp - b.timestamp);

    let totalSize = allItems.reduce((sum, item) => sum + item.size, 0);
    let itemCount = allItems.length;

    // Remove oldest items if over limits
    const toDelete: string[] = [];
    for (const item of allItems) {
      if (itemCount <= this.maxCacheItems && totalSize <= this.maxCacheSize) break;
      toDelete.push(item.key);
      totalSize -= item.size;
      itemCount--;
    }

    if (toDelete.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      toDelete.forEach((key) => store.delete(key));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  clearCache(): void {
    this.memoryCache.clear();
    if (this.db) {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      transaction.objectStore(this.storeName).clear();
    }
  }
}

export const pdfCacheManager = new PDFCacheManager();
