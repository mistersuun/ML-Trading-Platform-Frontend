import { useState, useEffect } from 'react';
import { getConfig } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Settings() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfig().then((res) => {
      setConfig(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading configuration..." />;

  const Section = ({ title, data }: { title: string; data: any }) => (
    <div className="rounded-lg mb-4 p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{key.replace(/_/g, ' ')}</span>
            <span className="font-mono">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      {config && (
        <>
          <Section title="Backtesting" data={config.backtest} />
          <Section title="Validation Thresholds" data={config.validation} />
          <Section title="Risk Management" data={config.risk} />
          <Section title="ML Configuration" data={config.ml} />
          <Section title="Watchlist" data={Object.fromEntries(
            Object.entries(config.watchlist || {}).map(([k, v]) => [k, (v as string[]).join(', ')])
          )} />
        </>
      )}
    </div>
  );
}
