// Shared Plotly look: transparent background, hairline grid, right-side y axis,
// hollow up candles / filled down candles. Plotly cannot read CSS variables, so
// colours come from tokens.ts.
import { FONT, SERIES, T } from './tokens';

type Obj = Record<string, unknown>;

export interface ThemeOptions {
  height?: number;
  title?: string;
  /** Show the legend (top-left, transparent). Default false. */
  legend?: boolean;
  margin?: { t?: number; b?: number; l?: number; r?: number };
  xaxis?: Obj;
  yaxis?: Obj;
  /** Anything else to merge into the layout. */
  extra?: Obj;
}

const axisBase = {
  color: T.text2,
  gridcolor: T.grid,
  zerolinecolor: T.borderStrong,
  linecolor: T.border,
  tickfont: { color: T.text2, size: 12 },
  automargin: true,
};

/** Layout template. y axis sits on the right. */
export function plotlyLayout(opts: ThemeOptions = {}): Obj {
  const { height = 300, title, legend = false, margin, xaxis, yaxis, extra } = opts;
  return {
    ...(title ? { title: { text: title, x: 0, xanchor: 'left', font: { size: 13, color: T.text1 } } } : {}),
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: FONT, color: T.text1, size: 12 },
    height,
    margin: { t: title ? 36 : legend ? 36 : 12, b: 32, l: 12, r: 56, ...margin },
    showlegend: legend,
    legend: { orientation: 'h', x: 1, xanchor: 'right', y: 1.12, bgcolor: 'rgba(0,0,0,0)', font: { color: T.text2, size: 12 } },
    hoverlabel: { bgcolor: T.raised, bordercolor: T.borderStrong, font: { color: T.text1, size: 12 } },
    xaxis: { ...axisBase, showgrid: false, rangeslider: { visible: false }, ...xaxis },
    yaxis: { ...axisBase, side: 'right', showgrid: true, ...yaxis },
    ...extra,
  };
}

/** Plotly config: no modebar except where asked (the scanner). */
export function plotlyConfig(modebar = false): Obj {
  return { displayModeBar: modebar ? 'hover' : false, displaylogo: false, responsive: true };
}

/** Candlestick trace style: hollow up candles, filled down candles. */
export const candleStyle = {
  increasing: { line: { color: T.up, width: 1 }, fillcolor: 'rgba(0,0,0,0)' },
  decreasing: { line: { color: T.down, width: 1 }, fillcolor: T.down },
};

/** Series line colour by index (fixed categorical order). */
export const seriesColor = (i: number): string => SERIES[i % SERIES.length];

export const markerUp = { symbol: 'triangle-up', size: 10, color: T.up };
export const markerDown = { symbol: 'triangle-down', size: 10, color: T.down };
