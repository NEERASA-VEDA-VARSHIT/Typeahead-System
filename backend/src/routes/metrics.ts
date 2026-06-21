import { Router, Request, Response } from "express";
import { MetricsService } from "../services/MetricsService";

export function metricsRoutes(metricsService: MetricsService): Router {
  const router = Router();

  /**
   * GET /metrics
   *
   * Returns current system performance metrics including cache hit rate,
   * DB read/write counts, and latency percentiles.
   */
  router.get("/", (req: Request, res: Response) => {
    try {
      const metrics = metricsService.getMetrics();
      res.json(metrics);
    } catch (err) {
      console.error("[metrics] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
