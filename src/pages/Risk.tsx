import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApi, toApiError, isAbortError } from '../api/client';
import { MINUTE } from '../api/query';
import type { components } from '../api/schema';
import ErrorPanel from '../components/ErrorPanel';
import { DataTable, EmptyState, Hero, KeyValueList, Meter, PageHeader, Panel, Status } from '../components/ui';
import type { Column } from '../components/ui';
import { HBarList, LineChart } from '../components/charts';
import { evenIndices } from '../components/charts/scale';
import { RAMP, SERIES, T } from '../lib/tokens';
import { int, isNum, pct, shortDate, signedPct, signedUsd, usd, xTickCount } from '../lib/format';
import { decisionsTitle, equityTitle, etTime, label, limitsTitle, type RiskStatus } from './riskModel';

type S = components['schemas'];
type Decision = S['DecisionRow'];
type Limit = S['LimitUse'];

const useRiskStatus = () =>
  useQuery({
    queryKey: ['risk', 'status'],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await getApi().GET('/api/risk/status', { signal });
        return data as RiskStatus;
      } catch (e) {
        if (isAbortError(e)) throw e;
        throw toApiError(e);
      }
    },
    staleTime: MINUTE,
  });

const sub = { color: 'var(--text-2)', fontSize: 12 } as const;
const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 } as const;
const INIT_CMD = 'uv run python main.py risk init';
const HALT_HINT = 'Use main.py risk halt';

function HaltButton() {
  // There is no halt endpoint on purpose: halting is a deliberate CLI action.
  return (
    <span title={HALT_HINT}>
      <button type="button" disabled aria-label={`Halt trading (${HALT_HINT})`}
        style={{
          font: 'inherit', fontWeight: 600, color: 'var(--text-3)', background: 'transparent',
          border: '1px solid var(--border-strong)', borderRadius: 3, padding: '4px 12px', minHeight: 28,
          opacity: 0.55, cursor: 'not-allowed',
        }}>
        Halt trading
      </button>
    </span>
  );
}

function tradingStatus(r: RiskStatus) {
  if (r.halted) return <Status kind="fail">Trading halted</Status>;
  if (r.kill_switch) return <Status kind="fail">Kill switch on</Status>;
  if (r.mode !== 'paper') return <Status kind="recorded">Trading off · dry run</Status>;
  return <Status kind="pass">Paper trading allowed</Status>;
}

function Loading({ what, height }: { what: string; height?: number }) {
  return <EmptyState height={height}>Loading {what}…</EmptyState>;
}

const fmtLimit = (v: number | null | undefined, unit: string) =>
  !isNum(v) ? 'n/a' : unit === 'fraction' ? pct(v) : unit === 'usd' ? usd(v, 0) : int(v);

/* ---------- panels ---------- */

function HeroPanel({ r }: { r: RiskStatus }) {
  const halve = r.ladder.find((l) => l.kind === 'cut');
  const halt = r.ladder.find((l) => l.kind === 'halt');
  const diff = isNum(r.sleeve_value) && isNum(r.peak) ? r.sleeve_value - r.peak : null;
  const dd = isNum(r.drawdown) ? r.drawdown : null;
  const delta = diff !== null
    ? {
        text: `${signedUsd(diff, 0)}${dd !== null ? ` (${signedPct(dd)})` : ''}`,
        tone: diff < 0 ? ('down' as const) : ('neutral' as const),
        note: `from peak ${usd(r.peak, 0)}`,
      }
    : null;
  const stat = (v: number | null | undefined) => (isNum(v) ? usd(v, 0) : 'n/a');
  return (
    <Hero
      label="Signal sleeve value (paper)"
      value={usd(r.sleeve_value)}
      delta={delta}
      stats={[
        { label: 'Room before risk is halved', value: stat(halve?.room) },
        { label: 'Room before halt', value: stat(halt?.room) },
        { label: 'Open positions', value: isNum(r.open_positions) ? `${int(r.open_positions)} of ${int(r.max_positions)}` : `n/a of ${int(r.max_positions)}` },
      ]}
    />
  );
}

