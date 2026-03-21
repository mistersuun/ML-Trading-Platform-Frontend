import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { getConfiguredPairs, analyzePair } from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PairsTrading() {
  const [pairs, setPairs] = useState<{ a: string; b: string }[]>([]);
  const [selectedPair, setSelectedPair] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    getConfiguredPairs().then((res) => {
      const p = res.data.pairs || [];
      setPairs(p);
      if (p.length > 0) setSelectedPair(`${p[0].a}/${p[0].b}`);
    });
  }, []);

  const handleAnalyze = async () => {
    const [a, b] = selectedPair.split('/');
    if (!a || !b) return;
    setLoading(true);
    try {
      const res = await analyzePair(a, b);
      setAnalysis(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const a = analysis;
  const spreadData = a?.spread_data?.filter((d: any) => d.zscore !== undefined) || [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Pairs Trading</h2>

      <div className="flex gap-3 mb-6">
        <select
          value={selectedPair}
          onChange={(e) => setSelectedPair(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          {pairs.map((p) => (
            <option key={`${p.a}/${p.b}`} value={`${p.a}/${p.b}`}>{p.a} / {p.b}</option>
          ))}
        </select>
        <button onClick={handleAnalyze} disabled={loading}
          className="px-6 py-2 rounded font-semibold text-black disabled:opacity-50"
          style={{ background: 'var(--accent-blue)' }}>
          {loading ? 'Analyzing...' : 'Analyze Pair'}
        </button>
      </div>

      {loading && <LoadingSpinner text="Running cointegration analysis..." />}

      {a && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard label="Cointegrated" value={a.is_cointegrated ? 'YES' : 'NO'}
              color={a.is_cointegrated ? 'var(--accent-green)' : 'var(--accent-red)'} />
            <MetricCard label="P-Value" value={a.coint_pvalue?.toFixed(4)}
              color={a.coint_pvalue < 0.05 ? 'var(--accent-green)' : 'var(--accent-red)'} />
            <MetricCard label="Hedge Ratio" value={a.hedge_ratio?.toFixed(4)} />
            <MetricCard label="Half-Life" value={`${a.half_life?.toFixed(1)} days`} />
            <MetricCard label="Correlation" value={a.correlation?.toFixed(4)} />
            <MetricCard label="Current Z-Score" value={a.current_zscore?.toFixed(2)}
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
                <MetricCard label="Total Return" value={`${(a.backtest.total_return_pct || 0).toFixed(1)}%`}
                  color={(a.backtest.total_return_pct || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
                <MetricCard label="Trades" value={a.backtest.total_trades || 0} />
                <MetricCard label="Win Rate" value={`${((a.backtest.win_rate || 0) * 100).toFixed(1)}%`} />
                <MetricCard label="Max Drawdown" value={`${((a.backtest.max_drawdown_pct || 0) * 100).toFixed(1)}%`} color="var(--accent-red)" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
