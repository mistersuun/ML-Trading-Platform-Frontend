import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorPanel from '../components/ErrorPanel';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useConfig } from '../api/hooks';
import { pct, usd } from '../lib/format';

/** Fractions stored as *_pct are shown as percentages. */
function display(key: string, value: unknown): string {
  if (typeof value === 'number' && (key.endsWith('_pct') || key.endsWith('_rate'))) return pct(value, 2);
  if (typeof value === 'number' && key.includes('capital')) return usd(value, 0);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function Section({ title, data }: { title: string; data: Record<string, unknown> | undefined }) {
  const entries = Object.entries(data ?? {});
  return (
    <div className="panel mb-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>No settings.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 text-sm py-1 border-b" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-2)' }}>{key.replace(/_/g, ' ')}</span>
              <span className="font-mono" style={{ textAlign: 'left', overflowWrap: 'anywhere' }}>{display(key, value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Appearance() {
  return (
    <div className="panel mb-4">
      <h3 className="font-semibold mb-3">Appearance</h3>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span style={{ color: 'var(--text-2)' }}>Theme (System follows your OS setting)</span>
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: config, error, isPending: loading, refetch } = useConfig();
  const retry = () => void refetch();

  if (loading) return <LoadingSpinner text="Loading configuration..." />;

  return (
    <div>
      <PageHeader title="Settings" />
      <Appearance />
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
