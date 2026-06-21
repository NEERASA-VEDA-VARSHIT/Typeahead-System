import { Router, Request, Response } from "express";
import { TrendingService } from "../services/TrendingService";

export function trendingRoutes(trendingService: TrendingService): Router {
  const router = Router();

  /**
   * GET /trending
   *
   * Returns top trending searches using recency-aware scoring.
   */
  router.get("/", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const results = await trendingService.getTrending(limit);
      res.json(results);
    } catch (err) {
      console.error("[trending] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
