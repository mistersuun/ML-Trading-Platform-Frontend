// Pure scale helpers shared by the SVG charts. Everything here returns finite
// numbers or null; no NaN ever reaches an SVG attribute.
export function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 1/2/5 x 10^k step that gives roughly `target` intervals over `range`. */
export function niceStep(range: number, target = 4): number {
  if (!finite(range) || range <= 0) return 1;
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const m = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return m * mag;
}

export interface Domain { lo: number; hi: number; ticks: number[] }

/** Expand [lo, hi] to nice tick boundaries. Degenerate input gets a unit-wide domain. */
export function niceDomain(lo: number, hi: number, target = 4): Domain {
  if (!finite(lo) || !finite(hi)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (hi === lo) { lo -= 0.5; hi += 0.5; }
  const step = niceStep(hi - lo, target);
  const nlo = Math.floor(lo / step + 1e-9) * step;
  const nhi = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = nlo; t <= nhi + step * 1e-6; t += step) ticks.push(Number(t.toPrecision(12)));
  return { lo: nlo, hi: nhi, ticks };
}

/** SVG path; null/non-finite values break the line instead of drawing to NaN. */
export function linePath(
  values: ReadonlyArray<number | null | undefined>,
  X: (i: number) => number,
  Y: (v: number) => number,
): string {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (!finite(v)) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

/** Closed area path between the line and a baseline y. Only contiguous runs are filled. */
export function areaPath(
  values: ReadonlyArray<number | null | undefined>,
  X: (i: number) => number,
  Y: (v: number) => number,
  baselineY: number,
): string {
  const parts: string[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 0) {
      const first = run[0], last = run[run.length - 1];
      const pts = run.map((i, k) => `${k ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(values[i] as number).toFixed(1)}`).join(' ');
      parts.push(`${pts} L${X(last).toFixed(1)} ${baselineY.toFixed(1)} L${X(first).toFixed(1)} ${baselineY.toFixed(1)} Z`);
    }
    run = [];
  };
  values.forEach((v, i) => { if (finite(v)) run.push(i); else flush(); });
  flush();
  return parts.join(' ');
}

/** Pick up to `count` evenly spaced indices from [0, n). */
export function evenIndices(n: number, count: number): number[] {
  if (n <= 0) return [];
  if (n === 1 || count <= 1) return [0];
  const c = Math.min(count, n);
  const out: number[] = [];
  for (let k = 0; k < c; k++) out.push(Math.round((k / (c - 1)) * (n - 1)));
  return Array.from(new Set(out));
}

export interface HistBin { from: number; to: number; count: number }

export function makeBins(values: ReadonlyArray<number | null | undefined>, binCount: number): HistBin[] {
  const vs = values.filter(finite);
  if (vs.length === 0) return [];
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi === lo) { lo -= 0.5; hi += 0.5; }
  const w = (hi - lo) / binCount;
  const bins: HistBin[] = Array.from({ length: binCount }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 }));
  vs.forEach((v) => { bins[Math.min(binCount - 1, Math.floor((v - lo) / w))].count++; });
  return bins;
}

