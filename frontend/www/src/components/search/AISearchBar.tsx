'use client';

import { useState, useCallback, useRef, useEffect, useId } from 'react';
import { Search, Sparkles, X, Loader2, ArrowUp } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';

type AISearchBarProps = {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
};

export default function AISearchBar({ onSearch, placeholder, className = '' }: AISearchBarProps) {
  const router = useRouter();
  const locale = useLocale() || 'id';
  const [query, setQuery] = useState('');
  const [isAIActive, setIsAIActive] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const suggestionsId = useId();

  const fetchAISuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setAiSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/search-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (res.ok) {
        const data = await res.json();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 5) : [];
        if (suggestions.length > 0) {
          setAiSuggestions(suggestions);
          setShowSuggestions(true);
        } else {
          setAiSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setAiSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('[AI Search] Error:', error);
      setAiSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Debounced AI suggestions
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (query.trim().length >= 3 && isAIActive) {
      timeoutRef.current = setTimeout(() => {
        fetchAISuggestions(query.trim());
      }, 500);
    } else {
      setAiSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, isAIActive, fetchAISuggestions]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    if (onSearch) {
      onSearch(query.trim());
    } else {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    setShowSuggestions(false);
  }, [query, onSearch, router]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(suggestion);
    } else {
      router.push(`/search?q=${encodeURIComponent(suggestion)}`);
    }
  }, [onSearch, router]);

  const toggleAI = useCallback(() => {
    const newState = !isAIActive;
    setIsAIActive(newState);
    if (newState && query.trim().length >= 3) {
      fetchAISuggestions(query.trim());
    } else if (!newState) {
      setAiSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isAIActive, query, fetchAISuggestions]);

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2 rounded-full border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] px-4 sm:px-5 py-2.5 sm:py-3 shadow-sm hover:shadow-md focus-within:shadow-lg transition-shadow">
          <Search className="w-5 h-5 text-[color:var(--app-text-soft)] shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (isAIActive && aiSuggestions.length > 0 && !showSuggestions) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding to allow click on suggestions
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder={placeholder || (locale === 'id' ? 'Cari dengan AI...' : 'Search with AI...')}
            className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] placeholder:text-[color:var(--app-text-soft)] focus:outline-none"
            aria-label="Search"
            role="combobox"
            aria-expanded={showSuggestions && aiSuggestions.length > 0}
            aria-controls={suggestionsId}
            aria-autocomplete="list"
            aria-busy={aiLoading}
          />
          <button
            type="button"
            onClick={toggleAI}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
              isAIActive
                ? 'bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]'
                : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)]'
            }`}
            aria-label={locale === 'id' ? 'Toggle AI' : 'Toggle AI'}
            title={locale === 'id' ? 'Aktifkan AI untuk saran pencarian' : 'Enable AI for search suggestions'}
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className={`w-4 h-4 ${isAIActive ? 'fill-current' : ''}`} />
            )}
          </button>
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              className="shrink-0 p-1 rounded-full hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]"
              aria-label={locale === 'id' ? 'Clear' : 'Clear'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!query.trim()}
            className="shrink-0 p-1.5 rounded-lg bg-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-50 disabled:cursor-not-allowed text-[color:var(--app-text-inverse)] transition-colors"
            aria-label={locale === 'id' ? 'Search' : 'Search'}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* AI Suggestions Dropdown */}
      {showSuggestions && aiSuggestions.length > 0 && (
        <div
          id={suggestionsId}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] rounded-xl border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          <div className="p-2">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] uppercase">
              <Sparkles className="w-3 h-3" />
              {locale === 'id' ? 'Saran AI' : 'AI Suggestions'}
            </div>
            {aiSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                role="option"
                aria-selected={false}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)] text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {aiLoading
          ? locale === 'id'
            ? 'Memuat saran AI.'
            : 'Loading AI suggestions.'
          : showSuggestions && aiSuggestions.length > 0
            ? locale === 'id'
              ? `${aiSuggestions.length} saran AI tersedia.`
              : `${aiSuggestions.length} AI suggestions available.`
            : ''}
      </span>
    </div>
  );
}