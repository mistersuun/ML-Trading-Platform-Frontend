import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getApi, isAbortError, toApiError } from '../api/client';
import { MINUTE } from '../api/query';
import type { components } from '../api/schema';
import { Panel, Status } from '../components/ui';
import { absoluteTime, briefingTitle, costLabel, isBudgetSkip, monthSpend, relativeTime, skipReason, todaySpend } from './briefingModel';

type Briefing = components['schemas']['BriefingResponse'];

const KEY = ['briefing'] as const;
const sub = { color: 'var(--text-2)', fontSize: 12 } as const;
const list = { margin: '0 0 8px', paddingLeft: 18, listStyle: 'disc' } as const;

async function unwrap(p: Promise<{ data?: Briefing }>): Promise<Briefing> {
  try {
    return (await p).data as Briefing;
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw toApiError(e);
  }
}

const useBriefing = () =>
  useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => unwrap(getApi().GET('/api/briefing', { signal })),
    staleTime: 5 * MINUTE,
  });

const useRegenerate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(getApi().POST('/api/briefing/regenerate')),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
};

/** Short, stack-free message for a failed request. */
function failure(e: unknown): string {
  if (e instanceof ApiError && e.status === 429) return 'The server is busy with another heavy job. Try again in a minute.';
  return e instanceof ApiError && e.message ? e.message : 'Could not reach the server.';
}

const Section = ({ label, items }: { label: string; items: string[] }) =>
  items.length === 0 ? null : (
    <>
      <div style={{ ...sub, marginBottom: 2 }}>{label}</div>
      <ul style={list} aria-label={label}>{items.map((t, i) => <li key={i} style={{ marginBottom: 4 }}>{t}</li>)}</ul>
    </>
  );

function Meta({ b }: { b: Briefing }) {
  const spend = monthSpend(b.budget);
  const parts: React.ReactNode[] = [];
  if (b.generated_at) {
    parts.push(<time key="t" dateTime={b.generated_at} title={absoluteTime(b.generated_at)}>{relativeTime(b.generated_at)}</time>);
  }
  if (b.model) parts.push(<span key="m">{b.model}</span>);
  if (b.cost_usd != null) parts.push(<span key="c">{costLabel(b.cost_usd)}{b.cost_estimated ? ' (est.)' : ''}</span>);
  if (isBudgetSkip(b)) parts.push(<span key="d">{todaySpend(b.budget)}</span>);
  parts.push(
    <span key="s" style={spend.atCap ? { color: 'var(--warn)' } : undefined}>
      {spend.atCap && <span aria-hidden="true">! </span>}{spend.text}
    </span>,
  );
  parts.push(<span key="a"><span aria-hidden="true">◇ </span>Advisory · never places orders</span>);
  // the separator is drawn by CSS (.meta > * + *::before), so a wrapped line never starts with a dot
  return (
    <div className="meta" data-testid="briefing-meta" style={{ ...sub, color: 'var(--text-3)', marginTop: 8 }}>
      {parts}
    </div>
  );
}

export default function BriefingPanel() {
  const q = useBriefing();
  const regen = useRegenerate();
  const b = q.data;

  const regenButton = b && (
    <button type="button" className="btn" style={{ fontSize: 12, minHeight: 26, padding: '3px 9px' }}
      disabled={regen.isPending} onClick={() => regen.mutate()}>
      {regen.isPending ? 'Regenerating…' : 'Regenerate'}
    </button>
  );

  if (q.isPending) {
    return (
      <Panel title="Loading the latest briefing…">
        <div role="status" aria-label="Loading briefing" aria-busy="true" style={{ display: 'grid', gap: 8 }}>
          {[92, 78, 64].map((w) => <div key={w} style={{ height: 10, width: `${w}%`, background: 'var(--raised)', borderRadius: 2 }} />)}
        </div>
      </Panel>
    );
  }
  if (q.isError) {
    return (
      <Panel title="The briefing could not be loaded"
        aside={<button type="button" className="btn" style={{ fontSize: 12, minHeight: 26, padding: '3px 9px' }} onClick={() => void q.refetch()}>Retry</button>}>
        <div role="alert"><Status kind="fail" wrap>{failure(q.error)}</Status></div>
      </Panel>
    );
  }

  const body = b!.briefing;
  return (
    <Panel title={briefingTitle(b)} aside={regenButton}>
      {b!.status === 'ok' && body && (
        <>
          <Section label="Observations" items={body.observations} />
          <Section label="Risks" items={body.risks} />
          <Section label="What changed" items={body.what_changed} />
        </>
      )}
      {b!.status === 'none' && <div style={sub}>Nothing has been generated yet. Regenerate uses the latest stored scan.</div>}
      {b!.status === 'skipped' && (
        <div role="note">
          <Status kind="warn" wrap>Skipped: {skipReason(b!.reason)}.</Status>
          {b!.error && <div style={{ ...sub, marginTop: 2 }}>{b!.error.slice(0, 200)}</div>}
        </div>
      )}
      {b!.status === 'error' && (
        <div role="alert"><Status kind="fail" wrap>{b!.error ? `${b!.error}`.slice(0, 200) : 'The briefing run did not produce text.'}</Status></div>
      )}
      {b!.last_attempt && b!.status === 'ok' && (
        <div role="note" data-testid="last-attempt" style={{ marginTop: 6 }}>
          <Status kind="warn" wrap>
            {b!.last_attempt.at ? `Newer run ${relativeTime(b!.last_attempt.at)}` : 'Newer run'}:{' '}
            {b!.last_attempt.status === 'skipped' ? `skipped, ${skipReason(b!.last_attempt.reason)}` : 'failed'}
            {b!.last_attempt.status !== 'skipped' && b!.last_attempt.error ? `, ${b!.last_attempt.error.slice(0, 200)}` : ''}.
            Showing the last good briefing.
          </Status>
          {b!.last_attempt.status === 'skipped' && b!.last_attempt.error && (
            <div style={{ ...sub, marginTop: 2 }}>{b!.last_attempt.error.slice(0, 200)}</div>
          )}
        </div>
      )}
      {regen.isError && <div role="alert" style={{ marginTop: 6 }}><Status kind="fail" wrap>{failure(regen.error)}</Status></div>}
      <Meta b={b!} />
    </Panel>
  );
}
