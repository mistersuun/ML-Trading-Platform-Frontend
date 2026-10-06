import { useState } from 'react';
import Plot from '../lib/Plot';
import { useMutation } from '@tanstack/react-query';
import { mlPredict } from '../api/client';
import KeyValueList from '../components/ui/KeyValueList';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import type { Metrics } from '../api/types';
import { useResolvedTheme } from '../lib/theme';
import { plotlyLayout, plotlyConfig, seriesColor } from '../lib/plotlyTheme';
import { num, pct, usd, signColor } from '../lib/format';
import { abstainReasonLabel, abstainRows, abstainTitle, calibrationLabel, probabilityHeader } from './mlModel';


export default function MLSignals() {
  useResolvedTheme(); // Plotly takes resolved colours: re-render on theme change
  const [symbol, setSymbol] = useState('AAPL');
  const mutation = useMutation({ mutationFn: (s: string) => mlPredict(s) });
  const { data: r, error, isPending: loading } = mutation;
  const retry = () => { if (mutation.variables !== undefined) mutation.mutate(mutation.variables); };
  const metrics = (r?.metrics ?? null) as Metrics | null;

  return (
    <div>
      <PageHeader title="ML Signals" />

      <div className="flex gap-3 mb-6">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol" className="field" />
        <button onClick={() => { if (!mutation.isPending) mutation.mutate(symbol); }} disabled={loading}
          className="btn btn-primary">
          {loading ? 'Training...' : 'Train & Predict'}
        </button>
      </div>

      {loading && <LoadingSpinner text="Training ML ensemble (RF + XGBoost + LightGBM)... this takes a moment" />}

      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {r && !loading && (
        <>
          {/* Metrics */}
          {metrics && (
            <div className="panel mb-6"><KeyValueList layout="grid" columns={6} items={[
  { label: 'Win Rate', value: pct(metrics.win_rate) },
  { label: 'Sharpe', value: num(metrics.sharpe) },
  { label: 'Profit Factor', value: num(metrics.profit_factor) },
  { label: 'Total Return', value: pct(metrics.total_return), color: signColor(metrics.total_return) },
  { label: 'Max Drawdown', value: pct(metrics.max_drawdown), color: "var(--down)" },
  { label: 'Trades', value: metrics.total_trades ?? 'n/a' },
  { label: 'Valid', value: r.is_valid ? 'YES' : 'NO', color: r.is_valid ? 'var(--up)' : 'var(--down)' },
]} /></div>
          )}

          {/* Calibration and abstentions */}
          <div className="panel mb-6" data-testid="ml-calibration">
            <h3 className="font-semibold mb-3">{abstainTitle(r.abstain_reasons, r.n_oos_bars)}</h3>
            <KeyValueList layout="grid" columns={3} items={[
  { label: 'Probability', value: calibrationLabel(r.calibrated), color: r.calibrated ? 'var(--up)' : 'var(--warn)' },
  { label: 'Model', value: r.model_selected ?? r.model_type ?? 'n/a' },
  { label: 'Latest bar', value: abstainReasonLabel(r.last_abstain_reason) },
]} />
            {abstainRows(r.abstain_reasons).length > 0 && (
              <ul aria-label="Abstain reasons" className="mt-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {abstainRows(r.abstain_reasons).map(([label, n]) => (
                  <li key={label} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 360 }}>
                    <span>{label}</span><span className="font-mono">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3" style={{ color: 'var(--text-2)', fontSize: 13 }}>
              ML signals are alert-only: they are never orders, whatever their probability.
            </p>
          </div>

          {/* Feature Importance */}
          {r.feature_importance.length > 0 && (
            <div className="panel mb-6">
              <Plot
                data={[{
                  type: 'bar',
                  x: r.feature_importance.map((f) => f.importance),
                  y: r.feature_importance.map((f) => f.feature),
                  orientation: 'h',
                  marker: { color: seriesColor(0) },
                }]}
                layout={plotlyLayout({ title: 'Top 20 Feature Importance', height: 500, margin: { l: 150, r: 20 }, yaxis: { side: 'left', autorange: 'reversed' } }) as never}
              config={plotlyConfig() as never}
              useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Equity Curve */}
          {r.equity_curve.length > 0 && (
            <div className="panel mb-6">
              <Plot
                data={[{
                  type: 'scatter', mode: 'lines',
                  x: r.equity_curve.map((d) => d.date),
                  y: r.equity_curve.map((d) => d.value),
                  line: { color: seriesColor(0), width: 2 }, name: 'ML Equity',
                }]}
                layout={plotlyLayout({ title: 'ML Strategy Equity Curve', height: 300 }) as never}
              config={plotlyConfig() as never}
              useResizeHandler style={{ width: '100%' }}
              />
            </div>
          )}

          {r.signals.length === 0 && (
            <p style={{ color: 'var(--text-2)' }}>The model produced no signals for {r.symbol}.</p>
          )}

          {/* Signals table */}
          {r.signals.length > 0 && (
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <h3 className="p-3 font-semibold" style={{ background: 'var(--panel)' }}>
                ML Signals ({r.total_signals})
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--raised)' }}>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Signal</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">{probabilityHeader(r.calibrated)}</th>
                    <th className="text-right p-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {r.signals.slice(-20).reverse().map((s, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-2 font-mono text-xs">{s.date?.slice(0, 10)}</td>
                      <td className="p-2 font-bold" style={{ color: s.signal === 'BUY' ? 'var(--up)' : 'var(--down)' }}>{s.signal}</td>
                      <td className="p-2 text-right font-mono">{usd(s.price)}</td>
                      <td className="p-2 text-right">{pct(s.p_up)}</td>
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
