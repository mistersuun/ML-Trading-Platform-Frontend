import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runStressTest } from '../api/client';
import { usePatterns } from '../api/hooks';
import type { Sensitivity, StressReport } from '../api/types';
import KeyValueList from '../components/ui/KeyValueList';
import Status from '../components/ui/Status';
import PageHeader from '../components/ui/PageHeader';
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
      <PageHeader title="Stress Test Lab" />

      <div className="flex gap-3 mb-6 flex-wrap">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol" className="field" />
        <select value={pattern} onChange={(e) => setChosenPattern(e.target.value)}
          className="field">
          {patterns.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => { if (!mutation.isPending) mutation.mutate({ s: symbol, p: pattern }); }} disabled={loading || !pattern}
          className="btn btn-primary">
          {loading ? 'Running...' : 'Run Stress Test'}
        </button>
      </div>

      {patLoading && <LoadingSpinner text="Loading patterns..." />}
      {patError && <ErrorPanel error={patError} onRetry={retryPatterns} />}
      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {loading && <LoadingSpinner text="Running regime analysis, Monte Carlo (1000 sims), parameter sensitivity..." />}

      {!r && !loading && !error && !patError && (
        <p style={{ color: 'var(--text-2)' }}>Choose a symbol and pattern, then run the stress test.</p>
      )}

      {r && !loading && (
        <>
          {/* Assessment */}
          {assessment && (
            <div className="panel mb-6"><KeyValueList layout="grid" columns={4} items={[
  { label: 'Regimes Consistent', value: assessment.regimes_consistent ? 'YES' : 'NO', color: assessment.regimes_consistent ? 'var(--up)' : 'var(--down)' },
  { label: 'MC Prob Positive', value: pct(assessment.mc_prob_positive, 0), color: (assessment.mc_prob_positive ?? 0) > 0.5 ? 'var(--up)' : 'var(--down)' },
  { label: 'MC Worst 5%', value: pct(assessment.mc_worst_case_5pct), color: "var(--down)" },
  { label: 'Param Robust', value: assessment.param_robust ? 'YES' : 'NO', color: assessment.param_robust ? 'var(--up)' : 'var(--down)' },
]} /></div>
          )}

          {/* Regime Performance Table */}
          {regimes.length > 0 && (
            <div className="overflow-x-auto rounded-lg mb-6" style={{ border: '1px solid var(--border)' }}>
              <h3 className="p-3 font-semibold" style={{ background: 'var(--panel)' }}>Regime Performance</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--raised)' }}>
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
            <div className="panel mb-6">
              <h3 className="font-semibold mb-3">Monte Carlo Simulation ({mc.n_simulations} runs)</h3>
              <KeyValueList layout="grid" columns={4} items={[
  { label: 'Mean Return', value: pct(mc.return_mean), color: signColor(mc.return_mean) },
  { label: 'Prob Positive', value: pct(mc.prob_positive, 0), color: (mc.prob_positive ?? 0) > 0.5 ? 'var(--up)' : 'var(--down)' },
  { label: '5th Pct Return', value: pct(mc.return_5th_pct), color: "var(--down)" },
  { label: '95th Pct Return', value: pct(mc.return_95th_pct), color: "var(--up)" },
]} />
              <KeyValueList layout="grid" columns={3} items={[
  { label: 'Mean Drawdown', value: pct(mc.drawdown_mean), color: "var(--down)" },
  { label: 'Sharpe Mean', value: num(mc.sharpe_mean) },
  { label: 'Sharpe CI', value: `${num(mc.sharpe_ci_low)} — ${num(mc.sharpe_ci_high)}` },
]} />
            </div>
          )}

          {/* Sensitivity best/worst */}
          {sens?.best_params && (
            <div className="panel">
              <h3 className="font-semibold mb-3">Parameter Sensitivity</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                Robust: <Status kind={sens.is_robust ? 'pass' : 'fail'}>{sens.is_robust ? 'Low variance across parameters' : 'High sensitivity to parameters'}</Status>
                {` (Sharpe σ = ${num(sens.sharpe_std_across_params)})`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--up)' }}>Best Parameters</h4>
                  {sens.best_params.map((p, i) => (
                    <div key={i} className="text-xs mb-1 font-mono" style={{ color: 'var(--text-2)' }}>
                      SL={pct(p.stop_loss)} TP={pct(p.take_profit)} → Sharpe={num(p.sharpe)} WR={pct(p.win_rate, 0)}
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--down)' }}>Worst Parameters</h4>
                  {(sens.worst_params ?? []).map((p, i) => (
                    <div key={i} className="text-xs mb-1 font-mono" style={{ color: 'var(--text-2)' }}>
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
