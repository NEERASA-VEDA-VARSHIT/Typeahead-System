import { db } from "../db";
import { searchQueries } from "../db/schema";
import { sql } from "drizzle-orm";

/**
 * TrendingService
 *
 * Returns top trending searches using recency-aware ranking.
 *
 * The trend score combines total historical count with recent activity:
 *   trend_score = 0.7 * count + 0.3 * recent_count
 *
 * Why two signals?
 *   - total_count: ensures popular all-time queries remain visible
 *   - recent_count: boosts queries that are trending right now
 *
 * Decay mechanism:
 *   Every hour, recent_count *= 0.9. This prevents temporary spikes
 *   from permanently inflating the trending list. Without decay,
 *   a single viral event would keep a query on trending forever.
 */
export class TrendingService {
  private decayTimer: ReturnType<typeof setInterval> | null = null;
  private totalCountWeight: number;
  private recentCountWeight: number;

  constructor(totalCountWeight = 0.7, recentCountWeight = 0.3) {
    this.totalCountWeight = totalCountWeight;
    this.recentCountWeight = recentCountWeight;
  }

  async getTrending(limit = 10) {
    const rows = await db
      .select({
        query: searchQueries.query,
        count: searchQueries.count,
        recentCount: searchQueries.recentCount,
      })
      .from(searchQueries)
      .orderBy(
        sql`(${searchQueries.count} * ${this.totalCountWeight} + COALESCE(${searchQueries.recentCount}, 0) * ${this.recentCountWeight}) DESC`
      )
      .limit(limit);

    const maxCount = rows.length > 0 ? Math.max(...rows.map((r) => r.count)) : 1;
    const maxRecent = rows.length > 0 ? Math.max(...rows.map((r) => r.recentCount ?? 0)) : 1;

    return rows.map((r) => {
      const normalizedTotal = r.count / maxCount;
      const normalizedRecent = (r.recentCount ?? 0) / maxRecent;
      const score =
        this.totalCountWeight * normalizedTotal +
        this.recentCountWeight * normalizedRecent;

      return {
        query: r.query,
        count: r.count,
        score: Math.round(score * 100) / 100,
      };
    });
  }

  /**
   * Start the hourly decay job.
   * Multiplies recent_count by 0.9 every hour.
   */
  startDecay(): void {
    if (this.decayTimer) return;
    this.decayTimer = setInterval(async () => {
      try {
        const result = await db
          .update(searchQueries)
          .set({
            recentCount: sql`${searchQueries.recentCount} * 0.9`,
          })
          .execute();
        console.log(`[TrendingService] Decay applied at ${new Date().toISOString()}`);
      } catch (err) {
        console.error("[TrendingService] Decay failed:", err);
      }
    }, 60 * 60 * 1000); // Every hour

    // Don't block process exit
    if (this.decayTimer && typeof this.decayTimer === "object" && "unref" in this.decayTimer) {
      (this.decayTimer as ReturnType<typeof setInterval>).unref();
    }
  }

  stopDecay(): void {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
      this.decayTimer = null;
    }
  }
}
