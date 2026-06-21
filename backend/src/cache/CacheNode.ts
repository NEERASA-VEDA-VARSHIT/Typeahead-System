export interface Suggestion {
  query: string;
  count: number;
  score: number;
}

interface CacheEntry {
  data: Suggestion[];
  createdAt: number;
  expiresAt: number;
}

/**
 * CacheNode
 *
 * Represents a single logical cache instance.
 * Each node holds its own Map of prefix -> CacheEntry.
 * Entries expire after TTL (default: 5 minutes).
 */
export class CacheNode {
  private store = new Map<string, CacheEntry>();
  public readonly name: string;
  private readonly ttlMs: number;
  public hits = 0;
  public misses = 0;

  constructor(name: string, ttlMs = 5 * 60 * 1000) {
    this.name = name;
    this.ttlMs = ttlMs;
  }

  get(key: string): Suggestion[] | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.data;
  }

  set(key: string, data: Suggestion[]): void {
    const now = Date.now();
    this.store.set(key, {
      data,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
