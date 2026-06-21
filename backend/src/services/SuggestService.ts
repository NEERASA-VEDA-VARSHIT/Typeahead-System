import { db } from "../db";
import { searchQueries } from "../db/schema";
import { sql, eq } from "drizzle-orm";
import { CacheManager } from "../cache/CacheManager";
import { Suggestion } from "../cache/CacheNode";

/**
 * SuggestService
 *
 * Handles prefix-based search suggestions with caching.
 *
 * Flow:
 *   1. Normalize input (lowercase, trim)
 *   2. Check distributed cache via consistent hashing
 *   3. Cache hit -> return immediately
 *   4. Cache miss -> query PostgreSQL, rank results, cache, return
 *
 * Ranking score:
 *   score = 0.7 * normalized(total_count) + 0.3 * normalized(recent_count)
 *
 * Normalization uses min-max scaling within the result set so scores
 * range from 0 to 1.
 *
 * Weights (0.7 / 0.3) are configurable via constructor.
 */
export class SuggestService {
  private cacheManager: CacheManager;
  public dbReads = 0;
  private totalCountWeight: number;
  private recentCountWeight: number;

  constructor(
    cacheManager: CacheManager,
    totalCountWeight = 0.7,
    recentCountWeight = 0.3
  ) {
    this.cacheManager = cacheManager;
    this.totalCountWeight = totalCountWeight;
    this.recentCountWeight = recentCountWeight;
  }

  async getSuggestions(prefix: string): Promise<Suggestion[]> {
    const normalized = prefix.trim().toLowerCase();

    if (!normalized) return [];

    // 1. Check cache
    const cached = this.cacheManager.get(normalized);
    if (cached && cached.hit) {
      return cached.data;
    }

    // 2. Cache miss - query database
    this.dbReads++;
    const rows = await db
      .select({
        query: searchQueries.query,
        count: searchQueries.count,
        recentCount: searchQueries.recentCount,
      })
      .from(searchQueries)
      .where(sql`${searchQueries.query} LIKE ${normalized + "%"}`)
      .orderBy(sql`(${searchQueries.count} * ${this.totalCountWeight} + COALESCE(${searchQueries.recentCount}, 0) * ${this.recentCountWeight}) DESC`)
      .limit(10);

    if (rows.length === 0) return [];

    // 3. Compute normalized scores
    const maxCount = Math.max(...rows.map((r) => r.count));
    const maxRecent = Math.max(...rows.map((r) => r.recentCount));

    const suggestions: Suggestion[] = rows.map((r) => {
      const normalizedTotal = maxCount > 0 ? r.count / maxCount : 0;
      const normalizedRecent = maxRecent > 0 ? (r.recentCount ?? 0) / maxRecent : 0;
      const score =
        this.totalCountWeight * normalizedTotal +
        this.recentCountWeight * normalizedRecent;

      return {
        query: r.query,
        count: r.count,
        score: Math.round(score * 100) / 100,
      };
    });

    // 4. Cache result
    this.cacheManager.set(normalized, suggestions);

    return suggestions;
  }
}
