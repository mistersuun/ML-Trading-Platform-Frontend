import { scanPatterns } from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { useAction } from '../lib/useAsync';
import { num, pct, usd, signColor } from '../lib/format';

interface Signal {
  symbol: string;
  pattern: string;
  signal: string;
  signal_date: string;
  days_ago: number;
  price: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  sharpe: number | null;
  total_return?: number | null;
  total_return_pct?: number | null; // legacy name, same fraction semantics
  total_trades: number;
  is_valid: boolean;
}

const scan = () => scanPatterns().then((r) => (r.data.signals ?? []) as Signal[]);

export default function Dashboard() {
  const { data, error, loading, run, retry } = useAction(scan);
  const signals = data ?? [];
  const scanned = data !== null;

  const buys = signals.filter((s) => s.signal === 'BUY');
  const sells = signals.filter((s) => s.signal === 'SELL');
  const valid = signals.filter((s) => s.is_valid);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <button
          onClick={() => void run()}
          disabled={loading}
          className="px-6 py-2 rounded font-semibold text-black transition-opacity disabled:opacity-50"
          style={{ background: 'var(--accent-green)' }}
        >
          {loading ? 'Scanning...' : 'Run Full Scan'}
        </button>
      </div>

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

      {!scanned && !loading && !error && (
        <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>
          <p className="text-lg mb-2">Click "Run Full Scan" to scan all markets for pattern signals.</p>
          <p className="text-sm">Scans the last 30 days across all watchlist symbols and 20 patterns.</p>
        </div>
      )}
    </div>
  );
}
