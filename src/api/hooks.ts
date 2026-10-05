import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  detectPattern, fetchOHLCV, getConfig, getConfiguredPairs, getLatestTechnical, listPatterns, runBacktest,
} from './client';
import { MINUTE } from './query';

export const usePatterns = () =>
  useQuery({ queryKey: ['patterns'], queryFn: ({ signal }) => listPatterns({ signal }), staleTime: 10 * MINUTE });

export const usePairs = () =>
  useQuery({ queryKey: ['pairs'], queryFn: ({ signal }) => getConfiguredPairs({ signal }), staleTime: 10 * MINUTE });

export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: ({ signal }) => getConfig({ signal }), staleTime: 10 * MINUTE });

export const LATEST_SCAN_KEY = ['results', 'technical'] as const;
/** Latest nightly technical scan (the backend stores it under kind "technical"). */
export const useLatestScan = () =>
  useQuery({
    queryKey: LATEST_SCAN_KEY,
    queryFn: ({ signal }) => getLatestTechnical({ signal }),
    staleTime: 5 * MINUTE,
  });

/**
 * TechnicalScanner analysis. There is no combined endpoint, so this is three queries (ohlcv, detect,
 * backtest) sharing the query cache: ohlcv is keyed by symbol only, the other two by [symbol, pattern].
 * Re-analysing the same [symbol, pattern] is served from cache; in-flight duplicates are de-duplicated.
 */
export function useAnalysis(target: { symbol: string; pattern: string } | null) {
  const enabled = target !== null;
  const symbol = target?.symbol ?? '';
  const pattern = target?.pattern ?? '';
  const results = useQueries({
    queries: [
      { queryKey: ['ohlcv', symbol], queryFn: ({ signal }: { signal: AbortSignal }) => fetchOHLCV(symbol, 730, { signal }), enabled, staleTime: 5 * MINUTE },
      { queryKey: ['detect', symbol, pattern], queryFn: ({ signal }: { signal: AbortSignal }) => detectPattern(symbol, pattern, { signal }), enabled, staleTime: 5 * MINUTE },
      { queryKey: ['backtest', symbol, pattern], queryFn: ({ signal }: { signal: AbortSignal }) => runBacktest(symbol, pattern, undefined, undefined, { signal }), enabled, staleTime: 5 * MINUTE },
    ],
  });
  const [ohlcv, detect, backtest] = results;
  const all: UseQueryResult[] = results;
  return {
    ohlcv: ohlcv.data,
    signals: detect.data,
    backtest: backtest.data,
    loading: enabled && !all.some((r) => r.error) && all.some((r) => r.isPending),
    done: enabled && all.every((r) => r.isSuccess),
    error: all.find((r) => r.error)?.error ?? null,
    retry: () => { all.filter((r) => r.isError).forEach((r) => void r.refetch()); },
  };
}
