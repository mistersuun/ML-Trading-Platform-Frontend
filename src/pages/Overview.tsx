import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getApi, toApiError, isAbortError, ApiError } from '../api/client';
import { useLatestScan } from '../api/hooks';
import { MINUTE } from '../api/query';
import type { components } from '../api/schema';
import ErrorPanel from '../components/ErrorPanel';
import { Hero, Meter, PageHeader, Panel, EmptyState, Status, type Tone } from '../components/ui';
import { BulletBar, DrawdownChart, HBarList, LineChart, StackedBar } from '../components/charts';
import { RANGES, allocationTitle, funnelItems, funnelTitle, groupValueRows, otherLine, cashAvailable, leverageThreshold, leverageWarningText, sourceLabel, performanceTitle, rangeLabel, riskTitle, tradesSummary, type Range } from './overviewModel';
import { evenIndices } from '../components/charts/scale';
import { T, SERIES } from '../lib/tokens';
import { int, isNum, money, multiple, pct, signedMoney, signedNum, signedPct, usd } from '../lib/format';

type S = components['schemas'];
type Overview = S['OverviewResponse'];
type Proposal = S['ProposalResponse'];

/* ---------- data (local hooks; the shared api/hooks.ts belongs to the foundation) ---------- */

async function get<T>(fn: () => Promise<{ data?: T }>): Promise<T> {
  try {
    const { data } = await fn();
    return data as T;
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw toApiError(e);
  }
}

const useOverview = (range: Range) =>
  useQuery({
    queryKey: ['portfolio', 'overview', range],
    queryFn: ({ signal }) => get(() => getApi().GET('/api/portfolio/overview', {
      params: { query: { range: range === 'All' ? 'ALL' : range } }, signal,
    })),
    placeholderData: keepPreviousData,
    staleTime: 5 * MINUTE,
  });

const useRiskStatus = () =>
  useQuery({
    queryKey: ['risk', 'status'],
    queryFn: ({ signal }) => get(() => getApi().GET('/api/risk/status', { signal })),
    staleTime: MINUTE,
  });

const useProposal = (contribution: number, enabled: boolean) =>
  useQuery({
    queryKey: ['allocation', 'proposal', contribution],
    queryFn: ({ signal }) => get(() => getApi().GET('/api/allocation/proposal', {
      params: { query: { contribution } }, signal,
    })),
    enabled,
    staleTime: 5 * MINUTE,
  });

const isNoHoldings = (e: unknown) => e instanceof ApiError && (e.code === 'no_holdings' || e.status === 404);

/* ---------- finding titles (pure, exported for tests) ---------- */

/* ---------- small shared bits ---------- */

const Loading = ({ what, height }: { what: string; height?: number }) => (
  <EmptyState height={height}>Loading {what}…</EmptyState>
);

const sub = { color: 'var(--text-2)', fontSize: 12 } as const;

function tone(v: number | null | undefined): Tone {
  return !isNum(v) || v === 0 ? 'neutral' : v > 0 ? 'up' : 'down';
}

function tickLabel(iso: string, short: boolean): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const m = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return short ? `${m} ${d.getUTCDate()}` : `${m} ${String(d.getUTCFullYear()).slice(2)}`;
}

/** Backend warnings minus its leverage sentence, which the hero shows computed from the numbers. */
const bannerWarnings = (d: Overview) => (d.warnings ?? []).filter((w) => !/^Leverage \d/.test(w));

/* ---------- panels ---------- */

function NoHoldings() {
  return (
    <Panel title="No holdings file found">
      <p style={{ margin: '0 0 8px' }}>
        The portfolio value, chart and allocation are computed from your holdings. Create
        {' '}<code>state/holdings.csv</code> to see them.
      </p>
      <p style={{ margin: '0 0 8px', ...sub }}>
        One row per position, with a header line: <code>symbol,quantity</code>. Add a <code>CASH</code> row
        for uninvested cash, for example <code>CASH,4560</code>. Holdings are only read, never changed.
      </p>
      <pre style={{ margin: 0, padding: 8, background: 'var(--raised)', border: '1px solid var(--border)', borderRadius: 3 }}>
{`symbol,quantity
VTI,120
VEA,80
CASH,4560`}
      </pre>
    </Panel>
  );
}

