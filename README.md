# Search Typeahead System

A production-style search typeahead system with distributed caching, consistent hashing, batch writes, and recency-aware trending.

## Architecture

```mermaid
graph TB
    A[Browser/React Frontend] --> B[GET /suggest?q=]
    A --> C[POST /search]
    A --> D[GET /trending]
    A --> E[GET /metrics]

    B --> F[SuggestService]
    F --> G{Consistent Hash Ring}
    G -->|hash(prefix)| H[Cache Node 1]
    G --> I[Cache Node 2]
    G --> J[Cache Node 3]
    G --> K[Cache Node 4]

    H -->|MISS| L[(PostgreSQL)]
    I -->|MISS| L
    J -->|MISS| L
    K -->|MISS| L

    C --> M[SearchAggregator]
    M --> N[In-Memory Buffer<br/>Map<string, number>]
    N -->|flush >= 500 or 10s| O[Batch UPSERT]
    O --> L
    O --> P[CacheInvalidationService]
    P --> H & I & J & K

    D --> Q[TrendingService]
    Q --> L

    E --> R[MetricsService]
    R -.-> F & M
```

## Setup & Running

### Prerequisites

- Node.js 18+
- Docker Desktop (for PostgreSQL)
- npm

### 1. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 with user/password/database all set to `typeahead`.

### 2. Install Dependencies

```bash
npm run install:all
```

### 3. Generate Drizzle Migrations

