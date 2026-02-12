/**
 * AI Response Cache - Reduces repeated API calls for same context
 * 30 min TTL, in-memory
 */

const MAX_AGE_MS = 1000 * 60 * 30;

class AICacheManager {
  private cache = new Map<string, { data: unknown; timestamp: number }>();

  getCacheKey(feature: string, documentId: string, params: Record<string, unknown> = {}): string {
    return `${feature}_${documentId}_${JSON.stringify(params)}`;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const aiCache = new AICacheManager();
