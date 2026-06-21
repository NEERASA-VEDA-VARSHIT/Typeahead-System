import { Router, Request, Response } from "express";
import { z } from "zod";
import { CacheManager } from "../cache/CacheManager";

export function cacheDebugRoutes(cacheManager: CacheManager): Router {
  const router = Router();

  const querySchema = z.object({
    prefix: z.string().min(1, "Prefix is required"),
  });

  /**
   * GET /cache/debug?prefix=<prefix>
   *
   * Debug endpoint to inspect consistent hashing routing.
   * Returns the hash value, assigned cache node, and HIT/MISS status.
   */
  router.get("/debug", (req: Request, res: Response) => {
    try {
      const { prefix } = querySchema.parse(req.query);
      const result = cacheManager.debug(prefix);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.errors[0].message });
        return;
      }
      console.error("[cache/debug] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
