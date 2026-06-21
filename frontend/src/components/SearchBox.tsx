import { useState, useRef, useEffect, useCallback } from "react";
import { fetchSuggestions, recordSearch, Suggestion } from "../api";
import SuggestionDropdown from "./SuggestionDropdown";

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doFetch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await fetchSuggestions(q);
      setSuggestions(results);
      setOpen(true);
      setActiveIdx(-1);
    } catch (err) {
      setError((err as Error).message);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced fetch on input change
  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(value), 300);
  };

  const handleSubmit = async (q?: string) => {
    const term = q ?? query;
    if (!term.trim()) return;
    try {
      await recordSearch(term);
    } catch {
      // Silent - search is best-effort
    }
    setQuery(term);
    setOpen(false);
    setSuggestions([]);
  };

  const handleSelect = (suggestion: Suggestion) => {
    setQuery(suggestion.query);
    handleSubmit(suggestion.query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") handleSubmit();
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < suggestions.length) {
          handleSelect(suggestions[activeIdx]);
        } else {
          handleSubmit();
        }
        break;
      case "Escape":
        setOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder="Search..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
          aria-label="Search input"
          autoComplete="off"
        />
        <button
          onClick={() => handleSubmit()}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {open && (
        <SuggestionDropdown
          suggestions={suggestions}
          loading={loading}
          activeIdx={activeIdx}
          onSelect={handleSelect}
          query={query}
        />
      )}
    </div>
  );
}
