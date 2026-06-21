import { useState, useEffect } from "react";
import { fetchTrending, Suggestion } from "../api";

export default function TrendingPanel() {
  const [trending, setTrending] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await fetchTrending();
        setTrending(results);
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
        </svg>
        Trending Searches
      </h2>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : trending.length === 0 ? (
        <div className="text-gray-400 text-sm">No trending data yet</div>
      ) : (
        <ul className="space-y-2">
          {trending.map((item, i) => (
            <li
              key={item.query}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span
                className={`w-6 text-center text-sm font-bold ${
                  i < 3 ? "text-orange-500" : "text-gray-400"
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-gray-700">{item.query}</span>
              <span className="text-sm text-gray-400">
                {item.count.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {item.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