function ValuePanels({ d, range }: { d: Overview; range: Range }) {
  const rangeShort = range === 'All' ? 'all time' : range;
  const dayTone = tone(d.day_change);
  const paper = d.paper_sleeve;
  const ccy = d.base_currency;
  const acct = d.account ?? null;
  const net = isNum(d.net_worth) ? d.net_worth : d.total_value;
  const lev = isNum(d.leverage) ? d.leverage : acct?.leverage;
  const threshold = leverageThreshold(acct);
  const loan = isNum(d.margin_loan) ? d.margin_loan : acct?.margin_loan;
  const positions = isNum(d.positions_value) ? d.positions_value : acct?.positions_value;
  const warning = leverageWarningText(lev, loan, ccy, threshold);
  const groupRows = groupValueRows(d.allocation, d.unclassified_value, positions);
  const other = otherLine(d.other_value);
  const rows: { key: string; label: ReactNode; value: ReactNode; share?: number | null }[] = groupRows
    ? groupRows.map((g) => ({ key: g.key, label: g.label, value: money(g.value, ccy, 0), share: g.share }))
    : d.accounts.map((a) => ({ key: a.key, label: a.label, value: money(a.value, ccy, 0), share: a.share }));
  const meterMax = Math.max(2, Math.ceil(isNum(lev) ? lev : 0));
  return (
    <section aria-label="Portfolio value" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
      <Panel flex="2 1 420px" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
        <Hero
          label="Net worth"
          value={money(net, ccy)}
          delta={isNum(d.day_change)
            ? { text: `${signedMoney(d.day_change, ccy)}${isNum(d.day_change_pct) ? ` (${signedPct(d.day_change_pct, 2)})` : ''}`, tone: dayTone, note: 'today' }
            : null}
          stats={[
            { label: `Return, ${rangeShort}`, value: signedPct(d.period_return), tone: tone(d.period_return) },
            { label: d.benchmark_label, value: signedPct(d.benchmark_return) },
            { label: 'Max drawdown', value: signedPct(d.max_drawdown), tone: isNum(d.max_drawdown) && d.max_drawdown < 0 ? 'down' : 'neutral' },
            { label: 'Cash available', value: money(cashAvailable(d.cash), ccy, 0) },
          ]}
        />
        <div data-testid="net-breakdown" style={{ color: 'var(--text-2)', fontSize: 13 }}>
          Positions {money(positions, ccy, 0)} · Margin loan {isNum(loan) && loan > 0 ? `−${money(loan, ccy, 0)}` : money(0, ccy, 0)}{other !== null && ` · Other ${signedMoney(other, ccy, 0)}`} · Net {money(net, ccy, 0)}
        </div>
        {isNum(lev) && (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div className="sub" style={{ marginBottom: 4 }}>Leverage (positions ÷ net worth), warns above {multiple(threshold)}</div>
            <Meter label="Leverage" value={lev} max={meterMax} text={multiple(lev)} warnAt={threshold + 1e-9} />
          </div>
        )}
        {warning && (
          <div role="note" aria-label="Margin warning" data-testid="leverage-warning"
            style={{ background: 'var(--warn-surface)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '8px 12px', width: '100%' }}>
            <Status kind="warn" /> {warning}
          </div>
        )}
      </Panel>
      <Panel flex="1 1 300px" title="Where the money is">
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{r.label}</span>
              <span>{r.value}{isNum(r.share) && <span className="sub"> · {pct(r.share, 0)}</span>}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: 'var(--text-2)' }}>
            <span>Signal sleeve · {paper.label ?? 'paper'}</span>
            <span>{isNum(paper.value) ? `${usd(paper.value, 0)} (not real money)` : 'no reading yet'}</span>
          </div>
        </div>
        <div className="sub" data-testid="source-label" style={{ marginTop: 8 }}>{sourceLabel(d.source, acct?.as_of)}</div>
      </Panel>
    </section>
  );
}

