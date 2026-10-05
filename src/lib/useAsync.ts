import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '../api/client';

/** Load on mount (and on retry). `fn` must be a stable reference (module-level). */
export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (d) => { if (!cancelled) { setData(d); setError(null); setLoading(false); } },
      (e) => { if (!cancelled) { setError(toApiError(e)); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, [fn, tick]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setTick((t) => t + 1);
  }, []);

  return { data, error, loading, retry };
}

/** User-triggered action; retry() re-runs with the last arguments. */
export function useAction<A extends unknown[], T>(fn: (...args: A) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const lastArgs = useRef<A | null>(null);

  const run = useCallback(async (...args: A) => {
    lastArgs.current = args;
    setLoading(true);
    setError(null);
    try {
      setData(await fn(...args));
    } catch (e) {
      setData(null);
      setError(toApiError(e));
    } finally {
      setLoading(false);
    }
  }, [fn]);

  const retry = useCallback(() => {
    if (lastArgs.current) void run(...lastArgs.current);
  }, [run]);

  return { data, error, loading, run, retry };
}
