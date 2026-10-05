import { useState } from 'react';
import Plot from 'react-plotly.js';
import { mlPredict } from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { useAction } from '../lib/useAsync';
import { num, pct, usd, signColor } from '../lib/format';

const predict = (symbol: string) => mlPredict(symbol).then((r) => r.data);

export default function MLSignals() {
  const [symbol, setSymbol] = useState('AAPL');
  const { data: r, error, loading, run, retry } = useAction(predict);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">ML Signals</h2>

      <div className="flex gap-3 mb-6">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol" className="px-3 py-2 rounded text-sm w-40"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <button onClick={() => void run(symbol)} disabled={loading}
          className="px-6 py-2 rounded font-semibold text-black disabled:opacity-50"
          style={{ background: 'var(--accent-blue)' }}>
          {loading ? 'Training...' : 'Train & Predict'}
        </button>
      </div>

      {loading && <LoadingSpinner text="Training ML ensemble (RF + XGBoost + LightGBM)... this takes a moment" />}

      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {r && !loading && (
        <>
          {/* Metrics */}
          {r.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <MetricCard label="Win Rate" value={pct(r.metrics.win_rate)} />
              <MetricCard label="Sharpe" value={num(r.metrics.sharpe)} />
              <MetricCard label="Profit Factor" value={num(r.metrics.profit_factor)} />
              <MetricCard label="Total Return" value={pct(r.metrics.total_return)}
                color={signColor(r.metrics.total_return)} />
              <MetricCard label="Max Drawdown" value={pct(r.metrics.max_drawdown)} color="var(--accent-red)" />
              <MetricCard label="Trades" value={r.metrics.total_trades ?? 'n/a'} />
              <MetricCard label="Valid" value={r.is_valid ? 'YES' : 'NO'}
                color={r.is_valid ? 'var(--accent-green)' : 'var(--accent-red)'} />
            </div>
          )}

          {/* Feature Importance */}
          {r.feature_importance?.length > 0 && (
            <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <Plot
                data={[{
                  type: 'bar',
                  x: r.feature_importance.map((f: any) => f.importance),
                  y: r.feature_importance.map((f: any) => f.feature),
                  orientation: 'h',
                  marker: { color: '#58a6ff' },
                }]}
                layout={{
                  title: 'Top 20 Feature Importance',
                  xaxis: { color: '#8b949e', gridcolor: '#21262d', title: 'Importance' },
                  yaxis: { color: '#8b949e', autorange: 'reversed' },
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e6edf3', size: 11 },
                  height: 500, margin: { t: 40, b: 40, l: 150, r: 20 },
                }}
                useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Equity Curve */}
          {r.equity_curve?.length > 0 && (
            <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <Plot
                data={[{
                  type: 'scatter', mode: 'lines',
                  x: r.equity_curve.map((d: any) => d.date),
                  y: r.equity_curve.map((d: any) => d.value),
                  line: { color: '#00ff88', width: 2 }, name: 'ML Equity',
                }]}
                layout={{
                  title: 'ML Strategy Equity Curve',
                  xaxis: { color: '#8b949e', gridcolor: '#21262d' },
                  yaxis: { color: '#8b949e', gridcolor: '#21262d', title: 'Value ($)' },
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e6edf3' }, height: 300,
                  margin: { t: 40, b: 40, l: 60, r: 20 },
                }}
                useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {!(r.signals?.length > 0) && (
            <p style={{ color: 'var(--text-secondary)' }}>The model produced no signals for {r.symbol ?? symbol}.</p>
          )}

          {/* Signals table */}
          {r.signals?.length > 0 && (
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <h3 className="p-3 font-semibold" style={{ background: 'var(--bg-secondary)' }}>
                ML Signals ({r.total_signals})
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Signal</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {r.signals.slice(-20).reverse().map((s: any, i: number) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-2 font-mono text-xs">{s.date?.slice(0, 10)}</td>
                      <td className="p-2 font-bold" style={{ color: s.signal === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{s.signal}</td>
                      <td className="p-2 text-right font-mono">{usd(s.price)}</td>
                      <td className="p-2 text-right">{pct(s.confidence)}</td>
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
