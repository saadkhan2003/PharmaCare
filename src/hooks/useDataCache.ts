import { useState, useEffect, useRef, useCallback } from 'react';

// Global in-memory cache map
const memoryCache = new Map<string, { data: unknown; timestamp: number }>();

export function clearDataCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  }
}

interface CacheOptions {
  maxAgeMs?: number;
  refreshKey?: number | string;
}

/**
 * useDataCache — Stale-While-Revalidate hook for instant page transitions.
 *
 * When navigating to a page that has been loaded before, it renders the cached data
 * immediately with `loading = false`, while revalidating in the background.
 */
export function useDataCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions
): {
  data: T | null;
  loading: boolean;
  isRevalidating: boolean;
  error: string | null;
  mutate: (newData: T | ((prev: T | null) => T)) => void;
  refresh: () => Promise<void>;
} {
  const maxAge = options?.maxAgeMs ?? 120_000; // 2 minutes default freshness
  const cached = memoryCache.get(cacheKey);

  const [data, setData] = useState<T | null>(() => (cached ? (cached.data as T) : null));
  const [loading, setLoading] = useState<boolean>(() => !cached);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    setIsRevalidating(true);
    try {
      const res = await fetcherRef.current();
      memoryCache.set(cacheKey, { data: res, timestamp: Date.now() });
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    const existing = memoryCache.get(cacheKey);
    if (!existing) {
      setLoading(true);
      refresh();
    } else {
      setData(existing.data as T);
      setLoading(false);
      // Background revalidation if stale or refreshKey changed
      if (Date.now() - existing.timestamp > maxAge || options?.refreshKey) {
        refresh();
      }
    }
  }, [cacheKey, options?.refreshKey, maxAge, refresh]);

  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    setData((prev) => {
      const val = typeof newData === 'function' ? (newData as (prev: T | null) => T)(prev) : newData;
      memoryCache.set(cacheKey, { data: val, timestamp: Date.now() });
      return val;
    });
  }, [cacheKey]);

  return { data, loading, isRevalidating, error, mutate, refresh };
}