function SwitchesPanel({ r }: { r: RiskStatus }) {
  const rec = r.reconcile;
  const clean = rec.status === 'clean' && rec.mismatches.length === 0;
  return (
    <Panel flex="1 1 300px" title="Safety switches">
      <KeyValueList items={[
        { label: 'Halt', value: r.halted ? <Status kind="fail">Halted</Status> : <Status kind="pass">Not halted</Status> },
        { label: 'Kill switch', value: r.kill_switch ? <Status kind="fail">On</Status> : <Status kind="pass">Off</Status> },
        {
          label: rec.broker_checked ? 'Broker matches records' : 'Ledger matches records',
          value: clean
            ? <Status kind="pass">{rec.broker_checked ? 'Clean' : 'Clean (broker not queried)'}</Status>
            : <Status kind="warn">{rec.mismatches.length} unmatched</Status>,
        },
        { label: 'Mode', value: r.mode === 'paper' ? 'Paper only' : r.mode },
      ]} />
      {r.halted && r.halt_reason && <div style={{ ...sub, marginTop: 8 }}>Halted: {r.halt_reason}</div>}
    </Panel>
  );
}

function EquityPanel({ r }: { r: RiskStatus }) {
  const h = r.equity_history;
  const x = useMemo(() => h.map((p) => p.ts.slice(0, 10)), [h]);
  const model = useMemo(() => {
    const peaks = h.reduce<number[]>((acc, p) => {
      acc.push(Math.max(acc.length ? acc[acc.length - 1] : -Infinity, isNum(p.peak) ? p.peak : p.sleeve_equity, p.sleeve_equity));
      return acc;
    }, []);
    const ladder = r.ladder.map((l) => ({ l, values: peaks.map((p) => p * (1 - l.drawdown)) }));
    return { peaks, ladder, last: peaks[peaks.length - 1] };
  }, [h, r.ladder]);
  const ticks = useMemo(() => evenIndices(x.length, xTickCount()).map((index) => ({ index, label: shortDate(x[index]) })), [x]);

  const series = [
    { name: 'Sleeve value', values: h.map((p) => p.sleeve_equity), color: SERIES[0] },
    { name: 'Peak', values: model.peaks, color: T.borderStrong, quiet: true },
    ...model.ladder.map(({ l, values }) => ({
      name: `−${(l.drawdown * 100).toFixed(0)}% ${l.kind === 'halt' ? 'halt' : `risk ×${l.risk_multiplier}`}`,
      values,
      color: l.kind === 'halt' ? T.down : T.text2,
      dashed: l.kind !== 'halt',
      quiet: true,
    })),
  ];
  return (
    <Panel title={equityTitle(r)}>
      <div style={{ ...sub, display: 'flex', flexWrap: 'wrap', gap: 14, margin: '4px 0 10px' }}>
        <span><span aria-hidden="true" style={{ display: 'inline-block', width: 16, borderTop: `2px solid ${SERIES[0]}`, verticalAlign: 'middle' }} /> Sleeve value</span>
        {r.ladder.map((l) => (
          <span key={l.kind + l.drawdown}>
            <span aria-hidden="true" style={{
              display: 'inline-block', width: 16, verticalAlign: 'middle',
              borderTop: l.kind === 'halt' ? `2px solid ${T.down}` : `1px dashed ${T.text2}`,
            }} />{' '}
            {`−${(l.drawdown * 100).toFixed(0)}% · ${l.kind === 'halt' ? 'halt' : `risk ×${l.risk_multiplier}`}`}
            {isNum(l.threshold_equity) ? ` at ${usd(l.threshold_equity, 0)}` : ''}
          </span>
        ))}
      </div>
      {h.length === 0 ? (
        <EmptyState height={220}>No sleeve readings recorded yet. One is saved each time the risk manager updates equity.</EmptyState>
      ) : (
        <LineChart
          x={x} series={series} height={220} xTicks={ticks} yFormat={(v) => usd(v, 0)} endLabel={false}
          ariaLabel="Signal sleeve value with the risk-cut and halt levels"
        />
      )}
    </Panel>
  );
}

