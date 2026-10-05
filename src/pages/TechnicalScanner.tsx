import { useState } from 'react';
import Plot from 'react-plotly.js';
import { fetchOHLCV, listPatterns, detectPattern, runBacktest } from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { useAction, useLoad } from '../lib/useAsync';
import { num, pct, signColor } from '../lib/format';

const loadPatterns = () => listPatterns().then((r) => (r.data.patterns ?? []) as string[]);
const analyzeSymbol = async (symbol: string, pattern: string) => {
  const [dataRes, sigRes, btRes] = await Promise.all([
    fetchOHLCV(symbol),
    detectPattern(symbol, pattern),
    runBacktest(symbol, pattern),
  ]);
  return { ohlcv: (dataRes.data.data ?? []) as any[], signals: sigRes.data as any, backtest: btRes.data as any };
};

export default function TechnicalScanner() {
  const { data: patternsData, error: patError, loading: patLoading, retry: retryPatterns } = useLoad(loadPatterns);
  const patterns = patternsData ?? [];
  const [symbol, setSymbol] = useState('AAPL');
  const [chosenPattern, setChosenPattern] = useState('');
  const pattern = chosenPattern || patterns[0] || '';
  const { data: result, error, loading, run, retry } = useAction(analyzeSymbol);
  const ohlcv = result?.ohlcv ?? [];
  const signals = result?.signals ?? null;
  const backtest = result?.backtest ?? null;

  const handleAnalyze = () => {
    if (!symbol || !pattern) return;
    void run(symbol, pattern);
  };

  const m = backtest?.metrics;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Technical Scanner</h2>

      {/* Controls */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol (e.g. AAPL)"
          className="px-3 py-2 rounded text-sm w-40"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <select
          value={pattern}
          onChange={(e) => setChosenPattern(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          {patterns.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          onClick={handleAnalyze}
          disabled={loading || !pattern}
          className="px-6 py-2 rounded font-semibold text-black disabled:opacity-50"
          style={{ background: 'var(--accent-blue)' }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {patLoading && <LoadingSpinner text="Loading patterns..." />}
      {patError && <ErrorPanel error={patError} onRetry={retryPatterns} />}
      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {loading && <LoadingSpinner text="Fetching data, detecting patterns, running backtest..." />}

      {result && ohlcv.length === 0 && !loading && (
        <p style={{ color: 'var(--text-secondary)' }}>No price data returned for {symbol}.</p>
      )}

      {ohlcv.length > 0 && !loading && (
        <>
          {/* Candlestick Chart */}
          <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <Plot
              data={[
                {
                  type: 'candlestick',
                  x: ohlcv.map((d) => d.date),
                  open: ohlcv.map((d) => d.open),
                  high: ohlcv.map((d) => d.high),
                  low: ohlcv.map((d) => d.low),
                  close: ohlcv.map((d) => d.close),
                  increasing: { line: { color: '#00ff88' } },
                  decreasing: { line: { color: '#ff4444' } },
                  name: symbol,
                },
                ...(signals?.buys?.length ? [{
                  type: 'scatter' as const,
                  mode: 'markers' as const,
                  x: signals.buys.map((b: any) => b.date),
                  y: signals.buys.map((b: any) => b.price),
                  marker: { symbol: 'triangle-up', size: 12, color: '#00ff88' },
                  name: 'Buy',
                }] : []),
                ...(signals?.sells?.length ? [{
                  type: 'scatter' as const,
                  mode: 'markers' as const,
                  x: signals.sells.map((s: any) => s.date),
                  y: signals.sells.map((s: any) => s.price),
                  marker: { symbol: 'triangle-down', size: 12, color: '#ff4444' },
                  name: 'Sell',
                }] : []),
              ]}
              layout={{
                title: `${symbol} — ${pattern}`,
                xaxis: { rangeslider: { visible: false }, color: '#8b949e', gridcolor: '#21262d' },
                yaxis: { color: '#8b949e', gridcolor: '#21262d' },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#e6edf3' },
                height: 450,
                margin: { t: 40, b: 40, l: 50, r: 20 },
                showlegend: true,
                legend: { x: 0, y: 1, bgcolor: 'transparent' },
              }}
              useResizeHandler
              style={{ width: '100%' }}
            />
          </div>

          {/* Metrics */}
          {m && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <MetricCard label="Win Rate" value={pct(m.win_rate)} color={m.win_rate != null && m.win_rate >= 0.52 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <MetricCard label="Profit Factor" value={num(m.profit_factor)} />
              <MetricCard label="Sharpe" value={num(m.sharpe)} />
              <MetricCard label="Total Return" value={pct(m.total_return)} color={signColor(m.total_return)} />
              <MetricCard label="Max Drawdown" value={pct(m.max_drawdown)} color="var(--accent-red)" />
              <MetricCard label="Trades" value={m.total_trades ?? 'n/a'} />
            </div>
          )}

          {/* Equity Curve */}
          {backtest?.equity_curve?.length > 0 && (
            <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <Plot
                data={[{
                  type: 'scatter',
                  mode: 'lines',
                  x: backtest.equity_curve.map((d: any) => d.date),
                  y: backtest.equity_curve.map((d: any) => d.value),
                  line: { color: '#58a6ff', width: 2 },
                  name: 'Equity',
                }]}
                layout={{
                  title: 'Equity Curve',
                  xaxis: { color: '#8b949e', gridcolor: '#21262d' },
                  yaxis: { color: '#8b949e', gridcolor: '#21262d', title: 'Portfolio Value ($)' },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#e6edf3' },
                  height: 300,
                  margin: { t: 40, b: 40, l: 60, r: 20 },
                }}
                useResizeHandler
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Trade Log */}
          {backtest?.trades?.length > 0 && (
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <h3 className="p-3 font-semibold" style={{ background: 'var(--bg-secondary)' }}>Trade Log ({backtest.trades.length} trades)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    <th className="text-left p-2">Entry</th>
                    <th className="text-left p-2">Exit</th>
                    <th className="text-left p-2">Dir</th>
                    <th className="text-right p-2">Entry $</th>
                    <th className="text-right p-2">Exit $</th>
                    <th className="text-right p-2">PnL</th>
                    <th className="text-left p-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {backtest.trades.map((t: any, i: number) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-2 font-mono text-xs">{t.entry_date?.slice(0, 10)}</td>
                      <td className="p-2 font-mono text-xs">{t.exit_date?.slice(0, 10)}</td>
                      <td className="p-2" style={{ color: t.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{t.direction}</td>
                      <td className="p-2 text-right font-mono">{num(t.entry_price)}</td>
                      <td className="p-2 text-right font-mono">{num(t.exit_price)}</td>
                      <td className="p-2 text-right font-mono" style={{ color: signColor(t.pnl_pct) }}>
                        {pct(t.pnl_pct, 2)}
                      </td>
                      <td className="p-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{t.exit_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