function PerformancePanel({ d, range }: { d: Overview; range: Range }) {
  const dates = useMemo(() => d.series.map((s) => s.date.slice(0, 10)), [d.series]);
  const ticks = useMemo(() => {
    const short = range === '1M' || range === '3M';
    return evenIndices(dates.length, short ? 3 : 5).map((index) => ({ index, label: tickLabel(dates[index], short) }));
  }, [dates, range]);
  const port = d.series.map((s) => s.portfolio);
  const bench = d.series.map((s) => s.benchmark);
  const dd = d.series.map((s) => s.drawdown);
  const hasBench = bench.some(isNum);
  const worst = isNum(d.max_drawdown) ? d.max_drawdown : null;
  return (
    <Panel
      flex="2 1 560px"
      title={performanceTitle(d.period_return, d.benchmark_return, rangeLabel(range, dates))}
      subtitle="Growth of $100, total return"
    >
      <LineChart
        x={dates}
        ariaLabel="Growth of $100: portfolio against benchmark"
        height={240}
        yFormat={(v) => `$${v.toFixed(0)}`}
        xTicks={ticks}
        series={[
          { name: 'Portfolio', values: port, color: SERIES[0], area: true },
          ...(hasBench ? [{ name: d.benchmark_label, values: bench, color: T.text3, dashed: true }] : []),
        ]}
        emptyText="No price history in this range."
      />
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="ph" style={{ fontSize: 12 }}>Drawdown from peak</div>
        <div className="sub">{worst !== null ? `worst ${signedPct(worst)}` : 'worst n/a'}</div>
      </div>
      <div style={{ marginTop: 4 }}>
        <DrawdownChart x={dates} values={dd} />
      </div>
    </Panel>
  );
}

type ProposalState = { data?: Proposal; isPending: boolean; isError: boolean; isFetching?: boolean };

