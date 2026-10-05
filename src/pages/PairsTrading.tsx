import { useState } from 'react';
import Plot from '../lib/Plot';
import { useMutation } from '@tanstack/react-query';
import { analyzePair } from '../api/client';
import { usePairs } from '../api/hooks';
import type { PairsBacktest, SpreadPoint } from '../api/types';
import KeyValueList from '../components/ui/KeyValueList';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { T } from '../lib/tokens';
import { plotlyLayout, plotlyConfig, seriesColor } from '../lib/plotlyTheme';
import { int, num, pct, signColor } from '../lib/format';
import { blockHalfLife, blockStatus, blockWindow, exitReasonRows, oosTitle, type PairsWalkForward } from './pairsModel';


export default function PairsTrading() {
  const { data: pairsData, error: pairsError, isPending: pairsLoading, refetch: refetchPairs } = usePairs();
  const retryPairs = () => void refetchPairs();
  const pairs = pairsData?.pairs ?? [];
  const [chosenPair, setChosenPair] = useState('');
  const selectedPair = chosenPair || (pairs.length > 0 ? `${pairs[0].a}/${pairs[0].b}` : '');
  const mutation = useMutation({ mutationFn: ({ a, b }: { a: string; b: string }) => analyzePair(a, b) });
  const { data: analysis, error, isPending: loading } = mutation;
  const retry = () => { if (mutation.variables) mutation.mutate(mutation.variables); };

  const handleAnalyze = () => {
    const [a, b] = selectedPair.split('/');
    if (!a || !b) return;
    if (mutation.isPending) return;
    mutation.mutate({ a, b });
  };

  const a = analysis;
  const spreadData = ((a?.spread_data ?? []) as unknown as SpreadPoint[]).filter((d) => d.zscore !== undefined);
  const bt = (a?.backtest ?? null) as (PairsBacktest & PairsWalkForward) | null;
  const exits = exitReasonRows(bt?.exit_reasons);
  const blocks = bt?.blocks ?? [];

  return (
    <div>
      <PageHeader title="Pairs Trading" />

      <div className="flex gap-3 mb-6">
        <select
          value={selectedPair}
          onChange={(e) => setChosenPair(e.target.value)}
          className="field"
        >
          {pairs.map((p) => (
            <option key={`${p.a}/${p.b}`} value={`${p.a}/${p.b}`}>{p.a} / {p.b}</option>
          ))}
        </select>
        <button onClick={handleAnalyze} disabled={loading || !selectedPair}
          className="btn btn-primary">
          {loading ? 'Analyzing...' : 'Analyze Pair'}
        </button>
      </div>

      {pairsLoading && <LoadingSpinner text="Loading configured pairs..." />}
      {pairsError && <ErrorPanel error={pairsError} onRetry={retryPairs} />}
      {!pairsLoading && !pairsError && pairs.length === 0 && (
        <p className="mb-6" style={{ color: 'var(--text-2)' }}>No pairs are configured.</p>
      )}

      {loading && <LoadingSpinner text="Running cointegration analysis..." />}
      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {a && !loading && (
        <>
          {/* Stats */}
          <div className="panel mb-6"><KeyValueList layout="grid" columns={6} items={[
  { label: 'Cointegrated', value: a.is_cointegrated ? 'YES' : 'NO', color: a.is_cointegrated ? 'var(--up)' : 'var(--down)' },
  { label: 'P-Value', value: num(a.coint_pvalue, 4), color: a.coint_pvalue != null && a.coint_pvalue < 0.05 ? 'var(--up)' : 'var(--down)' },
  { label: 'Hedge Ratio', value: num(a.hedge_ratio, 4) },
  { label: 'Half-Life', value: a.half_life == null ? 'n/a' : `${num(a.half_life, 1)} days` },
  { label: 'Correlation', value: num(a.correlation, 4) },
  { label: 'Current Z-Score', value: num(a.current_zscore), color: Math.abs(a.current_zscore ?? 0) > 2 ? 'var(--warn)' : 'var(--text-1)' },
]} /></div>

          {/* Normalized Prices */}
          {a.prices_a.length > 0 && (
            <div className="panel mb-6">
              <Plot
                data={[
                  {
                    type: 'scatter', mode: 'lines',
                    x: a.prices_a.map((d) => d.date),
                    y: a.prices_a.map((d) => d.price / a.prices_a[0].price),
                    name: a.symbol_a, line: { color: seriesColor(0) },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: a.prices_b.map((d) => d.date),
                    y: a.prices_b.map((d) => d.price / a.prices_b[0].price),
                    name: a.symbol_b, line: { color: seriesColor(3) },
                  },
                ]}
                layout={plotlyLayout({ title: 'Normalized Prices', height: 350, legend: true }) as never}
              config={plotlyConfig() as never}
              useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Z-Score Chart */}
          {spreadData.length > 0 && (
            <div className="panel mb-6">
              <Plot
                data={[
                  {
                    type: 'scatter', mode: 'lines',
                    x: spreadData.map((d) => d.date),
                    y: spreadData.map((d) => d.zscore),
                    name: 'Z-Score', line: { color: seriesColor(0) },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: [spreadData[0]?.date, spreadData[spreadData.length - 1]?.date],
                    y: [2, 2], name: 'Entry +2σ', line: { color: T.down, dash: 'dash', width: 1 },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: [spreadData[0]?.date, spreadData[spreadData.length - 1]?.date],
                    y: [-2, -2], name: 'Entry -2σ', line: { color: T.up, dash: 'dash', width: 1 },
                  },
                  {
                    type: 'scatter', mode: 'lines',
                    x: [spreadData[0]?.date, spreadData[spreadData.length - 1]?.date],
                    y: [0, 0], name: 'Mean', line: { color: T.text3, dash: 'dot', width: 1 },
                  },
                ]}
                layout={plotlyLayout({ title: 'Z-Score of Spread', height: 350, legend: true }) as never}
              config={plotlyConfig() as never}
              useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Backtest summary: out-of-sample walk-forward only */}
          {bt && (
            <div className="panel">
              <h3 className="font-semibold mb-3">Pairs Backtest Results</h3>
              <p className="mb-3" style={{ color: 'var(--text-2)', fontSize: 13 }}>
                Out-of-sample walk-forward: each block uses a hedge ratio, half-life and z window fitted on the bars
                before it, then trades the next block with fixed share counts and next-open fills. Pairs are alert-only.
              </p>
              <p className="font-semibold mb-3" data-testid="pairs-oos-title">{oosTitle(bt)}</p>
              <KeyValueList layout="grid" columns={4} items={[
  { label: 'Total Return', value: pct(bt.total_return ?? bt.total_return_pct), color: signColor(bt.total_return ?? bt.total_return_pct) },
  { label: 'Trades', value: bt.total_trades ?? 'n/a' },
  { label: 'Win Rate', value: pct(bt.win_rate) },
  { label: 'Max Drawdown', value: pct(bt.max_drawdown ?? bt.max_drawdown_pct), color: "var(--down)" },
  ...(bt.psr !== undefined ? [{ label: 'PSR (out of sample)', value: num(bt.psr, 3) }] : []),
  ...(bt.oos_significant != null ? [{ label: 'Significant', value: bt.oos_significant ? 'YES' : 'NO', color: bt.oos_significant ? 'var(--up)' : 'var(--text-1)' }] : []),
  ...(bt.latest_block_tradable != null ? [{ label: 'Latest block tradable', value: bt.latest_block_tradable ? 'YES' : 'NO', color: bt.latest_block_tradable ? 'var(--up)' : 'var(--warn)' }] : []),
]} />
              {exits.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Why trades ended</h4>
                  <ul aria-label="Exit reasons" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {exits.map(([label, n]) => (
                      <li key={label} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 360 }}>
                        <span>{label}</span><span className="font-mono">{int(n)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {blocks.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <h4 className="font-semibold mb-2">Out-of-sample blocks</h4>
                  <table className="w-full text-sm" aria-label="Out-of-sample blocks">
                    <thead>
                      <tr style={{ background: 'var(--raised)' }}>
                        <th className="text-left p-2">Traded</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-right p-2">Fit p-value</th>
                        <th className="text-right p-2">Half-life</th>
                        <th className="text-right p-2">Trades</th>
                        <th className="text-right p-2">Breaks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((b) => (
                        <tr key={b.block} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="p-2 font-mono text-xs">{blockWindow(b)}</td>
                          <td className="p-2" style={{ color: b.tradable ? 'var(--up)' : 'var(--text-2)' }}>{blockStatus(b)}</td>
                          <td className="p-2 text-right font-mono">{num(b.coint_pvalue, 3)}</td>
                          <td className="p-2 text-right font-mono">{blockHalfLife(b)}</td>
                          <td className="p-2 text-right font-mono">{b.n_trades ?? 'n/a'}</td>
                          <td className="p-2 text-right font-mono">{b.n_breaks ?? 'n/a'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
