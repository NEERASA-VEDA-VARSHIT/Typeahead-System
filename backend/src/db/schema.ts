import { pgTable, text, bigint, doublePrecision, timestamp, serial } from "drizzle-orm/pg-core";

export const searchQueries = pgTable("search_queries", {
  query: text("query").primaryKey(),
  count: bigint("count", { mode: "number" }).notNull().default(0),
  recentCount: doublePrecision("recent_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const searchEvents = pgTable("search_events", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  searchedAt: timestamp("searched_at").notNull().defaultNow(),
});
