import { Router, Request, Response } from "express";
import { z } from "zod";
import { SuggestService } from "../services/SuggestService";
import { MetricsService } from "../services/MetricsService";

export function suggestRoutes(
  suggestService: SuggestService,
  metricsService: MetricsService
): Router {
  const router = Router();

  const querySchema = z.object({
    q: z.string().optional().default(""),
  });

  /**
   * GET /suggest?q=<prefix>
   *
   * Returns up to 10 prefix-matched suggestions sorted by ranking score.
   * Empty or missing query returns an empty array.
   */
  router.get("/", async (req: Request, res: Response) => {
    const start = Date.now();

    try {
      const { q } = querySchema.parse(req.query);
      const results = await suggestService.getSuggestions(q);

      metricsService.recordLatency(Date.now() - start);
      metricsService.dbReads = suggestService.dbReads;

      res.json(results);
    } catch (err) {
      console.error("[suggest] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
