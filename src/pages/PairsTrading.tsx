import { useState } from 'react';
import Plot from 'react-plotly.js';
import { getConfiguredPairs, analyzePair } from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { useAction, useLoad } from '../lib/useAsync';
import { num, pct, signColor } from '../lib/format';

type Pair = { a: string; b: string };
const loadPairs = () => getConfiguredPairs().then((r) => (r.data.pairs ?? []) as Pair[]);
const analyze = (a: string, b: string) => analyzePair(a, b).then((r) => r.data);

export default function PairsTrading() {
  const { data: pairsData, error: pairsError, loading: pairsLoading, retry: retryPairs } = useLoad(loadPairs);
  const pairs = pairsData ?? [];
  const [chosenPair, setChosenPair] = useState('');
  const selectedPair = chosenPair || (pairs.length > 0 ? `${pairs[0].a}/${pairs[0].b}` : '');
  const { data: analysis, error, loading, run, retry } = useAction(analyze);

  const handleAnalyze = () => {
    const [a, b] = selectedPair.split('/');
    if (!a || !b) return;
    void run(a, b);
  };

  const a = analysis;
  const spreadData = a?.spread_data?.filter((d: any) => d.zscore !== undefined) || [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Pairs Trading</h2>

      <div className="flex gap-3 mb-6">
        <select
          value={selectedPair}
          onChange={(e) => setChosenPair(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          {pairs.map((p) => (
            <option key={`${p.a}/${p.b}`} value={`${p.a}/${p.b}`}>{p.a} / {p.b}</option>
          ))}
        </select>
        <button onClick={handleAnalyze} disabled={loading || !selectedPair}
          className="px-6 py-2 rounded font-semibold text-black disabled:opacity-50"
          style={{ background: 'var(--accent-blue)' }}>
          {loading ? 'Analyzing...' : 'Analyze Pair'}
        </button>
      </div>

      {pairsLoading && <LoadingSpinner text="Loading configured pairs..." />}
      {pairsError && <ErrorPanel error={pairsError} onRetry={retryPairs} />}
      {!pairsLoading && !pairsError && pairs.length === 0 && (
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>No pairs are configured.</p>
      )}

      {loading && <LoadingSpinner text="Running cointegration analysis..." />}
      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {a && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard label="Cointegrated" value={a.is_cointegrated ? 'YES' : 'NO'}
              color={a.is_cointegrated ? 'var(--accent-green)' : 'var(--accent-red)'} />
            <MetricCard label="P-Value" value={num(a.coint_pvalue, 4)}
              color={a.coint_pvalue != null && a.coint_pvalue < 0.05 ? 'var(--accent-green)' : 'var(--accent-red)'} />
            <MetricCard label="Hedge Ratio" value={num(a.hedge_ratio, 4)} />
            <MetricCard label="Half-Life" value={a.half_life == null ? 'n/a' : `${num(a.half_life, 1)} days`} />
            <MetricCard label="Correlation" value={num(a.correlation, 4)} />
            <MetricCard label="Current Z-Score" value={num(a.current_zscore)}
              color={Math.abs(a.current_zscore) > 2 ? 'var(--accent-yellow)' : 'var(--text-primary)'} />
          </div>

          {/* Normalized Prices */}
          {a.prices_a?.length > 0 && (
            <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <Plot
                data={[
                  {
                    type: 'scatter', mode: 'lines',
                    x: a.prices_a.map((d: any) => d.date),
                    y: a.prices_a.map((d: any) => d.price / a.prices_a[0].price),
                    name: a.symbol_a, line: { color: '#58a6ff' },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: a.prices_b.map((d: any) => d.date),
                    y: a.prices_b.map((d: any) => d.price / a.prices_b[0].price),
                    name: a.symbol_b, line: { color: '#d29922' },
                  },
                ]}
                layout={{
                  title: 'Normalized Prices',
                  xaxis: { color: '#8b949e', gridcolor: '#21262d' },
                  yaxis: { color: '#8b949e', gridcolor: '#21262d', title: 'Normalized' },
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e6edf3' }, height: 350,
                  margin: { t: 40, b: 40, l: 60, r: 20 },
                  legend: { x: 0, y: 1, bgcolor: 'transparent' },
                }}
                useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Z-Score Chart */}
          {spreadData.length > 0 && (
            <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <Plot
                data={[
                  {
                    type: 'scatter', mode: 'lines',
                    x: spreadData.map((d: any) => d.date),
                    y: spreadData.map((d: any) => d.zscore),
                    name: 'Z-Score', line: { color: '#58a6ff' },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: [spreadData[0]?.date, spreadData[spreadData.length - 1]?.date],
                    y: [2, 2], name: 'Entry +2σ', line: { color: '#ff4444', dash: 'dash', width: 1 },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: [spreadData[0]?.date, spreadData[spreadData.length - 1]?.date],
                    y: [-2, -2], name: 'Entry -2σ', line: { color: '#00ff88', dash: 'dash', width: 1 },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: [spreadData[0]?.date, spreadData[spreadData.length - 1]?.date],
                    y: [0, 0], name: 'Mean', line: { color: '#8b949e', dash: 'dot', width: 1 },
                  },
                ]}
                layout={{
                  title: 'Z-Score of Spread',
                  xaxis: { color: '#8b949e', gridcolor: '#21262d' },
                  yaxis: { color: '#8b949e', gridcolor: '#21262d', title: 'Z-Score' },
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                  font: { color: '#e6edf3' }, height: 350,
                  margin: { t: 40, b: 40, l: 60, r: 20 },
                  legend: { x: 0, y: 1, bgcolor: 'transparent' },
                }}
                useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Backtest summary */}
          {a.backtest && (
            <div className="rounded-lg p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold mb-3">Pairs Backtest Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Total Return" value={pct(a.backtest.total_return ?? a.backtest.total_return_pct)}
                  color={signColor(a.backtest.total_return ?? a.backtest.total_return_pct)} />
                <MetricCard label="Trades" value={a.backtest.total_trades ?? 'n/a'} />
                <MetricCard label="Win Rate" value={pct(a.backtest.win_rate)} />
                <MetricCard label="Max Drawdown" value={pct(a.backtest.max_drawdown ?? a.backtest.max_drawdown_pct)} color="var(--accent-red)" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
