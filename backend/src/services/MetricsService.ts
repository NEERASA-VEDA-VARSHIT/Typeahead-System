/**
 * MetricsService
 *
 * Tracks performance metrics for the typeahead system:
 *   - Cache hit/miss rates
 *   - DB read/write counts
 *   - Request latency (average, p95)
 *
 * Uses a rolling window of latency samples to compute percentiles.
 */
export class MetricsService {
  private latencies: number[] = [];
  private maxWindowSize: number;

  // References to counters from other services
  public cacheHits = 0;
  public cacheMisses = 0;
  public dbReads = 0;
  public dbWrites = 0;

  constructor(maxWindowSize = 5000) {
    this.maxWindowSize = maxWindowSize;
  }

  /**
   * Record a single request latency in milliseconds.
   */
  recordLatency(durationMs: number): void {
    this.latencies.push(durationMs);
    if (this.latencies.length > this.maxWindowSize) {
      this.latencies.shift();
    }
  }

  /**
   * Compute p95 latency from the rolling window.
   * Sorts values and picks the 95th percentile.
   */
  private computeP95(): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Compute average latency.
   */
  private computeAvg(): number {
    if (this.latencies.length === 0) return 0;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencies.length);
  }

  /**
   * Get current metrics snapshot.
   */
  getMetrics() {
    const totalOps = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalOps > 0 ? this.cacheHits / totalOps : 0;

    return {
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      cacheMissRate: Math.round((1 - cacheHitRate) * 100) / 100,
      dbReads: this.dbReads,
      dbWrites: this.dbWrites,
      avgLatencyMs: this.computeAvg(),
      p95LatencyMs: this.computeP95(),
    };
  }
}
