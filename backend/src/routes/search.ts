import { Router, Request, Response } from "express";
import { z } from "zod";
import { SearchAggregator } from "../services/SearchAggregator";

export function searchRoutes(searchAggregator: SearchAggregator): Router {
  const router = Router();

  const searchSchema = z.object({
    query: z.string().min(1, "Query is required"),
  });

  /**
   * POST /search
   *
   * Records a search event. Returns immediately without waiting for DB write.
   * The search aggregator buffers the count and flushes asynchronously.
   */
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { query } = searchSchema.parse(req.body);
      searchAggregator.recordSearch(query);
      res.json({ message: "Searched" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.errors[0].message });
        return;
      }
      console.error("[search] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
