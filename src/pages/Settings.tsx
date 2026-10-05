import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import { useConfig } from '../api/hooks';

function Section({ title, data }: { title: string; data: Record<string, unknown> | undefined }) {
  const entries = Object.entries(data ?? {});
  return (
    <div className="rounded-lg mb-4 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <h3 className="font-semibold mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No settings.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{key.replace(/_/g, ' ')}</span>
              <span className="font-mono">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { data: config, error, isPending: loading, refetch } = useConfig();
  const retry = () => void refetch();

  if (loading) return <LoadingSpinner text="Loading configuration..." />;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      {error && <ErrorPanel error={error} onRetry={retry} />}
      {config && (
        <>
          <Section title="Backtesting" data={config.backtest} />
          <Section title="Validation Thresholds" data={config.validation} />
          <Section title="Risk Management" data={config.risk} />
          <Section title="ML Configuration" data={config.ml} />
          <Section title="Watchlist" data={Object.fromEntries(
            Object.entries(config.watchlist ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])
          )} />
        </>
      )}
    </div>
  );
}
