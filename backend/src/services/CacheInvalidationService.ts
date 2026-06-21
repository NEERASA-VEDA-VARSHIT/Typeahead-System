import { CacheManager } from "../cache/CacheManager";

/**
 * CacheInvalidationService
 *
 * After a batch flush updates database counts, cached suggestions may be stale.
 * This service generates all possible prefixes from a query and invalidates
 * each one across the distributed cache.
 *
 * Example: "iphone" generates:
 *   i, ip, iph, ipho, iphon, iphone
 *
 * Why invalidate all prefixes?
 *   The SuggestionDropdown shows results for any typed prefix. If the user
 *   types "iph" and we only invalidated "iphone", the cached "iph" results
 *   would still show stale data. Invalidating all prefixes ensures that
 *   any prefix of an updated query triggers a fresh DB read + ranking.
 */
export class CacheInvalidationService {
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Invalidate all prefix-derived cache entries for a given query.
   */
  invalidateQuery(query: string): void {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;

    // Generate and invalidate each prefix
    for (let i = 1; i <= normalized.length; i++) {
      const prefix = normalized.slice(0, i);
      this.cacheManager.invalidate(prefix);
    }
  }
}
