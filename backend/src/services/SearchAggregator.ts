import { pool } from "../db";
import { CacheInvalidationService } from "./CacheInvalidationService";

/**
 * SearchAggregator
 *
 * CRITICAL COMPONENT for batch write optimization.
 *
 * Problem:
 *   Every user search would normally write to the database synchronously.
 *   At scale (1000s of searches/sec), this creates massive DB write pressure.
 *
 * Solution:
 *   Accumulate search counts in an in-memory buffer (Map<string, number>).
 *   Flush to database only when either:
 *     - Buffer size >= 500 entries
 *     - 10 seconds have elapsed since last flush
 *
 * This reduces N individual writes to 1 batched UPSERT per distinct query.
 * Example: 500 searches for "iphone" becomes 1 UPSERT instead of 500 writes.
 *
 * Failure tradeoff:
 *   If the application crashes before a flush, buffered counts are lost.
 *   In production, use a durable queue (Kafka, RabbitMQ) to persist
 *   search events before acknowledgement.
 */
export class SearchAggregator {
  private buffer = new Map<string, number>();
  private lastFlushTime = Date.now();
  private flushIntervalMs: number;
  private maxBufferSize: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private cacheInvalidation: CacheInvalidationService;
  public dbWrites = 0;
  public totalSearches = 0;

  constructor(
    cacheInvalidation: CacheInvalidationService,
    flushIntervalMs = 10_000,
    maxBufferSize = 500
  ) {
    this.cacheInvalidation = cacheInvalidation;
    this.flushIntervalMs = flushIntervalMs;
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Record a search query in the in-memory buffer.
   * Called synchronously on POST /search - returns immediately.
   * No DB write happens here.
   */
  recordSearch(query: string): void {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;

    const current = this.buffer.get(normalized) ?? 0;
    this.buffer.set(normalized, current + 1);
    this.totalSearches++;

    if (this.buffer.size >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Start the periodic flush timer.
   */
  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  /**
   * Stop the flush timer.
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush the buffer to PostgreSQL.
   *
   * Uses a bulk UPSERT to update counts:
   *   INSERT INTO search_queries (query, count, recent_count, updated_at)
   *   VALUES (...)
   *   ON CONFLICT (query) DO UPDATE SET
   *     count = search_queries.count + EXCLUDED.count,
   *     recent_count = search_queries.recent_count + EXCLUDED.count,
   *     updated_at = EXCLUDED.updated_at
   *
   * Also inserts into search_events for trending recency tracking.
   * After flush, invalidates affected cache entries to ensure fresh data.
   */
  async flush(): Promise<void> {
    if (this.buffer.size === 0) return;

    const snapshot = new Map(this.buffer);
    this.buffer.clear();
    this.lastFlushTime = Date.now();

    const queries = Array.from(snapshot.entries());
    const totalBuffered = queries.reduce((sum, [, count]) => sum + count, 0);

    try {
      // Batch UPSERT
      const now = new Date().toISOString();
      const values = queries
        .map(([q, cnt]) => {
          const escaped = q.replace(/'/g, "''");
          return `('${escaped}', ${cnt}, ${cnt}, '${now}')`;
        })
        .join(",\n");

      await pool.query(`
        INSERT INTO search_queries (query, count, recent_count, updated_at)
        VALUES ${values}
        ON CONFLICT (query) DO UPDATE SET
          count = search_queries.count + EXCLUDED.count,
          recent_count = search_queries.recent_count + EXCLUDED.count,
          updated_at = EXCLUDED.updated_at
      `);

      // Batch insert into search_events
      const eventValues = queries
        .map(([q]) => {
          const escaped = q.replace(/'/g, "''");
          return `('${escaped}', '${now}')`;
        })
        .join(",\n");

      await pool.query(`
        INSERT INTO search_events (query, searched_at)
        VALUES ${eventValues}
      `);

      this.dbWrites += queries.length;

      // Log write reduction
      const reduction = totalBuffered - queries.length;
      const pct = totalBuffered > 0 ? Math.round((reduction / totalBuffered) * 100) : 0;
      console.log(
        `[SearchAggregator] Flushed ${totalBuffered} searches into ${queries.length} DB writes (reduction: ${pct}%)`
      );

      // Invalidate cache for all affected queries and their prefixes
      for (const [query] of queries) {
        this.cacheInvalidation.invalidateQuery(query);
      }
    } catch (err) {
      console.error("[SearchAggregator] Flush failed:", err);
      // Re-buffer on failure to prevent data loss
      for (const [q, cnt] of snapshot) {
        const current = this.buffer.get(q) ?? 0;
        this.buffer.set(q, current + cnt);
      }
    }
  }

  getBufferSize(): number {
    return this.buffer.size;
  }
}
