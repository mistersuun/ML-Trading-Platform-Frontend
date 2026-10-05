import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, scanPatterns } from '../api/client';
import { LATEST_SCAN_KEY, useLatestScan } from '../api/hooks';
import type { ScanSignal } from '../api/types';
import PageHeader from '../components/ui/PageHeader';
import KeyValueList from '../components/ui/KeyValueList';
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
      <PageHeader
        title="Dashboard"
        actions={
          <button
            onClick={() => { if (!scan.isPending) scan.mutate(); }}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Scanning...' : 'Run scan now'}
          </button>
        }
      />

      {generatedAt && !loading && (
        <p className="text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
          <span>Latest scan: {generatedAt.toLocaleString()}</span>
          {stale && (
            <span role="status" style={{ color: 'var(--warn)' }}><span aria-hidden="true">! </span>STALE</span>
          )}
        </p>
      )}

      {loading && <LoadingSpinner text="Scanning all markets and patterns... this may take a few minutes" />}

      {error && !loading && <ErrorPanel error={error} onRetry={retry} />}

      {scanned && !loading && (
        <>
          <div className="panel mb-6"><KeyValueList layout="grid" columns={4} items={[
  { label: 'Total Signals', value: signals.length, color: "var(--accent)" },
  { label: 'Buy Signals', value: buys.length, color: "var(--up)" },
  { label: 'Sell Signals', value: sells.length, color: "var(--down)" },
  { label: 'Validated', value: valid.length, color: "var(--warn)" },
]} /></div>

          {signals.length === 0 ? (
            <p style={{ color: 'var(--text-2)' }}>No signals detected in the last 30 days.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--panel)' }}>
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
                        <td className="p-3" style={{ color: 'var(--text-2)' }}>{s.pattern}</td>
                        <td className="p-3 font-bold" style={{ color: s.signal === 'BUY' ? 'var(--up)' : 'var(--down)' }}>
                          {s.signal}
                        </td>
                        <td className="p-3 text-right font-mono">{usd(s.price)}</td>
                        <td className="p-3 text-right" style={{ color: s.days_ago <= 3 ? 'var(--up)' : 'var(--text-2)' }}>
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
        <div className="text-center py-20" style={{ color: 'var(--text-2)' }}>
          <p className="text-lg mb-2">No nightly scan results yet. Click "Run scan now" to scan all markets for pattern signals.</p>
          <p className="text-sm">Scans the last 30 days across all watchlist symbols and 20 patterns.</p>
        </div>
      )}
    </div>
  );
}