function AllocationPanel({ d, proposal }: { d: Overview; proposal: ProposalState }) {
  const groups = d.allocation;
  const color = (i: number) => SERIES[i % SERIES.length];
  const link = proposal.data
    ? `Open rebalance proposal: ${proposal.data.trades.length > 0 ? tradesSummary(proposal.data.trades) : 'no trades needed'} →`
    : 'Open rebalance proposal →';
  return (
    <Panel flex="1 1 320px" title={allocationTitle(groups)} subtitle="Core + trend sleeve, by asset group"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.length === 0 ? (
        <EmptyState>No priced holdings to group.</EmptyState>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>Target</div>
              <StackedBar ariaLabel="Target allocation" format={(v) => `${(v * 100).toFixed(1)}%`}
                segments={groups.map((g, i) => ({ name: g.label, value: g.target, color: color(i) }))} />
            </div>
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>Now</div>
              <StackedBar ariaLabel="Current allocation" format={(v) => `${(v * 100).toFixed(1)}%`}
                segments={groups.map((g, i) => ({ name: g.label, value: g.now, color: color(i) }))} />
            </div>
          </div>
          <table className="t">
            <thead>
              <tr><th scope="col">Group</th><th scope="col" className="r">Target</th><th scope="col" className="r">Now</th><th scope="col" className="r">Drift</th></tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={g.key}>
                  <td>
                    <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 8, background: color(i) }} />
                    {g.label}
                  </td>
                  <td className="r">{pct(g.target)}</td>
                  <td className="r">{pct(g.now)}</td>
                  <td className="r" style={{ color: Math.abs(g.drift) >= 0.03 ? 'var(--warn)' : 'var(--text-2)' }}>
                    {signedNum(g.drift * 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <Link to="/allocation" style={{ fontSize: 12 }}>{link}</Link>
      <div className="sub">{d.allocation_basis}</div>
    </Panel>
  );
}

function FunnelPanel({ scan }: { scan: ReturnType<typeof useLatestScan> }) {
  if (scan.isPending) return <Panel flex="1 1 380px" title="Nightly scan"><Loading what="the nightly scan" /></Panel>;
  if (scan.isError) {
    if (scan.error.status === 404) {
      return <Panel flex="1 1 380px" title="No nightly scan stored yet"><EmptyState>The nightly scan has not run yet, so there is no funnel to show.</EmptyState></Panel>;
    }
    return <Panel flex="1 1 380px" title="Nightly scan"><ErrorPanel error={scan.error} onRetry={() => void scan.refetch()} /></Panel>;
  }
  const { funnel, age_hours: age, stale, generated_at: at } = scan.data;
  const health = (
    <>
      {isNum(age) ? `scan ${age < 1 ? 'under 1' : age.toFixed(1)} h old` : 'scan time unknown'}
      {stale && <> · <Status kind="warn" /> stale</>}
      {' '}<span className="sr-only">{at}</span>
    </>
  );
  if (!funnel) {
    return (
      <Panel flex="1 1 380px" title="Scan funnel is not available" subtitle={health}>
        <EmptyState>This scan was stored before funnel counts were recorded. The next nightly run will include them.</EmptyState>
      </Panel>
    );
  }
  const items = funnelItems(funnel);
  return (
    <Panel flex="1 1 380px" title={funnelTitle(funnel, age)} subtitle={<>Each step keeps only what passed the one before · {health}</>}>
      <HBarList ariaLabel="Scan funnel" items={items} max={funnel.tested} colors="ramp" />
    </Panel>
  );
}

function RiskPanel({ risk }: { risk: ReturnType<typeof useRiskStatus> }) {
  if (risk.isPending) return <Panel flex="1 1 380px" title="Signal sleeve risk"><Loading what="risk status" /></Panel>;
  if (risk.isError) {
    const e = risk.error;
    if (e.status === 503) {
      return (
        <Panel flex="1 1 380px" title="Risk state is not set up yet">
          <EmptyState>{e.message}</EmptyState>
        </Panel>
      );
    }
    return <Panel flex="1 1 380px" title="Signal sleeve risk"><ErrorPanel error={e} onRetry={() => void risk.refetch()} /></Panel>;
  }
  const r = risk.data;
  const cuts = r.ladder.filter((l) => l.kind === 'cut');
  const halt = r.ladder.find((l) => l.kind === 'halt');
  const max = halt?.drawdown ?? 0.1;
  const dd = isNum(r.drawdown) ? Math.abs(r.drawdown) : null;
  const mult = (m: number) => `risk ×${m}`;
  const limit = (key: string) => r.limits.find((l) => l.key === key);
  const stat = (label: string, key: string, positions = false) => {
    const l = limit(key);
    const used = positions ? r.open_positions ?? l?.used : l?.used;
    const maxv = positions ? r.max_positions : l?.maximum;
    return { label, used, maxv, frac: l?.unit === 'fraction' };
  };
  const stats = [stat('Open risk', 'heat'), stat('Positions', 'positions', true), stat('Orders today', 'orders_today')];
  const fmt = (v: number | null | undefined, frac: boolean) => (frac ? (isNum(v) ? pct(v) : 'n/a') : isNum(v) ? int(v) : 'n/a');
  return (
    <Panel flex="1 1 380px" title={riskTitle(r)}
      subtitle={`Paper account${cuts.length ? ` · risk is cut at ${cuts.map((c) => `${(c.drawdown * 100).toFixed(0)}%`).join(' and ')}` : ''}`}>
      <div style={{ marginTop: 18 }}>
        <BulletBar
          value={dd} max={max}
          ariaLabel={`Drawdown ${dd === null ? 'n/a' : `${(dd * 100).toFixed(1)}%`} of the ${(max * 100).toFixed(0)}% halt level`}
          fill={r.halted ? T.down : dd !== null && dd > 0 ? T.warn : undefined}
          valueLabel={`Now ${dd === null ? 'n/a' : signedPct(-dd)}`}
          marks={[
            ...cuts.map((c) => ({ at: c.drawdown, label: signedPct(-c.drawdown, 0), sub: mult(c.risk_multiplier) })),
            ...(halt ? [{ at: halt.drawdown, label: signedPct(-halt.drawdown, 0), sub: 'halt', color: T.down, align: 'right' as const }] : []),
          ]}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
        {stats.map((s) => (
          <div key={s.label}>
            <div className="sub">{s.label}</div>
            <div>{fmt(s.used, s.frac)} <span className="sub">/ {fmt(s.maxv, s.frac)}</span></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

interface FlowStep { name: string; detail: string; count: ReactNode; color?: string }

function FlowPanel({ scan, risk, proposal, overviewFailure, contribution, onContribution }: {
  overviewFailure?: 'no_holdings' | 'error' | null;
  scan: ReturnType<typeof useLatestScan>;
  risk: ReturnType<typeof useRiskStatus>;
  proposal: ProposalState;
  contribution: number;
  onContribution: (n: number) => void;
}) {
  const f = scan.data?.funnel ?? null;
  const r = risk.data;
  const na = <span style={{ color: 'var(--text-2)' }}>n/a</span>;
  let riskCount: ReactNode = na;
  if (r) {
    riskCount = r.halted ? <span style={{ color: 'var(--down)' }}>✕ halted</span>
      : r.kill_switch ? <span style={{ color: 'var(--down)' }}>✕ kill switch on</span>
        : r.reconcile.status !== 'clean' ? <span style={{ color: 'var(--warn)' }}>! reconcile mismatch</span>
          : <span style={{ color: 'var(--up)' }}>✓ clear</span>;
  }
  const steps: FlowStep[] = [
    { name: 'Nightly scan', detail: 'every watchlist symbol × every pattern', count: f ? `${int(f.tested)} candidates` : na },
    { name: 'Validation gates', detail: 'walk-forward, hold-out, null, cost stress', count: f ? `${int(f.bh)} passed` : na },
    { name: 'Risk checks', detail: 'halt, kill switch, limits, reconcile', count: riskCount },
    { name: 'Order module', detail: 'sizing, duplicates, bracket stop', count: f ? `${int(f.orders)} eligible` : na },
    { name: 'Alpaca paper', detail: 'long-only, no shorts', count: r ? (r.paper_trade_enabled ? 'paper only' : 'paper trading off') : na, color: 'var(--text-2)' },
  ];
  const trades = proposal.data?.trades ?? [];
  const buys = trades.filter((t) => t.action === 'buy').length;
  const sells = trades.filter((t) => t.action === 'sell').length;
  const laneText = proposal.data
    ? trades.length === 0 ? 'No trades needed' : [buys && `${buys} ${buys === 1 ? 'buy' : 'buys'}`, sells && `${sells} ${sells === 1 ? 'sell' : 'sells'}`].filter(Boolean).join(', ')
    : overviewFailure === 'no_holdings' ? 'Needs state/holdings.csv'
    : overviewFailure === 'error' || proposal.isError ? 'Proposal unavailable' : proposal.isPending ? 'Loading…' : 'n/a';
  return (
    <Panel title="How a signal becomes an order" subtitle="Every order passes every box; allocation trades never do: they go to you"
      style={{ marginBottom: 0 }}>
      <div role="list" aria-label="Signal to order" className="pipe" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 }}>
        {steps.map((s, k) => (
          <div key={s.name} role="listitem" className="pipe-step" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ border: '1px solid var(--border-strong)', borderRadius: 4, padding: '8px 12px', minWidth: 150, background: 'var(--panel)' }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="sub">{s.detail}</div>
              <div style={{ marginTop: 6, fontSize: 16, color: s.color ?? 'var(--text-1)' }}>{s.count}</div>
            </div>
            {k < steps.length - 1 && <span aria-hidden="true" className="pipe-arrow" style={{ color: 'var(--text-3)', fontSize: 18 }}>→</span>}
          </div>
        ))}
      </div>
      <div aria-label="Allocation proposal lane" style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)',
      }}>
        <div style={{ border: '1px solid var(--border-strong)', borderRadius: 4, padding: '8px 12px' }}>
          <div style={{ fontWeight: 600 }}>Allocation proposal</div>
          <div className="sub" data-testid="lane-text">{laneText}</div>
        </div>
        <span aria-hidden="true" style={{ color: 'var(--text-3)', fontSize: 18 }}>→</span>
        <div style={{ border: '1px dashed var(--accent)', borderRadius: 4, padding: '8px 12px' }}>
          <div style={{ fontWeight: 600 }}>You, in IBKR</div>
          <div className="sub">placed by hand</div>
        </div>
        <ContributionField value={contribution} onApply={onContribution} />
      </div>
    </Panel>
  );
}

