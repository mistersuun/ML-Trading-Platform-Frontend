import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runStressTest } from '../api/client';
import { usePatterns } from '../api/hooks';
import type { Sensitivity, StressReport } from '../api/types';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { num, pct, signColor } from '../lib/format';


export default function StressTestLab() {
  const { data: patternsData, error: patError, isPending: patLoading, refetch: refetchPatterns } = usePatterns();
  const retryPatterns = () => void refetchPatterns();
  const patterns = patternsData?.patterns ?? [];
  const [symbol, setSymbol] = useState('AAPL');
  const [chosenPattern, setChosenPattern] = useState('');
  const pattern = chosenPattern || patterns[0] || '';
  const mutation = useMutation({ mutationFn: ({ s, p }: { s: string; p: string }) => runStressTest(s, p) });
  const { error, isPending: loading } = mutation;
  const r = (mutation.data ?? null) as StressReport | null;
  const retry = () => { if (mutation.variables) mutation.mutate(mutation.variables); };
  const sens = r?.sensitivity && !Array.isArray(r.sensitivity) ? (r.sensitivity as Sensitivity) : null;

  const mc = r?.monte_carlo;
  const regimes = r?.regimes ? Object.entries(r.regimes) : [];
  const assessment = r?.assessment;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Stress Test Lab</h2>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol" className="px-3 py-2 rounded text-sm w-40"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <select value={pattern} onChange={(e) => setChosenPattern(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {patterns.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => { if (!mutation.isPending) mutation.mutate({ s: symbol, p: pattern }); }} disabled={loading || !pattern}
          className="px-6 py-2 rounded font-semibold text-black disabled:opacity-50"
          style={{ background: 'var(--accent-yellow)', color: '#000' }}>
          {loading ? 'Running...' : 'Run Stress Test'}
        </button>
      </div>

      {patLoading && <LoadingSpinner text="Loading patterns..." />}
      {patError && <ErrorPanel error={patError} onRetry={retryPatterns} />}
      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {loading && <LoadingSpinner text="Running regime analysis, Monte Carlo (1000 sims), parameter sensitivity..." />}

      {!r && !loading && !error && !patError && (
        <p style={{ color: 'var(--text-secondary)' }}>Choose a symbol and pattern, then run the stress test.</p>
      )}

      {r && !loading && (
        <>
          {/* Assessment */}
          {assessment && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MetricCard label="Regimes Consistent" value={assessment.regimes_consistent ? 'YES' : 'NO'}
                color={assessment.regimes_consistent ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <MetricCard label="MC Prob Positive" value={pct(assessment.mc_prob_positive, 0)}
                color={(assessment.mc_prob_positive ?? 0) > 0.5 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <MetricCard label="MC Worst 5%" value={pct(assessment.mc_worst_case_5pct)}
                color="var(--accent-red)" />
              <MetricCard label="Param Robust" value={assessment.param_robust ? 'YES' : 'NO'}
                color={assessment.param_robust ? 'var(--accent-green)' : 'var(--accent-red)'} />
            </div>
          )}

          {/* Regime Performance Table */}
          {regimes.length > 0 && (
            <div className="overflow-x-auto rounded-lg mb-6" style={{ border: '1px solid var(--border)' }}>
              <h3 className="p-3 font-semibold" style={{ background: 'var(--bg-secondary)' }}>Regime Performance</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    <th className="text-left p-2">Regime</th>
                    <th className="text-right p-2">Trades</th>
                    <th className="text-right p-2">Win Rate</th>
                    <th className="text-right p-2">Sharpe</th>
                    <th className="text-right p-2">Return</th>
                    <th className="text-right p-2">P/F</th>
                  </tr>
                </thead>
                <tbody>
                  {regimes.map(([name, data]) => (
                    <tr key={name} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-2 font-semibold">{name.replace(/_/g, ' ')}</td>
                      <td className="p-2 text-right">{data.total_trades ?? 'n/a'}</td>
                      <td className="p-2 text-right">{pct(data.win_rate)}</td>
                      <td className="p-2 text-right">{num(data.sharpe)}</td>
                      <td className="p-2 text-right">{pct(data.total_return)}</td>
                      <td className="p-2 text-right">{num(data.profit_factor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Monte Carlo */}
          {mc && !mc.error && (
            <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold mb-3">Monte Carlo Simulation ({mc.n_simulations} runs)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <MetricCard label="Mean Return" value={pct(mc.return_mean)}
                  color={signColor(mc.return_mean)} />
                <MetricCard label="Prob Positive" value={pct(mc.prob_positive, 0)}
                  color={(mc.prob_positive ?? 0) > 0.5 ? 'var(--accent-green)' : 'var(--accent-red)'} />
                <MetricCard label="5th Pct Return" value={pct(mc.return_5th_pct)} color="var(--accent-red)" />
                <MetricCard label="95th Pct Return" value={pct(mc.return_95th_pct)} color="var(--accent-green)" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Mean Drawdown" value={pct(mc.drawdown_mean)} color="var(--accent-red)" />
                <MetricCard label="Sharpe Mean" value={num(mc.sharpe_mean)} />
                <MetricCard label="Sharpe CI" value={`${num(mc.sharpe_ci_low)} — ${num(mc.sharpe_ci_high)}`} />
              </div>
            </div>
          )}

          {/* Sensitivity best/worst */}
          {sens?.best_params && (
            <div className="rounded-lg p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold mb-3">Parameter Sensitivity</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                Robust: {sens.is_robust ? '✅ Low variance across parameters' : '❌ High sensitivity to parameters'}
                {` (Sharpe σ = ${num(sens.sharpe_std_across_params)})`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-green)' }}>Best Parameters</h4>
                  {sens.best_params.map((p, i) => (
                    <div key={i} className="text-xs mb-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      SL={pct(p.stop_loss)} TP={pct(p.take_profit)} → Sharpe={num(p.sharpe)} WR={pct(p.win_rate, 0)}
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-red)' }}>Worst Parameters</h4>
                  {(sens.worst_params ?? []).map((p, i) => (
                    <div key={i} className="text-xs mb-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      SL={pct(p.stop_loss)} TP={pct(p.take_profit)} → Sharpe={num(p.sharpe)} WR={pct(p.win_rate, 0)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
