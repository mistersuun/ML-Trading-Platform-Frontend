import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, scanPatterns } from '../api/client';
import { LATEST_SCAN_KEY, useLatestScan } from '../api/hooks';
import type { ScanSignal } from '../api/types';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { num, pct, usd, signColor } from '../lib/format';

export default function Dashboard() {
  const qc = useQueryClient();
  const latest = useLatestScan();
  const scan = useMutation({
    mutationFn: () => scanPatterns(),
    // A live scan replaces the displayed nightly result until the next reload.
    onSuccess: (res) => {
      qc.setQueryData(LATEST_SCAN_KEY, {
        kind: 'technical', payload: res.signals, generated_at: new Date().toISOString(), age_hours: 0, stale: false,
      });
    },
  });
  const loading = scan.isPending;
  const noNightly = latest.error instanceof ApiError && latest.error.status === 404;
  // 404 = no nightly run stored yet: an empty state, not an error.
  const error = scan.error ?? (noNightly ? null : latest.error);
  const retry = () => (scan.error ? scan.mutate() : void latest.refetch());
  const signals: ScanSignal[] = latest.data?.payload ?? [];
  const scanned = latest.data !== undefined;
  const generatedAt = latest.data ? new Date(latest.data.generated_at) : null;
  const stale = latest.data?.stale ?? false;

  const buys = signals.filter((s) => s.signal === 'BUY');
  const sells = signals.filter((s) => s.signal === 'SELL');
  const valid = signals.filter((s) => s.is_valid);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <button
          onClick={() => { if (!scan.isPending) scan.mutate(); }}
          disabled={loading}
          className="px-6 py-2 rounded font-semibold text-black transition-opacity disabled:opacity-50"
          style={{ background: 'var(--accent-green)' }}
        >
          {loading ? 'Scanning...' : 'Run scan now'}
        </button>
      </div>

      {generatedAt && !loading && (
        <p className="text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <span>Latest scan: {generatedAt.toLocaleString()}</span>
          {stale && (
            <span role="status" className="px-2 py-0.5 rounded text-xs font-semibold text-black"
              style={{ background: 'var(--accent-yellow)' }}>STALE</span>
          )}
        </p>
      )}

      {loading && <LoadingSpinner text="Scanning all markets and patterns... this may take a few minutes" />}

      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {scanned && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Signals" value={signals.length} color="var(--accent-blue)" />
            <MetricCard label="Buy Signals" value={buys.length} color="var(--accent-green)" />
            <MetricCard label="Sell Signals" value={sells.length} color="var(--accent-red)" />
            <MetricCard label="Validated" value={valid.length} color="var(--accent-yellow)" />
          </div>

          {signals.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No signals detected in the last 30 days.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="text-left p-3">Symbol</th>
                    <th className="text-left p-3">Pattern</th>
                    <th className="text-left p-3">Signal</th>
                    <th className="text-right p-3">Price</th>
                    <th className="text-right p-3">Age</th>
                    <th className="text-right p-3">Win Rate</th>
                    <th className="text-right p-3">Sharpe</th>
                    <th className="text-right p-3">P/F</th>
                    <th className="text-right p-3">Return</th>
                    <th className="text-center p-3">Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s, i) => {
                    const ret = s.total_return ?? s.total_return_pct;
                    return (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="p-3 font-mono font-semibold">{s.symbol}</td>
                        <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{s.pattern}</td>
                        <td className="p-3 font-bold" style={{ color: s.signal === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {s.signal}
                        </td>
                        <td className="p-3 text-right font-mono">{usd(s.price)}</td>
                        <td className="p-3 text-right" style={{ color: s.days_ago <= 3 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                          {s.days_ago}d ago
                        </td>
                        <td className="p-3 text-right">{pct(s.win_rate)}</td>
                        <td className="p-3 text-right">{num(s.sharpe)}</td>
                        <td className="p-3 text-right">{num(s.profit_factor)}</td>
                        <td className="p-3 text-right" style={{ color: signColor(ret) }}>
                          {pct(ret)}
                        </td>
                        <td className="p-3 text-center">{s.is_valid ? '✅' : '❌'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {latest.isPending && !scanned && !loading && <LoadingSpinner text="Loading latest scan..." />}

      {!scanned && !loading && !error && !latest.isPending && (
        <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>
          <p className="text-lg mb-2">No nightly scan results yet. Click "Run scan now" to scan all markets for pattern signals.</p>
          <p className="text-sm">Scans the last 30 days across all watchlist symbols and 20 patterns.</p>
        </div>
      )}
    </div>
  );
}
