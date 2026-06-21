import { db, pool } from "./index";
import { searchQueries } from "./schema";
import * as fs from "fs";
import * as path from "path";
import { sql } from "drizzle-orm";

async function seed() {
  const csvPath = path.resolve(__dirname, "../../../data/queries.csv");
  const raw = fs.readFileSync(csvPath, "utf-8").trim();
  const lines = raw.split("\n");

  const BATCH_SIZE = 1000;
  let batch: { query: string; count: number }[] = [];
  let total = 0;

  // Skip header if present
  const startIndex = lines[0]?.toLowerCase().includes("query") ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const commaIdx = line.lastIndexOf(",");
    if (commaIdx === -1) continue;

    const query = line.slice(0, commaIdx).trim().toLowerCase();
    const count = parseInt(line.slice(commaIdx + 1).trim(), 10) || 0;
    if (!query) continue;

    batch.push({ query, count });

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(batch);
      total += batch.length;
      console.log(`Seeded ${total} rows...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch);
    total += batch.length;
  }

  console.log(`Seed complete. Total rows: ${total}`);
  await pool.end();
}

async function flushBatch(batch: { query: string; count: number }[]) {
  const now = new Date().toISOString();
  // Build a bulk upsert
  const values = batch
    .map((r) => {
      const q = r.query.replace(/'/g, "''");
      return `('${q}', ${r.count}, 0, '${now}')`;
    })
    .join(",\n");

  await pool.query(`
    INSERT INTO search_queries (query, count, recent_count, updated_at)
    VALUES ${values}
    ON CONFLICT (query) DO UPDATE SET
      count = search_queries.count + EXCLUDED.count,
      updated_at = EXCLUDED.updated_at
  `);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