function LimitsPanel({ limits }: { limits: Limit[] }) {
  return (
    <Panel flex="1 1 380px" title={limitsTitle(limits)} subtitle="Used vs maximum">
      {limits.length === 0 ? <EmptyState>No limits reported.</EmptyState> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {limits.map((l) => (
            <div key={l.key} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: 10, alignItems: 'center' }} title={l.note ?? undefined}>
              <span>{l.label}</span>
              <Meter
                value={l.used} max={l.maximum} label={`${l.label}: used versus maximum`}
                warnAt={l.maximum * 0.8} failAt={l.maximum}
                text={`${fmtLimit(l.used, l.unit)} / ${fmtLimit(l.maximum, l.unit)}`}
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ReasonsPanel({ r }: { r: RiskStatus }) {
  return (
    <Panel flex="1 1 380px" title={decisionsTitle(r)} subtitle="Why each signal did not become an order">
      {r.decision_reasons.length === 0 ? (
        <EmptyState>No order decisions recorded yet.</EmptyState>
      ) : (
        <HBarList
          ariaLabel="Order decisions by reason"
          items={r.decision_reasons.map((x) => ({ label: x.reason, value: x.count, display: int(x.count), color: RAMP[2] }))}
          labelWidth={150} valueWidth={40} monoLabels
        />
      )}
    </Panel>
  );
}

function DecisionsPanel({ rows }: { rows: Decision[] }) {
  const columns: Column<Decision>[] = [
    { key: 'ts', header: 'Time ET', render: (d) => etTime(d.ts) },
    { key: 'symbol', header: 'Symbol', render: (d) => <strong>{d.symbol ?? '–'}</strong> },
    { key: 'side', header: 'Side', render: (d) => label(d.side) },
    { key: 'status', header: 'Decision', render: (d) => <span style={{ color: 'var(--text-2)' }}>{label(d.status)}</span> },
    { key: 'reason', header: 'Reason', render: (d) => <span style={mono}>{d.reasons.length ? d.reasons.join(', ') : '–'}</span> },
  ];
  return (
    <Panel title="Latest decisions">
      <DataTable
        columns={columns} rows={rows} caption="Latest order decisions"
        rowKey={(d, i) => `${d.ts}-${d.symbol}-${i}`} empty="No order decisions recorded yet."
      />
    </Panel>
  );
}

/* ---------- page ---------- */

export default function Risk() {
  const q = useRiskStatus();
  const r = q.data;
  const err = q.isError ? q.error : null;
  const notInit = err?.status === 503;

  const meta = r
    ? `Signal sleeve · ${r.mode === 'paper' ? 'paper' : r.mode}${r.sleeve_as_of ? ` · as of ${r.sleeve_as_of.slice(0, 10)}` : ''}${r.reconcile.broker_checked ? '' : ' · broker not queried'}`
    : 'Signal sleeve · paper';

  const header = (
    <PageHeader
      title="Risk & orders" meta={meta}
      actions={r ? <>{tradingStatus(r)}<HaltButton /></> : <HaltButton />}
    />
  );

  if (notInit) {
    return (
      <div>
        {header}
        <main style={{ padding: 16 }}>
          <Panel title="Risk state is not set up yet">
            <EmptyState height={96}>
              <div>
                <p style={{ margin: 0 }}>Create it with <code>{INIT_CMD}</code>, then reload this page.</p>
              </div>
            </EmptyState>
          </Panel>
        </main>
      </div>
    );
  }

  const pending = q.isPending;
  const unavailable = err ? 'Unavailable until the risk status loads.' : null;
  const gap = <EmptyState height={96}>{unavailable ?? 'Loading…'}</EmptyState>;

  return (
    <div>
      {header}
      <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240 }}>
        {err && <ErrorPanel error={err} onRetry={() => void q.refetch()} />}
        <section aria-label="Sleeve status" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <Panel flex="2 1 420px" style={{ display: 'flex', alignItems: 'flex-start' }}>
            {r ? <HeroPanel r={r} /> : pending ? <Loading what="sleeve value" /> : gap}
          </Panel>
          {r ? <SwitchesPanel r={r} /> : <Panel flex="1 1 300px" title="Safety switches">{pending ? <Loading what="switches" /> : gap}</Panel>}
        </section>
        {r ? <EquityPanel r={r} /> : <Panel title="Sleeve value and risk cuts">{pending ? <Loading what="chart" height={220} /> : gap}</Panel>}
        <section aria-label="Limits and decisions" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {r ? <LimitsPanel limits={r.limits} /> : <Panel flex="1 1 380px" title="Limits">{pending ? <Loading what="limits" /> : gap}</Panel>}
          {r ? <ReasonsPanel r={r} /> : <Panel flex="1 1 380px" title="Order decisions">{pending ? <Loading what="decisions" /> : gap}</Panel>}
        </section>
        {r ? <DecisionsPanel rows={r.decisions} /> : <Panel title="Latest decisions">{pending ? <Loading what="decisions" /> : gap}</Panel>}
      </main>
    </div>
  );
}
