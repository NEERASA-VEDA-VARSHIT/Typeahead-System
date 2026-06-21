import SearchBox from "./components/SearchBox";
import TrendingPanel from "./components/TrendingPanel";
import MetricsPanel from "./components/MetricsPanel";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Search Typeahead
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time search suggestions with distributed caching
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Search Section */}
        <section className="mb-10">
          <SearchBox />
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trending Panel */}
          <TrendingPanel />

          {/* Metrics Panel */}
          <MetricsPanel />
        </div>
      </main>
    </div>
  );
}
