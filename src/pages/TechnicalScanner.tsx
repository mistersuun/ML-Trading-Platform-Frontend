import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Plot from '../lib/Plot';
import { useQuery } from '@tanstack/react-query';
import { getApi, isAbortError, toApiError } from '../api/client';
import { usePatterns } from '../api/hooks';
import { MINUTE } from '../api/query';
import type { components } from '../api/schema';
import ErrorPanel from '../components/ErrorPanel';
import { BulletBar, Histogram, LineChart } from '../components/charts';
import { Panel, PageHeader, EmptyState, Status, toneColor, type Tone } from '../components/ui';
import { candleStyle, markerDown, markerUp, plotlyConfig, plotlyLayout } from '../lib/plotlyTheme';
import { PALETTES, SERIES, T } from '../lib/tokens';
import { useResolvedTheme } from '../lib/theme';
import { int, isNum, NA, shortDate, signedPct, signedUsd, usd, xTickCount } from '../lib/format';
import { evenIndices } from '../components/charts/scale';
import {
  gateKind, gateResult, gateTrack, gatesTitle, gatingStats, lastTradesTitle, longDate, mergeCurves, oosTitle, winLossTitle,
} from './scannerLogic';

type Candidate = components['schemas']['CandidateResponse'];

/** GET /api/scanner/candidate. Heavy endpoint: 429 "busy" surfaces as an ApiError. */
async function fetchCandidate(symbol: string, pattern: string, signal?: AbortSignal): Promise<Candidate> {
  try {
    const { data } = await getApi().GET('/api/scanner/candidate', { params: { query: { symbol, pattern } }, signal });
    return data as Candidate;
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw toApiError(e);
  }
}

// ---------- panels ----------

const sub = { color: 'var(--text-2)', fontSize: 12 } as const;

function Loading({ height = 120 }: { height?: number }) {
  return <EmptyState height={height}>Loading…</EmptyState>;
}

function Hero({ c }: { c: Candidate }) {
  const [now] = useState(() => Date.now());
  const { total, failed } = gatingStats(c.gates);
  const dayTone: Tone = !isNum(c.day_change) ? 'neutral' : c.day_change >= 0 ? 'up' : 'down';
  const oosTone: Tone = !isNum(c.oos_return) ? 'neutral' : c.oos_return >= 0 ? 'up' : 'down';
  const validated = c.verdict === 'validated';
  const since = c.oos_curve[0]?.date.slice(0, 4);
  const luck = failed > 0 && c.nightly.tested && isNum(c.oos_return) && c.oos_return > 0
    ? ` It may still be luck: of ${int(c.nightly.tested)} ideas tested ${c.nightly.generated_at && now - Date.parse(c.nightly.generated_at) < 864e5 ? 'tonight' : 'in the latest scan'}, a result this good is expected by chance.`
    : '';
  return (
    <Panel style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 40px', alignItems: 'flex-end' }}>
      <div>
        <div style={sub}>{c.symbol} · {c.pattern}</div>
        <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1 }}>{usd(c.last_price)}</div>
        <div>
          {isNum(c.day_change) ? (
            <span style={{ color: toneColor(dayTone) }}>
              <span aria-hidden="true">{c.day_change >= 0 ? '▲ ' : '▼ '}</span>
              {signedUsd(c.day_change)} ({signedPct(c.day_change_pct, 2)})
            </span>
          ) : <span style={sub}>{NA}</span>}
          <span style={sub}> today{c.as_of ? ` · as of ${longDate(c.as_of)}` : ''}</span>
        </div>
      </div>
      <div>
        <div style={sub}>{since ? `If traded since ${since} (out of sample)` : 'If traded (out of sample)'}</div>
        <div data-testid="oos-return" style={{ fontSize: 20, color: toneColor(oosTone) }}>{signedPct(c.oos_return)}</div>
      </div>
      <div>
        <div style={sub}>Same rule, fit on the past (ignored)</div>
        <div data-testid="is-return" style={{ fontSize: 20, color: 'var(--text-3)' }}>{signedPct(c.in_sample_return)}</div>
      </div>
      <div>
        <div style={sub}>Verdict</div>
        <div style={{ fontSize: 20 }}>
          {validated ? <Status kind="pass">Validated</Status> : <Status kind="warn">Alert only</Status>}
        </div>
      </div>
      <div style={{ flex: '1 1 200px', color: 'var(--text-2)', fontSize: 12, maxWidth: 320 }}>
        {validated
          ? `All ${total} checks pass. The idea is eligible for paper orders.`
          : `${failed} of ${total} checks fail.${luck}`}
      </div>
    </Panel>
  );
}

