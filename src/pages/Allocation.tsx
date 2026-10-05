import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getApi, toApiError, isAbortError, ApiError } from '../api/client';
import { MINUTE } from '../api/query';
import ErrorPanel from '../components/ErrorPanel';
import { DataTable, EmptyState, Hero, PageHeader, Panel, type Column, type Tone } from '../components/ui';
import { DivergingBars, SparklinePair, StackedBar } from '../components/charts';
import { SERIES, T } from '../lib/tokens';
import { currencyPrefix, isNum, money, multiple, pct } from '../lib/format';
import { isOverLeveraged, profileLabel, wipeoutFall } from './overviewModel';
import {
  driftTitle, furthestRow, proposalCurrency, investedManaged, cashLines, parseContribution, longDate, mixTitle, signedPts, stateLabel, tradeSummary, tradesTitle, trendTitle,
  voteGlyphs, votesLabel, type Group, type Proposal, type Row, type Trend,
} from './allocationModel';

const BANNER = 'Proposals only — you place the orders in IBKR';
const sub = { color: 'var(--text-2)', fontSize: 12 } as const;

/* ---------- data ---------- */

const useProposal = (contribution: number) =>
  useQuery({
    queryKey: ['allocation', 'proposal', contribution],
    queryFn: async ({ signal }): Promise<Proposal> => {
      try {
        const { data } = await getApi().GET('/api/allocation/proposal', { params: { query: { contribution } }, signal });
        return data as Proposal;
      } catch (e) {
        if (isAbortError(e)) throw e;
        throw toApiError(e);
      }
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * MINUTE,
  });

/* ---------- panels ---------- */

const Loading = ({ what, height }: { what: string; height?: number }) => <EmptyState height={height}>Loading {what}…</EmptyState>;

function Summary({ p }: { p: Proposal }) {
  const { cash, contribution, loan, toLoan } = cashLines(p);
  const ccy = proposalCurrency(p);
  const far = furthestRow(p.rows);
  const farTone: Tone = far?.outside ? 'warn' : 'neutral';
  return (
    <Panel flex="2 1 420px" style={{ display: 'flex', alignItems: 'flex-start' }}>
      <Hero
        label="Invested in core + trend"
        value={money(investedManaged(p), proposalCurrency(p), 0)}
        stats={[
          { label: 'Cash + this contribution', value: `${money(cash, ccy, 0)} + ${money(contribution, ccy, 0)}` },
          ...(loan > 0 ? [{ label: 'Margin loan', value: `−${money(loan, ccy, 0)}`, tone: 'warn' as Tone }] : []),
          ...(toLoan > 0 ? [{ label: 'Applied to loan', value: money(toLoan, ccy, 0) }] : []),
          { label: 'Furthest from target', value: far ? `${far.symbol} ${signedPts(far.drift)} pts` : 'n/a', tone: farTone },
          { label: 'Trades proposed', value: tradeSummary(p) },
        ]}
      />
    </Panel>
  );
}

const tradeColumns = (ccy: string): Column<Proposal['trades'][number]>[] => [
  { key: 'symbol', header: 'ETF', render: (t) => <b>{t.symbol}</b> },
  { key: 'action', header: 'Action', render: (t) => (t.action === 'sell' ? 'Sell' : 'Buy') },
  { key: 'shares', header: 'Shares', align: 'right', render: (t) => t.shares },
  { key: 'amount', header: 'Amount', align: 'right', render: (t) => money(t.amount, ccy, 0) },
];

export const REDUCE_MARGIN = 'Reduce margin loan first';

/** Prominent margin line above the trades; the backend's own note when it sent one, else computed from the leverage. */
function MarginFirst({ p }: { p: Proposal }) {
  if (!isOverLeveraged(p.leverage)) return null;
  const note = (p.notes ?? []).find((n) => n.startsWith(REDUCE_MARGIN));
  const fall = wipeoutFall(p.leverage);
  const text = note ?? `${REDUCE_MARGIN}: ${isNum(p.margin_loan) ? `${money(p.margin_loan, proposalCurrency(p), 0)} is borrowed` : 'money is borrowed'} (${multiple(p.leverage)} leverage).`;
  return (
    <div role="alert" data-testid="reduce-margin" style={{
      background: 'var(--warn-surface)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '10px 14px', fontSize: 15, fontWeight: 600,
    }}>
      <span style={{ color: 'var(--warn)' }} aria-hidden="true">! </span>{text}
      {fall !== null && <div style={{ ...sub, fontWeight: 400, marginTop: 4 }}>A {(fall * 100).toFixed(0)}% fall in your holdings would wipe out your equity.</div>}
    </div>
  );
}

function TradesPanel({ p }: { p: Proposal }) {
  return (
    <Panel flex="1 1 300px" title={tradesTitle(p)} subtitle="Proposed trades, cash first, whole shares">
      <DataTable columns={tradeColumns(proposalCurrency(p))} rows={p.trades} rowKey={(t) => `${t.action}-${t.symbol}`}
        caption="Proposed trades" empty="No trades proposed." />
      <div style={{ ...sub, marginTop: 8 }}>Cash left after trades: {money(p.cash_after, proposalCurrency(p), 0)}</div>
      {isNum(p.margin_loan_after) && p.margin_loan_after > 0 && (
        <div style={{ ...sub, marginTop: 4 }}>Margin loan after repayment: −{money(p.margin_loan_after, proposalCurrency(p), 0)}</div>
      )}
      {(p.unmanaged ?? []).length > 0 && <div style={{ ...sub, marginTop: 4 }}>Not managed here: {(p.unmanaged ?? []).join(', ')}</div>}
      {(p.notes ?? []).filter((n) => !(isOverLeveraged(p.leverage) && n.startsWith(REDUCE_MARGIN))).map((n) => <div key={n} style={{ ...sub, marginTop: 4 }}>{n}</div>)}
    </Panel>
  );
}

function DriftPanel({ rows }: { rows: Row[] }) {
  const data = useMemo(() => rows.map((r) => ({
    key: r.symbol, label: r.symbol, sub: r.name, value: r.drift * 100, band: r.band * 100,
  })), [rows]);
  const scale = Math.max(4, Math.ceil(Math.max(0, ...data.map((d) => Math.abs(d.value)))));
  return (
    <Panel title={driftTitle(rows)}
      subtitle="Drift from target, percentage points · grey zone = allowed band (the greater of ±5 pts and ±25% of target)">
      <div style={{ marginTop: 12 }}>
        {rows.length === 0
          ? <EmptyState>No sleeves to show.</EmptyState>
          : <DivergingBars rows={data} scale={scale} ariaLabel="Drift from target by ETF"
              axisLabels={[`−${scale} pts`, 'on target', `+${scale} pts`]} />}
      </div>
    </Panel>
  );
}

function MixPanel({ groups }: { groups: Group[] }) {
  const hasAfter = groups.length > 0 && groups.every((g) => isNum(g.after));
  const bars: { name: string; pick: (g: Group) => number }[] = [
    { name: 'Target', pick: (g) => g.target },
    { name: 'Now', pick: (g) => g.now },
    ...(hasAfter ? [{ name: 'After proposed trades', pick: (g: Group) => g.after as number }] : []),
  ];
  return (
    <Panel flex="1 1 360px" title={mixTitle(groups)} subtitle="Core + trend sleeve, share of invested value">
      {groups.length === 0 ? <EmptyState>No asset groups to show.</EmptyState> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bars.map((b) => (
              <div key={b.name}>
                <div style={{ ...sub, marginBottom: 4 }}>{b.name}</div>
                <StackedBar ariaLabel={`Mix ${b.name.toLowerCase()}`} height={26} format={(v) => pct(v, 1)}
                  segments={groups.map((g, i) => ({ name: g.label, value: b.pick(g), color: SERIES[i % SERIES.length] }))} />
              </div>
            ))}
          </div>
          <ul aria-label="Asset groups" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
            {groups.map((g, i) => (
              <li key={g.key}>
                <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6, background: SERIES[i % SERIES.length] }} />
                {g.label} <span style={sub}>{pct(g.target, 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function TrendCard({ t }: { t: Trend }) {
  const stateColor = t.state === 'held' ? T.up : t.state === 'partial' ? T.warn : T.text2;
  const price = t.months.map((m) => m.close);
  const ma = t.months.map((m) => m.average ?? null);
  return (
    <li data-trend={t.symbol} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '8px 10px', listStyle: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <b>{t.symbol}</b><span style={{ color: stateColor, fontSize: 12 }}>{stateLabel(t)}</span>
      </div>
      {t.data_available === false || t.months.length < 2
        ? <EmptyState height={56}>No month-end data.</EmptyState>
        : <SparklinePair price={price} ma={ma} ariaLabel={`${t.symbol} month-end closes against the 10-month average`} />}
      <div style={sub}>
        {votesLabel(t)} votes {voteGlyphs(t) || 'n/a'} · weight {pct(t.weight, 2)}
      </div>
    </li>
  );
}

function TrendPanel({ trend }: { trend: Trend[] }) {
  return (
    <Panel flex="1 1 460px" title={trendTitle(trend)}
      subtitle="Last 13 month-end closes (blue) vs 10-month average (grey) · held when above, T-bills when below">
      {trend.length === 0 ? <EmptyState>No trend markets to show.</EmptyState> : (
        <ul aria-label="Trend markets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, margin: 0, padding: 0 }}>
          {trend.map((t) => <TrendCard key={t.symbol} t={t} />)}
        </ul>
      )}
    </Panel>
  );
}

function NoHoldings() {
  return (
    <Panel title="No holdings file found">
      <p style={{ margin: '0 0 8px' }}>
        Proposals are computed from your holdings. Create <code>state/holdings.csv</code> to see them.
      </p>
      <p style={{ margin: 0, ...sub }}>
        One row per position, with a header line: <code>symbol,quantity</code>. Add a <code>CASH</code> row for
        uninvested cash, for example <code>CASH,4560</code>. Holdings are only read, never changed.
      </p>
    </Panel>
  );
}

function Skeleton() {
  return (
    <>
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Panel flex="2 1 420px" title="Invested in core + trend"><Loading what="portfolio" /></Panel>
        <Panel flex="1 1 300px" title="Proposed trades"><Loading what="trades" /></Panel>
      </section>
      <Panel title="Drift from target"><Loading what="drift" /></Panel>
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Panel flex="1 1 360px" title="Mix by asset group"><Loading what="mix" /></Panel>
        <Panel flex="1 1 460px" title="Trend sleeve"><Loading what="trend" /></Panel>
      </section>
    </>
  );
}

/* ---------- page ---------- */

function ContributionField({ text, onText, invalid, currency }: { text: string; onText: (t: string) => void; invalid: boolean; currency: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...sub, fontSize: 13 }}>
      Contribution {currencyPrefix(currency)}
      <input className="field" inputMode="decimal" aria-label="Contribution" aria-invalid={invalid}
        value={text} onChange={(e) => onText(e.target.value)} placeholder="0" style={{ width: 90 }} />
      {invalid && <span role="alert" style={{ color: 'var(--warn)' }}>Enter 0 or more</span>}
    </label>
  );
}

export default function Allocation() {
  const [text, setText] = useState('');
  const parsed = parseContribution(text);
  const [applied, setApplied] = useState(0);
  useEffect(() => {
    if (parsed === null) return;
    const id = setTimeout(() => setApplied(parsed), 350);
    return () => clearTimeout(id);
  }, [parsed]);

  const q = useProposal(applied);
  const p = q.data;
  const noHoldings = q.error instanceof ApiError && (q.error.code === 'no_holdings' || q.error.status === 404);

  let body: ReactNode;
  if (noHoldings) body = <NoHoldings />;
  else if (q.isError && !p) body = <ErrorPanel error={q.error} onRetry={() => void q.refetch()} />;
  else if (!p) body = <Skeleton />;
  else {
    body = (
      <>
        {q.isError && <ErrorPanel error={q.error} onRetry={() => void q.refetch()} />}
        <div style={sub} data-testid="profile-line">Allocation profile: {profileLabel(p.profile)}</div>
        <MarginFirst p={p} />
        <section aria-label="Proposal summary" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <Summary p={p} />
          <TradesPanel p={p} />
        </section>
        <DriftPanel rows={p.rows} />
        <section aria-label="Mix and trend" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <MixPanel groups={p.groups} />
          <TrendPanel trend={p.trend} />
        </section>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240, opacity: q.isFetching && p ? 0.85 : 1 }}>
      <PageHeader
        title="Allocation"
        meta={p ? `Quarterly review · prices at close ${longDate(p.as_of)}` : 'Quarterly review'}
        actions={
          <>
            <ContributionField text={text} onText={setText} invalid={parsed === null} currency={p ? proposalCurrency(p) : "USD"} />
            <span style={{ ...sub, fontSize: 13, marginLeft: 8 }}>{BANNER}</span>
          </>
        }
      />
      {body}
    </div>
  );
}
