import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { CacheManager } from "./cache/CacheManager";
import { SuggestService } from "./services/SuggestService";
import { SearchAggregator } from "./services/SearchAggregator";
import { TrendingService } from "./services/TrendingService";
import { MetricsService } from "./services/MetricsService";
import { CacheInvalidationService } from "./services/CacheInvalidationService";

import { suggestRoutes } from "./routes/suggest";
import { searchRoutes } from "./routes/search";
import { trendingRoutes } from "./routes/trending";
import { metricsRoutes } from "./routes/metrics";
import { cacheDebugRoutes } from "./routes/cacheDebug";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

// Initialize services with dependency injection
const cacheManager = new CacheManager();
const cacheInvalidation = new CacheInvalidationService(cacheManager);
const suggestService = new SuggestService(cacheManager);
const searchAggregator = new SearchAggregator(cacheInvalidation);
const trendingService = new TrendingService();
const metricsService = new MetricsService();

// Wire up metrics counters from other services
// These are updated by reference as the services run
metricsService.cacheHits = cacheManager.cacheHits as number;
metricsService.cacheMisses = cacheManager.cacheMisses as number;

// Start background jobs
searchAggregator.start();
trendingService.startDecay();

// Register routes
app.use("/suggest", suggestRoutes(suggestService, metricsService));
app.use("/search", searchRoutes(searchAggregator));
app.use("/trending", trendingRoutes(trendingService));
app.use("/metrics", metricsRoutes(metricsService));
app.use("/cache", cacheDebugRoutes(cacheManager));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[Server] Search Typeahead API running on http://localhost:${PORT}`);
  console.log(`[Server] Endpoints:`);
  console.log(`  GET  /suggest?q=<prefix>`);
  console.log(`  POST /search`);
  console.log(`  GET  /trending`);
  console.log(`  GET  /metrics`);
  console.log(`  GET  /cache/debug?prefix=<prefix>`);
  console.log(`  GET  /health`);
});

export default app;
