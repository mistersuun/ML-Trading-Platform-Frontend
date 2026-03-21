import { useState, useEffect } from 'react';
import { listPatterns, runStressTest } from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function StressTestLab() {
  const [patterns, setPatterns] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('AAPL');
  const [pattern, setPattern] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    listPatterns().then((res) => {
      setPatterns(res.data.patterns);
      if (res.data.patterns.length > 0) setPattern(res.data.patterns[0]);
    });
  }, []);

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await runStressTest(symbol, pattern);
      setResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const r = result;
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
        <select value={pattern} onChange={(e) => setPattern(e.target.value)}
          className="px-3 py-2 rounded text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {patterns.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={handleRun} disabled={loading}
          className="px-6 py-2 rounded font-semibold text-black disabled:opacity-50"
          style={{ background: 'var(--accent-yellow)', color: '#000' }}>
          {loading ? 'Running...' : 'Run Stress Test'}
        </button>
      </div>

      {loading && <LoadingSpinner text="Running regime analysis, Monte Carlo (1000 sims), parameter sensitivity..." />}

      {r && !loading && (
        <>
          {/* Assessment */}
          {assessment && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MetricCard label="Regimes Consistent" value={assessment.regimes_consistent ? 'YES' : 'NO'}
                color={assessment.regimes_consistent ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <MetricCard label="MC Prob Positive" value={`${((assessment.mc_prob_positive || 0) * 100).toFixed(0)}%`}
                color={assessment.mc_prob_positive > 0.5 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <MetricCard label="MC Worst 5%" value={`${((assessment.mc_worst_case_5pct || 0) * 100).toFixed(1)}%`}
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
                  {regimes.map(([name, data]: [string, any]) => (
                    <tr key={name} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-2 font-semibold">{name.replace(/_/g, ' ')}</td>
                      <td className="p-2 text-right">{data.total_trades}</td>
                      <td className="p-2 text-right">{data.win_rate}</td>
                      <td className="p-2 text-right">{data.sharpe}</td>
                      <td className="p-2 text-right">{data.total_return}</td>
                      <td className="p-2 text-right">{data.profit_factor}</td>
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
                <MetricCard label="Mean Return" value={`${(mc.return_mean * 100).toFixed(1)}%`}
                  color={mc.return_mean >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
                <MetricCard label="Prob Positive" value={`${(mc.prob_positive * 100).toFixed(0)}%`}
                  color={mc.prob_positive > 0.5 ? 'var(--accent-green)' : 'var(--accent-red)'} />
                <MetricCard label="5th Pct Return" value={`${(mc.return_5th_pct * 100).toFixed(1)}%`} color="var(--accent-red)" />
                <MetricCard label="95th Pct Return" value={`${(mc.return_95th_pct * 100).toFixed(1)}%`} color="var(--accent-green)" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="Mean Drawdown" value={`${(mc.drawdown_mean * 100).toFixed(1)}%`} color="var(--accent-red)" />
                <MetricCard label="Sharpe Mean" value={mc.sharpe_mean.toFixed(2)} />
                <MetricCard label="Sharpe CI" value={`${mc.sharpe_ci_low.toFixed(2)} — ${mc.sharpe_ci_high.toFixed(2)}`} />
              </div>
            </div>
          )}

          {/* Sensitivity best/worst */}
          {r.sensitivity?.best_params && (
            <div className="rounded-lg p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold mb-3">Parameter Sensitivity</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                Robust: {r.sensitivity.is_robust ? '✅ Low variance across parameters' : '❌ High sensitivity to parameters'}
                {` (Sharpe σ = ${r.sensitivity.sharpe_std_across_params?.toFixed(2)})`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-green)' }}>Best Parameters</h4>
                  {r.sensitivity.best_params.map((p: any, i: number) => (
                    <div key={i} className="text-xs mb-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      SL={((p.stop_loss || 0) * 100).toFixed(1)}% TP={((p.take_profit || 0) * 100).toFixed(1)}% → Sharpe={p.sharpe?.toFixed(2)} WR={((p.win_rate || 0) * 100).toFixed(0)}%
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-red)' }}>Worst Parameters</h4>
                  {r.sensitivity.worst_params.map((p: any, i: number) => (
                    <div key={i} className="text-xs mb-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      SL={((p.stop_loss || 0) * 100).toFixed(1)}% TP={((p.take_profit || 0) * 100).toFixed(1)}% → Sharpe={p.sharpe?.toFixed(2)} WR={((p.win_rate || 0) * 100).toFixed(0)}%
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
