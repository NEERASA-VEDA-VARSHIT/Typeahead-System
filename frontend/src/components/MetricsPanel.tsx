import { useState, useEffect } from "react";
import { fetchMetrics, Metrics } from "../api";

export default function MetricsPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const m = await fetchMetrics();
        setMetrics(m);
      } catch {
        // Silent
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Metrics</h2>
        <div className="text-gray-400 text-sm">Loading metrics...</div>
      </div>
    );
  }

  const bars = [
    {
      label: "Cache Hit Rate",
      value: metrics.cacheHitRate,
      pct: Math.round(metrics.cacheHitRate * 100),
      color: "bg-green-500",
    },
    {
      label: "Cache Miss Rate",
      value: metrics.cacheMissRate,
      pct: Math.round(metrics.cacheMissRate * 100),
      color: "bg-yellow-500",
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Performance Metrics
      </h2>

      <div className="space-y-4">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{bar.label}</span>
              <span className="font-medium">{bar.pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`${bar.color} h-2.5 rounded-full transition-all duration-500`}
                style={{ width: `${bar.pct}%` }}
              ></div>
            </div>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">DB Reads</div>
            <div className="text-xl font-bold text-gray-800">{metrics.dbReads}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">DB Writes</div>
            <div className="text-xl font-bold text-gray-800">{metrics.dbWrites}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">Avg Latency</div>
            <div className="text-xl font-bold text-gray-800">
              {metrics.avgLatencyMs}ms
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">p95 Latency</div>
            <div className="text-xl font-bold text-gray-800">
              {metrics.p95LatencyMs}ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
