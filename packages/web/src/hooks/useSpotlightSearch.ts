/**
 * OS.4: Spotlight Search Hook
 */

import { useEffect, useMemo, useState } from 'react';
import { useSpotlightStore } from '@/store/spotlightStore';
import type { SpotlightItem } from '@originos/core/types';

export function useSpotlightSearch(items: SpotlightItem[]) {
  const { query, setResults } = useSpotlightStore();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredResults = useMemo(() => {
    if (!debouncedQuery.trim()) return items;

    const lowerQuery = debouncedQuery.toLowerCase();
    return items.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(lowerQuery);
      const keywordsMatch = item.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
      return titleMatch || subtitleMatch || keywordsMatch;
    });
  }, [debouncedQuery, items]);

  useEffect(() => {
    setResults(filteredResults);
  }, [filteredResults, setResults]);

  return filteredResults;
}
