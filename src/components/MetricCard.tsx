interface Props {
  label: string;
  value: string | number;
  color?: string;
}

export default function MetricCard({ label, value, color }: Props) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