function ContributionField({ value, onApply }: { value: number; onApply: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const n = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(n) && n >= 0;
  return (
    <form
      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
      onSubmit={(e) => { e.preventDefault(); if (valid) onApply(n); }}
    >
      <label htmlFor="contribution" className="sub">New cash to invest ($)</label>
      <input id="contribution" className="field" inputMode="decimal" style={{ width: 96 }} value={text}
        aria-invalid={!valid} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn" disabled={!valid}>Update proposal</button>
    </form>
  );
}

/* ---------- page ---------- */

export default function Overview() {
  const [range, setRange] = useState<Range>('1Y');
  const [contribution, setContribution] = useState(0);
  const overview = useOverview(range);
  const scan = useLatestScan();
  const risk = useRiskStatus();
  // Both heavy endpoints share a server-side cap, so the proposal waits for the overview.
  const proposal = useProposal(contribution, overview.isSuccess);

  const noHoldings = overview.isError && isNoHoldings(overview.error);
  const d = overview.data;
  const meta = [
    d ? `Prices at close ${d.as_of}` : null,
    scan.data ? `scan ${new Date(scan.data.generated_at).toISOString().slice(11, 16)} UTC` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title="Overview"
        meta={meta || undefined}
        actions={
          <span role="group" aria-label="Range" style={{ display: 'flex', gap: 4 }}>
            {RANGES.map((r) => (
              <button key={r} type="button" className="btn" aria-pressed={r === range} onClick={() => setRange(r)}
                style={{ fontSize: 12, minHeight: 26, padding: '3px 9px', ...(r === range ? { background: '#22222A' } : { background: 'transparent', color: 'var(--text-2)', borderColor: 'var(--border)' }) }}>
                {r}
              </button>
            ))}
          </span>
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {overview.isPending ? (
          <Panel title="Portfolio value"><Loading what="portfolio" height={160} /></Panel>
        ) : noHoldings ? (
          <NoHoldings />
        ) : overview.isError ? (
          <ErrorPanel error={overview.error} onRetry={() => void overview.refetch()} />
        ) : (
          <>
            {bannerWarnings(d!).length > 0 && (
              <div role="note" style={{ background: 'var(--warn-surface)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '8px 12px' }}>
                <Status kind="warn" /> {bannerWarnings(d!).join(' ')}
              </div>
            )}
            <ValuePanels d={d!} range={range} />
            <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
              <PerformancePanel d={d!} range={range} />
              <AllocationPanel d={d!} proposal={proposal} />
            </section>
          </>
        )}
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <FunnelPanel scan={scan} />
          <RiskPanel risk={risk} />
        </section>
        <FlowPanel scan={scan} risk={risk} proposal={proposal} overviewFailure={noHoldings ? 'no_holdings' : overview.isError ? 'error' : null} contribution={contribution} onContribution={setContribution} />
      </div>
    </>
  );
}
