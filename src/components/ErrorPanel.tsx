import { ApiError } from '../api/client';

interface Props {
  error: Error | ApiError | string;
  onRetry?: () => void;
}

export default function ErrorPanel({ error, onRetry }: Props) {
  const busy = error instanceof ApiError && (error.status === 429 || error.code === 'busy');
  const message = busy
    ? 'The server is busy with another heavy job. Please wait a moment and try again.'
    : typeof error === 'string' ? error : error.message;
  const code = error instanceof ApiError ? error.code : null;
  return (
    <div role="alert" className="rounded-lg p-4 mb-6 flex items-start justify-between gap-4"
      style={{ background: 'var(--panel)', border: '1px solid var(--down)' }}>
      <div>
        <div className="font-semibold mb-1" style={{ color: 'var(--down)' }}>
          {busy ? 'Server busy' : `Something went wrong${code ? ` (${code})` : ''}`}
        </div>
        <div className="text-sm">{message}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-primary">
          Retry
        </button>
      )}
    </div>
  );
}