function PriceChart({ c }: { c: Candidate }) {
  const bars = c.bars;
  const theme = useResolvedTheme(); // Plotly takes resolved colours, so rebuild on theme change
  const data = useMemo(() => {
    const P = PALETTES[theme];
    if (bars.length === 0) return [];
    const first = bars[0].date;
    const entries = c.trades.filter((t) => t.entry_date >= first);
    const exits = c.trades.filter((t) => t.exit_date != null && isNum(t.exit_price) && (t.exit_date as string) >= first);
    return [
      {
        type: 'candlestick', x: bars.map((b) => b.date), open: bars.map((b) => b.open), high: bars.map((b) => b.high),
        low: bars.map((b) => b.low), close: bars.map((b) => b.close), ...candleStyle(), name: c.symbol,
      },
      ...(entries.length ? [{
        type: 'scatter', mode: 'markers', name: 'Buy at next open', x: entries.map((t) => t.entry_date),
        y: entries.map((t) => t.entry_price), marker: { ...markerUp(), color: P.accent },
      }] : []),
      ...(exits.length ? [{
        type: 'scatter', mode: 'markers', name: 'Exit', x: exits.map((t) => t.exit_date),
        y: exits.map((t) => t.exit_price), marker: { ...markerDown(), color: P.text1 },
      }] : []),
    ];
  }, [bars, c.trades, c.symbol, theme]);

  const layout = useMemo(() => {
    const P = PALETTES[theme];
    const last = bars.length ? bars[bars.length - 1].date : null;
    const first = bars.length ? bars[0].date : null;
    const showHold = last !== null && first !== null && c.holdout_start <= last;
    const x0 = showHold && c.holdout_start < (first as string) ? (first as string) : c.holdout_start;
    return plotlyLayout({
      height: 280, margin: { t: 8 },
      extra: {
        hovermode: 'x unified',
        ...(showHold ? {
          shapes: [{ type: 'rect', xref: 'x', yref: 'paper', x0, x1: last, y0: 0, y1: 1, fillcolor: P.sidebarHover, line: { width: 0 }, layer: 'below' }],
          annotations: [{ xref: 'x', yref: 'paper', x: x0, y: 1, xanchor: 'left', yanchor: 'top', showarrow: false,
            text: `Hold-out from ${longDate(c.holdout_start)}`, font: { color: P.text2, size: 12 } }],
        } : {}),
      },
    });
  }, [bars, c.holdout_start, theme]);

  return (
    <Panel
      title={lastTradesTitle(c.trades)}
      aside="▲ buy at next open · ▼ exit · shaded = hold-out period"
    >
      {bars.length === 0
        ? <EmptyState height={280}>No price bars to chart.</EmptyState>
        : <Plot data={data as never} layout={layout as never} config={plotlyConfig(true) as never} useResizeHandler style={{ width: '100%' }} />}
    </Panel>
  );
}

function OosPanel({ c }: { c: Candidate }) {
  const merged = useMemo(() => mergeCurves(c.oos_curve, c.in_sample_curve), [c.oos_curve, c.in_sample_curve]);
  const hasOos = c.oos_curve.length > 1;
  const n = merged.x.length;
  const xTicks = useMemo(() => {
    if (n === 0) return [];
    return evenIndices(n, xTickCount()).map((index) => ({ index, label: shortDate(merged.x[index], true) }));
  }, [merged.x, n]);
  const series = useMemo(() => [
    { name: 'Out of sample (real test)', values: merged.a, color: SERIES[0] },
    { name: 'Fitted on the past (ignored)', values: merged.b, color: T.text3, dashed: true },
  ], [merged]);
  return (
    <Panel flex="2 1 520px" title={oosTitle(c.oos_return, c.in_sample_return)} subtitle={c.in_sample_method}>
      {hasOos
        ? <LineChart x={merged.x} series={series} ariaLabel="Cumulative return, out of sample versus fitted on the past"
            height={200} yFormat={(v) => signedPct(v, 0)} endFormat={(v) => signedPct(v, 1)} baseline={0} xTicks={xTicks} />
        : <EmptyState height={200}>Not enough out-of-sample history to draw the curve.</EmptyState>}
    </Panel>
  );
}

function TradesPanel({ c }: { c: Candidate }) {
  const ci = isNum(c.win_rate_ci_low) && isNum(c.win_rate_ci_high)
    ? ` (${Math.round(c.win_rate_ci_low * 100)}–${Math.round(c.win_rate_ci_high * 100)})` : '';
  return (
    <Panel flex="1 1 320px" title={winLossTitle(c.avg_win, c.avg_loss)}
      subtitle={`${int(c.n_oos_trades)} out-of-sample trades, return per trade`}>
      <Histogram values={c.oos_trade_returns} binCount={12} ariaLabel="Distribution of return per out-of-sample trade"
        format={(v) => signedPct(v, 1)} noun="trades" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
        <div><div style={sub}>Win rate</div><div>{isNum(c.win_rate) ? `${Math.round(c.win_rate * 100)}%` : NA}<span style={sub}>{ci}</span></div></div>
        <div><div style={sub}>Avg win</div><div style={{ color: 'var(--up)' }}>{signedPct(c.avg_win)}</div></div>
        <div><div style={sub}>Avg loss</div><div style={{ color: 'var(--down)' }}>{signedPct(c.avg_loss)}</div></div>
      </div>
    </Panel>
  );
}

