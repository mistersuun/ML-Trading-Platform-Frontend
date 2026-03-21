import { useState } from 'react';
import { scanPatterns } from '../api/client';
import MetricCard from '../components/MetricCard';
import LoadingSpinner from '../components/LoadingSpinner';

interface Signal {
  symbol: string;
  pattern: string;
  signal: string;
  signal_date: string;
  days_ago: number;
  price: number;
  win_rate: number;
  profit_factor: number;
  sharpe: number;
  total_return_pct: number;
  total_trades: number;
  is_valid: boolean;
}

export default function Dashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleScan = async () => {
    setLoading(true);
    try {
      const res = await scanPatterns();
      setSignals(res.data.signals || []);
      setScanned(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const buys = signals.filter((s) => s.signal === 'BUY');
  const sells = signals.filter((s) => s.signal === 'SELL');
  const valid = signals.filter((s) => s.is_valid);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <button
          onClick={handleScan}
          disabled={loading}
          className="px-6 py-2 rounded font-semibold text-black transition-opacity disabled:opacity-50"
          style={{ background: 'var(--accent-green)' }}
        >
          {loading ? 'Scanning...' : 'Run Full Scan'}
        </button>
      </div>

      {loading && <LoadingSpinner text="Scanning all markets and patterns... this may take a few minutes" />}

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
                  {signals.map((s, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-3 font-mono font-semibold">{s.symbol}</td>
                      <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{s.pattern}</td>
                      <td className="p-3 font-bold" style={{ color: s.signal === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {s.signal}
                      </td>
                      <td className="p-3 text-right font-mono">${s.price.toFixed(2)}</td>
                      <td className="p-3 text-right" style={{ color: s.days_ago <= 3 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                        {s.days_ago}d ago
                      </td>
                      <td className="p-3 text-right">{(s.win_rate * 100).toFixed(1)}%</td>
                      <td className="p-3 text-right">{s.sharpe.toFixed(2)}</td>
                      <td className="p-3 text-right">{s.profit_factor.toFixed(2)}</td>
                      <td className="p-3 text-right" style={{ color: s.total_return_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {s.total_return_pct.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">{s.is_valid ? '✅' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!scanned && !loading && (
        <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>
          <p className="text-lg mb-2">Click "Run Full Scan" to scan all markets for pattern signals.</p>
          <p className="text-sm">Scans the last 30 days across all watchlist symbols and 20 patterns.</p>
        </div>
      )}
    </div>
  );
}
