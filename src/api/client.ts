import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import type {
  AppConfig, BacktestResult, LatestScan, MLPrediction, PairAnalysis, PairRef,
  ScanSignal, StressReport,
} from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Extract {code, message, details} from a backend error body, or null if it has none. */
function parseErrorBody(body: unknown, allowDetail = true): { code: string; message: string; details?: unknown } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const err = b.error;
  if (typeof err === 'string' && err) return { code: 'error', message: err };
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return {
      code: typeof e.code === 'string' ? e.code : 'error',
      message: typeof e.message === 'string' ? e.message : 'Request failed',
      details: e.details,
    };
  }
  if (allowDetail && typeof b.detail === 'string' && b.detail) return { code: 'http_error', message: b.detail };
  return null;
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === 'AbortError' : e instanceof Error && e.name === 'AbortError';
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof TypeError) return new ApiError(0, 'network_error', e.message || 'Network error');
  return new ApiError(0, 'unknown', e instanceof Error ? e.message : String(e));
}

async function readJson(res: Response): Promise<unknown> {
  try { return await res.clone().json(); } catch { return undefined; }
}

const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    const body = await readJson(response);
    if (!response.ok) {
      const parsed = parseErrorBody(body);
      if (parsed) throw new ApiError(response.status, parsed.code, parsed.message, parsed.details);
      throw new ApiError(response.status, 'http_error', `Request failed (HTTP ${response.status})`);
    }
    // Legacy 200 {error: ...} bodies are failures too. A body with its own `status` (e.g. BriefingResponse, whose
    // `error` is a message that belongs to a skipped/error status) is a result, not a failure.
    const hasStatus = !!body && typeof body === 'object' && 'status' in body;
    const parsed = hasStatus ? null : parseErrorBody(body, false);
    if (parsed) throw new ApiError(response.status, parsed.code, parsed.message, parsed.details);
    return undefined;
  },
};

const TIMEOUT_MS = 300_000; // 5 min for heavy ops

/**
 * baseUrl is VITE_API_BASE_URL ?? '/api'. The OpenAPI paths already start with /api, so a
 * trailing '/api' on the base is the API root itself and is not repeated.
 */
export function resolveOrigin(baseUrl: string): string {
  const abs = /^https?:\/\//.test(baseUrl) ? baseUrl : `${window.location.origin}${baseUrl.startsWith('/') ? '' : '/'}${baseUrl}`;
  return abs.replace(/\/+$/, '').replace(/\/api$/, '');
}

/**
 * `token` (default VITE_API_TOKEN) is sent as `Authorization: Bearer ...`. Anything in VITE_* is embedded in the
 * bundle: for dev/preview prefer API_TOKEN, which the vite proxy injects server-side (vite.config.ts).
 */
export function createApi(baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api',
                          token: string | undefined = import.meta.env.VITE_API_TOKEN) {
  const client = createClient<paths>({
    baseUrl: resolveOrigin(baseUrl),
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    fetch: (req) => fetch(new Request(req, { signal: AbortSignal.any([req.signal, AbortSignal.timeout(TIMEOUT_MS)]) })),
  });
  client.use(errorMiddleware);
  return client;
}

let current = createApi();
/** Swap the client (tests, runtime reconfiguration). */
export function setApi(c: ReturnType<typeof createApi>) { current = c; }
export const getApi = () => current;

/** Run a client call; non-API failures become ApiError, aborts pass through untouched. */
async function call<T>(fn: () => Promise<{ data?: T; error?: unknown }>): Promise<T> {
  try {
    const { data } = await fn();
    return data as T;
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw toApiError(e);
  }
}

type Opts = { signal?: AbortSignal };

export const fetchOHLCV = (symbol: string, periodDays = 730, o: Opts = {}) =>
  call(() => current.GET('/api/data/{symbol}', { params: { path: { symbol }, query: { period_days: periodDays } }, signal: o.signal }));

export const fetchWatchlistSymbols = (o: Opts = {}) =>
  call(() => current.GET('/api/data/watchlist/symbols', { signal: o.signal }));

export const listPatterns = (o: Opts = {}) =>
  call(() => current.GET('/api/patterns/list', { signal: o.signal }));

export const detectPattern = (symbol: string, patternName: string, o: Opts = {}) =>
  call(() => current.POST('/api/patterns/detect', { body: { symbol, pattern_name: patternName }, signal: o.signal }));

export const scanPatterns = (markets?: string[], patterns?: string[], o: Opts = {}) =>
  call(() => current.POST('/api/patterns/scan', { body: { markets, patterns }, signal: o.signal }));

export const runBacktest = (symbol: string, patternName: string, stopLoss?: number, takeProfit?: number, o: Opts = {}) =>
  call(() => current.POST('/api/backtest/run', {
    body: { symbol, pattern_name: patternName, stop_loss: stopLoss, take_profit: takeProfit }, signal: o.signal,
  }));

export const runWalkForward = (symbol: string, patternName: string, o: Opts = {}) =>
  call(() => current.POST('/api/backtest/walk-forward', { body: { symbol, pattern_name: patternName }, signal: o.signal }));

export const getConfiguredPairs = (o: Opts = {}) =>
  call(() => current.GET('/api/pairs/configured', { signal: o.signal }));

export const analyzePair = (symbolA: string, symbolB: string, o: Opts = {}) =>
  call(() => current.POST('/api/pairs/analyze', { body: { symbol_a: symbolA, symbol_b: symbolB }, signal: o.signal }));

export const scanPairs = (o: Opts = {}) =>
  call(() => current.POST('/api/pairs/scan', { signal: o.signal }));

export const mlPredict = (symbol: string, o: Opts = {}) =>
  call(() => current.POST('/api/ml/predict', { body: { symbol }, signal: o.signal }));

export const runStressTest = (symbol: string, patternName: string, o: Opts = {}) =>
  call(() => current.POST('/api/stress/full', { body: { symbol, pattern_name: patternName }, signal: o.signal }));

export const getConfig = (o: Opts = {}) =>
  call(() => current.GET('/api/config/', { signal: o.signal }));

/** Latest nightly technical scan. 404 not_found when none stored yet. */
export const getLatestTechnical = (o: Opts = {}) =>
  call(() => current.GET('/api/results/technical/latest', { signal: o.signal }));

export type { AppConfig, LatestScan, BacktestResult, MLPrediction, PairAnalysis, PairRef, ScanSignal, StressReport };
