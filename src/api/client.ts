import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 300_000 }); // 5 min timeout for heavy ops

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
