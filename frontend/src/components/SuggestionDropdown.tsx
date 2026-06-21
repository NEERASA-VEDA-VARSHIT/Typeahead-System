import { Suggestion } from "../api";

interface Props {
  suggestions: Suggestion[];
  loading: boolean;
  activeIdx: number;
  onSelect: (s: Suggestion) => void;
  query: string;
}

export default function SuggestionDropdown({
  suggestions,
  loading,
  activeIdx,
  onSelect,
  query,
}: Props) {
  if (loading) {
    return (
      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
        <div className="p-4 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
        <div className="p-4 text-center text-gray-500">No results found</div>
      </div>
    );
  }

  return (
    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
      {suggestions.map((s, i) => (
        <button
          key={s.query}
          onClick={() => onSelect(s)}
          className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-blue-50 transition-colors ${
            i === activeIdx ? "bg-blue-50 border-l-4 border-blue-500" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-gray-800">
              {highlightMatch(s.query, query)}
            </span>
          </div>
          <span className="text-sm text-gray-400 shrink-0 ml-2">
            {s.count.toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-blue-600">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