function GatesPanel({ c }: { c: Candidate }) {
  const scale = useMemo(() => {
    const vals = c.gates.filter((g) => g.unit === 'fraction' && isNum(g.value)).map((g) => Math.abs(g.value as number));
    return Math.max(0.1, ...vals.map((v) => v * 1.25));
  }, [c.gates]);
  return (
    <Panel title={gatesTitle(c.gates)}
      subtitle="All must pass before the platform may place an order · the line marks the threshold">
      {c.gates.length === 0 ? <EmptyState>No checks were returned.</EmptyState> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {c.gates.map((g) => {
            const tr = gateTrack(g, scale);
            const kind = gateKind(g);
            const result = gateResult(g);
            return (
              <div key={g.key} data-testid={`gate-${g.key}`}
                className="gate-row">
                <span>
                  {g.name}
                  {g.note && <span style={{ ...sub, display: 'block' }}>{g.note}</span>}
                </span>
                <BulletBar value={tr.value} max={tr.max} height={14} status={kind}
                  marks={[{ at: tr.mark, color: T.text1 }]} ariaLabel={`${g.name}: ${result}`} />
                <Status kind={kind}>{g.status === 'unavailable' ? 'Unavailable' : result}</Status>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ---------- page ----------

export default function TechnicalScanner() {
  const { data: patternsData, error: patError, isPending: patLoading, refetch: refetchPatterns } = usePatterns();
  const patterns = patternsData?.patterns ?? [];
  const [symbol, setSymbol] = useState('QQQ');
  const [chosenPattern, setChosenPattern] = useState('');
  const pattern = chosenPattern || patterns[0] || '';
  const [target, setTarget] = useState<{ symbol: string; pattern: string } | null>(null);

  const q = useQuery({
    queryKey: ['scanner', 'candidate', target?.symbol ?? '', target?.pattern ?? ''],
    queryFn: ({ signal }) => fetchCandidate(target!.symbol, target!.pattern, signal),
    enabled: target !== null,
    staleTime: 5 * MINUTE,
  });
  const c = q.data;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = symbol.trim();
    if (!s || !pattern) return;
    setTarget({ symbol: s, pattern });
  };

  const loading = target !== null && q.isPending && !q.error;
  const meta: ReactNode = c ? `Daily · next-open fills · ${c.variant}` : 'Daily · next-open fills';

  const controls = (
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <label htmlFor="scan-symbol" style={{ color: 'var(--text-2)' }}>Symbol</label>
      <input id="scan-symbol" className="field" value={symbol} style={{ width: 80 }}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
      <label htmlFor="scan-pattern" style={{ color: 'var(--text-2)' }}>Pattern</label>
      <select id="scan-pattern" className="field" value={pattern} onChange={(e) => setChosenPattern(e.target.value)}>
        {patterns.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="submit" className="btn btn-primary" disabled={loading || !pattern}>
        {loading ? 'Analyzing…' : 'Analyze'}
      </button>
    </form>
  );

  return (
    <div>
      <PageHeader title="Scanner" meta={meta} actions={controls} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240 }}>
        {patError && <ErrorPanel error={patError} onRetry={() => void refetchPatterns()} />}
        {patLoading && <EmptyState height={40}>Loading patterns…</EmptyState>}

        {target === null && !patLoading && (
          <Panel title="Pick a symbol and a pattern to test it">
            <EmptyState height={120}>
              Nothing has been analysed yet. Choose a symbol and a pattern above, then press Analyze.
            </EmptyState>
          </Panel>
        )}

        {target !== null && q.error && (
          <ErrorPanel error={q.error} onRetry={() => void q.refetch()} />
        )}

        {loading && (
          <>
            <Panel title="Loading the candidate…"><Loading height={90} /></Panel>
            <Panel title="Loading the price chart…"><Loading height={280} /></Panel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <Panel flex="2 1 520px" title="Loading out-of-sample results…"><Loading height={200} /></Panel>
              <Panel flex="1 1 320px" title="Loading trades…"><Loading height={200} /></Panel>
            </div>
            <Panel title="Loading the checks…"><Loading height={120} /></Panel>
          </>
        )}

        {c && (
          <>
            <Hero c={c} />
            <PriceChart c={c} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
              <OosPanel c={c} />
              <TradesPanel c={c} />
            </div>
            <GatesPanel c={c} />
            {c.note && <div style={sub}>{c.note}</div>}
          </>
        )}
      </div>
    </div>
  );
}
