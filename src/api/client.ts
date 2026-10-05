import axios from 'axios';

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

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (axios.isAxiosError(e)) {
    const status = e.response?.status ?? 0;
    const parsed = parseErrorBody(e.response?.data);
    if (parsed) return new ApiError(status, parsed.code, parsed.message, parsed.details);
    if (!e.response) return new ApiError(0, 'network_error', e.message || 'Network error');
    return new ApiError(status, 'http_error', `Request failed (HTTP ${status})`);
  }
  return new ApiError(0, 'unknown', e instanceof Error ? e.message : String(e));
}

const api = axios.create({ baseURL: '/api', timeout: 300_000 }); // 5 min timeout for heavy ops

api.interceptors.response.use(
  (res) => {
    // Legacy 200 {error: ...} bodies are failures too.
    const parsed = parseErrorBody(res.data, false);
    if (parsed) {
      throw new ApiError(res.status, parsed.code, parsed.message, parsed.details);
    }
    return res;
  },
  (err) => Promise.reject(toApiError(err)),
);

export const fetchOHLCV = (symbol: string, periodDays = 730) =>
  api.get(`/data/${symbol}`, { params: { period_days: periodDays } });

export const fetchWatchlistSymbols = () => api.get('/data/watchlist/symbols');

export const listPatterns = () => api.get('/patterns/list');

export const detectPattern = (symbol: string, patternName: string) =>
  api.post('/patterns/detect', { symbol, pattern_name: patternName });

export const scanPatterns = (markets?: string[], patterns?: string[]) =>
  api.post('/patterns/scan', { markets, patterns });

export const runBacktest = (symbol: string, patternName: string, stopLoss?: number, takeProfit?: number) =>
  api.post('/backtest/run', { symbol, pattern_name: patternName, stop_loss: stopLoss, take_profit: takeProfit });

export const runWalkForward = (symbol: string, patternName: string) =>
  api.post('/backtest/walk-forward', { symbol, pattern_name: patternName });

export const getConfiguredPairs = () => api.get('/pairs/configured');

export const analyzePair = (symbolA: string, symbolB: string) =>
  api.post('/pairs/analyze', { symbol_a: symbolA, symbol_b: symbolB });

export const scanPairs = () => api.post('/pairs/scan');

export const mlPredict = (symbol: string) =>
  api.post('/ml/predict', { symbol });

export const runStressTest = (symbol: string, patternName: string) =>
  api.post('/stress/full', { symbol, pattern_name: patternName });

export const getConfig = () => api.get('/config/');
