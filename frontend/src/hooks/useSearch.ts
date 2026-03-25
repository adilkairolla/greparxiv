import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchResponse } from '../types';
import { searchPapers } from '../api/search';

export function useSearch(query: string, regex: boolean) {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback((q: string, isRegex: boolean) => {
    // Cancel previous request
    abortRef.current?.abort();

    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    searchPapers(q, { regex: isRegex, signal: controller.signal })
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      doSearch(query, regex);
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, regex, doSearch]);

  const searchNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSearch(query, regex);
  }, [query, regex, doSearch]);

  return { results, loading, error, searchNow };
}