```bash
npm run db:generate
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Seed the Database

```bash
npm run seed
```

This loads `data/queries.csv` into the `search_queries` table. The CSV contains ~200 sample search queries with counts. The loader:
- Normalizes queries to lowercase
- Uses batch inserts (1000 rows per batch)
- Upserts on conflict (updates count)

### 6. Start Backend

```bash
npm run dev:backend
```

API runs on http://localhost:3001

### 7. Start Frontend (separate terminal)

```bash
npm run dev:frontend
```

UI runs on http://localhost:5173

---

## API Documentation

### GET /suggest?q=\<prefix\>

Returns up to 10 prefix-matched suggestions sorted by ranking score.

**Response:**
```json
[
  {
    "query": "iphone",
    "count": 100000,
    "score": 0.92
  }
]
```

Edge cases:
- Empty `q` ? `[]`
- No matches ? `[]`
- Mixed case ? normalized to lowercase

### POST /search

Records a search event. Returns immediately. Writes are buffered.

**Request:**
```json
{ "query": "iphone 15" }
```

**Response:**
```json
{ "message": "Searched" }
```

### GET /trending

Returns top 10 trending searches using recency-aware score.

**Response:**
```json
[
  { "query": "iphone", "count": 100000, "score": 0.95 }
]
```

### GET /metrics

Returns system performance metrics.

**Response:**
```json
{
  "cacheHitRate": 0.91,
  "cacheMissRate": 0.09,
  "dbReads": 120,
  "dbWrites": 15,
  "avgLatencyMs": 12,
  "p95LatencyMs": 18
}
```

### GET /cache/debug?prefix=\<prefix\>

Debug endpoint showing consistent hashing routing.

**Response:**
```json
{
  "prefix": "iph",
  "hash": 145,
  "node": "cache-node-2",
  "status": "HIT"
}
```

---

## How It Works

### Consistent Hashing

**Why consistent hashing was chosen over modulo routing:**

With modulo routing (`key % N`), adding or removing a cache node causes nearly **all** keys to remap, resulting in a ~100% cache miss storm. Consistent hashing places each key on a ring and only remaps the keys closest to the changed node.

When a node is added/removed, only `1/N` of keys remap on average. For 4 nodes, that is ~25% vs 100% with modulo.

**Why virtual nodes are used:**

With only 4 physical nodes, key distribution can be uneven (hotspots). Virtual nodes (100 per physical node) spread each physical node across 400 positions on the ring, creating near-uniform load distribution.

**Implementation:**

The `ConsistentHashRing` class:
1. Hashes each virtual node key using the DJB2 algorithm to produce a 32-bit unsigned integer
2. Places it on a sorted ring (array of `{hash, node}`)
3. For lookups, hashes the prefix and performs binary search for the first hash >= key hash
4. Wraps around to the first entry if no match is found

### Batch Writes

**Why batch writes reduce DB load:**

Without batching, every user search triggers a synchronous DB write. At 1000 searches/second, PostgreSQL must process 1000 individual write transactions per second. Each transaction has overhead (parse, plan, lock, WAL flush).

With the `SearchAggregator`:
- Searches accumulate in an in-memory `Map<string, number>`
- Flush triggers when buffer size = 500 or 10 seconds elapse
- A single `UPSERT` handles all occurrences of each distinct query

**Example:** 1000 searches (500 "iphone" + 300 "java" + 200 "python") become 3 DB writes instead of 1000. That is a 99.7% reduction.

**Failure tradeoff:** If the process crashes before a flush completes, buffered counts are lost. In production, use a durable commit log (Apache Kafka, RabbitMQ, AWS SQS) to buffer writes durably.

### Trending Ranking Formula

```
score = 0.7 * normalized(total_count) + 0.3 * normalized(recent_count)
```

Where normalization is min-max scaling within the result set:
```
normalized(x) = (x - min) / (max - min)
```

**Why two signals:**
- **total_count** ensures high-popularity all-time queries stay visible
- **recent_count** boosts queries experiencing a current surge

**Weights** (0.7 / 0.3) are configurable via constructor parameters.

### Decay Mechanism

Every hour, a scheduled job runs:
```sql
UPDATE search_queries SET recent_count = recent_count * 0.9;
```

This prevents temporary spikes from permanently inflating trending scores. Without decay, a single viral event (e.g., "super bowl 2025") would stay on the trending list forever.

### Cache Invalidation Strategy

After a batch flush updates the database, cached suggestion lists may be stale. For each updated query (e.g., "iphone"), the `CacheInvalidationService` generates all possible prefixes:

```
i, ip, iph, ipho, iphon, iphone
```

Each prefix is invalidated against its responsible cache node. This ensures the next `GET /suggest?q=iph` triggers a fresh database read and ranking computation.

---

## Performance Report Template

| Metric | Value | Notes |
|--------|-------|-------|
| Cache Hit Rate | | Higher is better (target > 0.8) |
| Cache Miss Rate | | Should decrease over time |
| Avg Latency | | Target < 20ms |
| p95 Latency | | Target < 50ms |
| DB Reads | | Should decrease as cache warms |
| DB Writes | | Batch vs individual comparison |
| Write Reduction % | | 10000 searches ? X writes |
| Cache Nodes | 4 | 100 virtual nodes each |

---

## Project Structure

```
backend/
  src/
    cache/
      ConsistentHashRing.ts    - Hash ring with virtual nodes
      CacheNode.ts             - Per-node key-value store with TTL
      CacheManager.ts          - Cache orchestrator
    services/
      SuggestService.ts        - Prefix suggestions with caching
      SearchAggregator.ts      - In-memory buffer + batch flush
      TrendingService.ts       - Recency-aware trending
      MetricsService.ts        - Performance metrics
      CacheInvalidationService.ts - Prefix-based invalidation
    routes/
      suggest.ts               - GET /suggest
      search.ts                - POST /search
      trending.ts              - GET /trending
      metrics.ts               - GET /metrics
      cacheDebug.ts            - GET /cache/debug
    db/
      schema.ts                - Drizzle ORM schema
      seed.ts                  - CSV data loader
      index.ts                 - DB connection
      migrations/              - Auto-generated migrations
    index.ts                   - Express app entry

frontend/
  src/
    components/
      SearchBox.tsx            - Input with debounce
      SuggestionDropdown.tsx   - Dropdown with keyboard nav
      TrendingPanel.tsx        - Trending display
      MetricsPanel.tsx         - Metrics dashboard
    App.tsx                    - Main layout
    api.ts                     - API client
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React, Vite, TypeScript, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Validation | Zod |
| Container | Docker Compose |

---

## Edge Cases Handled

- **Empty input** ? returns `[]`
- **Missing query param** ? defaults to empty string
- **No matches** ? returns `[]`
- **Mixed case input** ? normalized to lowercase
- **Loading state** ? spinner shown in dropdown
- **Error state** ? error message displayed
- **Keyboard navigation** ? ArrowUp, ArrowDown, Enter, Escape
- **Cache expiry** ? 5-minute TTL with lazy eviction
- **Buffer overflow** ? flush at 500 entries
- **Flush failure** ? re-buffer entries for next attempt
- **Decay failure** ? logged, no crash
- **Request validation** ? Zod middleware for all routes
#   T y p e a h e a d - S y s t e m 
 
 