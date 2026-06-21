export interface Suggestion {
  query: string;
  count: number;
  score: number;
}

export interface Metrics {
  cacheHitRate: number;
  cacheMissRate: number;
  dbReads: number;
  dbWrites: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

const BASE = "";

export async function fetchSuggestions(prefix: string): Promise<Suggestion[]> {
  if (!prefix.trim()) return [];
  const res = await fetch(`${BASE}/suggest?q=${encodeURIComponent(prefix)}`);
  if (!res.ok) throw new Error(`Failed to fetch suggestions: ${res.statusText}`);
  return res.json();
}

export async function recordSearch(query: string): Promise<void> {
  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Failed to record search: ${res.statusText}`);
}

export async function fetchTrending(): Promise<Suggestion[]> {
  const res = await fetch(`${BASE}/trending`);
  if (!res.ok) throw new Error(`Failed to fetch trending: ${res.statusText}`);
  return res.json();
}

export async function fetchMetrics(): Promise<Metrics> {
  const res = await fetch(`${BASE}/metrics`);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.statusText}`);
  return res.json();
}
