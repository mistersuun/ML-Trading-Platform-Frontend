import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import {
  LineChart, AreaChart, DrawdownChart, StackedBar, DivergingBars, HBarList, BulletBar, Histogram, SparklinePair,
} from '..'
import { niceDomain, linePath } from '../scale'

const x = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
const a = x.map((_, i) => 100 + i * 1.5)
const b = x.map((_, i) => 100 + i * 0.5)

/** No NaN / undefined / Infinity may reach any attribute or text. */
function expectClean(container: HTMLElement) {
  const html = container.innerHTML
  expect(html).not.toMatch(/NaN|undefined|Infinity/)
}
function mockRect(el: HTMLElement, width = 1000) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width, height: 240, right: width, bottom: 240, x: 0, y: 0, toJSON: () => ({}) })
}

describe('scale helpers', () => {
  it('niceDomain expands to round ticks and survives degenerate input', () => {
    const d = niceDomain(101.2, 128.7)
    expect(d.lo).toBeLessThanOrEqual(101.2)
    expect(d.hi).toBeGreaterThanOrEqual(128.7)
    expect(niceDomain(5, 5).hi).toBeGreaterThan(niceDomain(5, 5).lo)
    expect(niceDomain(NaN, 1).ticks.length).toBeGreaterThan(0)
  })
  it('linePath breaks at null instead of emitting NaN', () => {
    const d = linePath([1, null, NaN, 2, 3], (i) => i * 10, (v) => v)
    expect(d).toBe('M0.0 1.0 M30.0 2.0 L40.0 3.0')
  })
})

describe('LineChart', () => {
  const props = {
    x, ariaLabel: 'Growth of $100', yFormat: (v: number) => `$${v.toFixed(0)}`,
    series: [{ name: 'Portfolio', values: a }, { name: '60/40', values: b, dashed: true }],
  }
  it('renders one path per series from the data, with legend and end label', () => {
    const { container } = render(<LineChart {...props} />)
    const lines = container.querySelectorAll('path[data-role="line"]')
    expect(lines).toHaveLength(2)
    expect(lines[0].getAttribute('d')).toMatch(/^M0\.0 /)
    expect(lines[1].getAttribute('stroke-dasharray')).toBe('6 5')
    expect(screen.getByTestId('end-label')).toHaveTextContent('$129')
    expect(screen.getAllByText('60/40').length).toBeGreaterThan(0) // legend (>= 2 series)
    expectClean(container)
  })
  it('has no legend for a single series', () => {
    render(<LineChart {...props} series={[props.series[0]]} />)
    expect(screen.queryAllByText('60/40')).toHaveLength(0)
  })
  it('is a focusable labelled figure with a hidden data table fallback', () => {
    render(<LineChart {...props} />)
    const fig = screen.getByRole('figure', { name: 'Growth of $100' })
    expect(fig).toHaveAttribute('tabindex', '0')
    const table = within(fig).getByRole('table', { hidden: true })
    expect(within(table).getAllByRole('row', { hidden: true }).length).toBe(21)
    expect(table).toHaveTextContent('2026-09-01')
  })
  it('shows crosshair tooltip values on pointer hover and hides on leave', () => {
    render(<LineChart {...props} />)
    const surface = screen.getByTestId('hover-surface')
    mockRect(surface)
    fireEvent.pointerMove(surface, { clientX: 0 })
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('2026-09-01')
    expect(tip).toHaveTextContent('Portfolio $100')
    fireEvent.pointerMove(surface, { clientX: 1000 })
    expect(screen.getByRole('tooltip')).toHaveTextContent('2026-09-20')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Portfolio $129')
    fireEvent.pointerLeave(surface)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
  it('is keyboard accessible: arrows move the cursor, Escape clears', () => {
    render(<LineChart {...props} />)
    const fig = screen.getByRole('figure')
    fig.focus()
    fireEvent.keyDown(fig, { key: 'ArrowRight' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('2026-09-01')
    fireEvent.keyDown(fig, { key: 'ArrowRight' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('2026-09-02')
    fireEvent.keyDown(fig, { key: 'End' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('2026-09-20')
    fireEvent.keyDown(fig, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
  it('keeps NaN, null and Infinity out of attributes and text', () => {
    const dirty = [100, NaN, null, 120, Infinity, 130, 131, 132, undefined, 140, ...a.slice(10)]
    const { container } = render(<LineChart {...props} series={[{ name: 'P', values: dirty }]} />)
    expectClean(container)
    fireEvent.keyDown(screen.getByRole('figure'), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('figure'), { key: 'ArrowRight' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('n/a')
    expectClean(container)
  })
  it('renders an empty state for no data or all-invalid data', () => {
    const { rerender } = render(<LineChart {...props} x={[]} series={[{ name: 'P', values: [] }]} emptyText="Nothing yet" />)
    expect(screen.getByRole('status')).toHaveTextContent('Nothing yet')
    rerender(<LineChart {...props} series={[{ name: 'P', values: x.map(() => NaN) }]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
  it('handles a single point', () => {
    const { container } = render(<LineChart x={['2026-10-05']} ariaLabel="one" series={[{ name: 'P', values: [100] }]} />)
    expectClean(container)
  })
})

describe('AreaChart', () => {
  it('draws a filled area path closed to the baseline', () => {
    const { container } = render(<AreaChart x={x} ariaLabel="area" series={[{ name: 'P', values: a }]} />)
    const area = container.querySelector('path[data-role="area"]')
    expect(area?.getAttribute('d')).toMatch(/Z$/)
    expectClean(container)
  })
  it('shows an empty state without data', () => {
    render(<AreaChart x={[]} ariaLabel="area" series={[{ name: 'P', values: [] }]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('DrawdownChart', () => {
  const dd = x.map((_, i) => (i === 0 ? 0 : -Math.abs(Math.sin(i)) * 0.047))
  it('renders an underwater area with 0% and the floor labelled', () => {
    const { container } = render(<DrawdownChart x={x} values={dd} />)
    expect(container.querySelector('path[data-role="area"]')).not.toBeNull()
    expect(container.textContent).toContain('0%')
    expect(container.textContent).toContain('−5%')
    expectClean(container)
  })
  it('hover shows the drawdown as a signed percent', () => {
    render(<DrawdownChart x={x} values={dd} />)
    const fig = screen.getByRole('figure')
    fireEvent.keyDown(fig, { key: 'Home' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('Drawdown 0%')
  })
  it('empty data -> empty state', () => {
    render(<DrawdownChart x={[]} values={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent(/no drawdown/i)
  })
})

describe('StackedBar', () => {
  const segments = [
    { name: 'US', value: 35.6, color: '#3987E5' },
    { name: 'Intl', value: 25.6, color: '#D95926' },
    { name: 'Gold', value: 7, color: '#9085E9' },
  ]
  it('renders proportional segments with 2px gaps and rounded outer ends only', () => {
    const { container } = render(<StackedBar segments={segments} ariaLabel="Now" format={(v) => `${v}%`} />)
    const segs = container.querySelectorAll<HTMLElement>('[data-segment]')
    expect(segs).toHaveLength(3)
    const total = 35.6 + 25.6 + 7
    expect(segs[0].style.flex).toMatch(/^0 0 calc\(52\.19\d*% - 2px\)$/)
    expect(total).toBeGreaterThan(0)
    expect(segs[0].style.flex).toContain('- 2px')
    expect(segs[0].style.borderRadius).toBe('4px 0px 0px 4px')
    expect(segs[1].style.borderRadius).toBe('0px 0px 0px 0px')
    expect(segs[2].style.borderRadius).toBe('0px 4px 4px 0px')
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', expect.stringContaining('US 35.6%'))
    expectClean(container)
  })
  it('drops zero/invalid segments and shows empty state when nothing is left', () => {
    const { container, rerender } = render(<StackedBar segments={[...segments, { name: 'Z', value: 0, color: '#fff' }, { name: 'N', value: NaN, color: '#fff' }]} ariaLabel="x" />)
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(3)
    rerender(<StackedBar segments={[{ name: 'Z', value: 0, color: '#fff' }]} ariaLabel="x" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('DivergingBars', () => {
  const rows = [
    { key: 'VTI', label: 'VTI', sub: 'US', value: 2.6, band: 5 },
    { key: 'VEA', label: 'VEA', sub: 'Intl', value: -6.2, band: 4.5 },
    { key: 'NA', label: 'NA', value: null, band: 3 },
  ]
  it('draws over/under bars on each side of centre, a band zone, and flags outside-band rows', () => {
    const { container } = render(<DivergingBars rows={rows} scale={8} ariaLabel="Drift" axisLabels={['−8 pts', 'on target', '+8 pts']} />)
    const vti = container.querySelector<HTMLElement>('[data-row="VTI"]')!
    const vea = container.querySelector<HTMLElement>('[data-row="VEA"]')!
    const barV = vti.querySelector<HTMLElement>('[data-role="bar"]')!
    const barE = vea.querySelector<HTMLElement>('[data-role="bar"]')!
    expect(barV.style.left).toBe('50%')
    expect(barE.style.right).toBe('50%')
    expect(barV.style.width).toBe(`${(2.6 / 8) * 50}%`)
    expect(vti.querySelector('[data-role="band"]')).not.toBeNull()
    expect(vti).toHaveTextContent('+2.6')
    expect(vti).toHaveTextContent('in band')
    expect(vea).toHaveTextContent('−6.2')
    expect(vea).toHaveTextContent('! outside')
    expect(container.querySelector('[data-row="NA"]')).toHaveTextContent('n/a')
    expectClean(container)
  })
  it('clamps bars to the half width and handles empty input', () => {
    const { container, rerender } = render(<DivergingBars rows={[{ key: 'a', label: 'a', value: 50 }]} scale={4} ariaLabel="d" />)
    expect(container.querySelector<HTMLElement>('[data-role="bar"]')!.style.width).toBe('50%')
    rerender(<DivergingBars rows={[]} scale={4} ariaLabel="d" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('HBarList', () => {
  const items = [
    { label: 'Candidates tested', value: 780 },
    { label: '30 OOS trades', value: 312 },
    { label: 'Orders placed', value: 0 },
  ]
  it('scales bars against the first value, uses the ramp, and keeps zero at zero width', () => {
    const { container } = render(<HBarList items={items} ariaLabel="Funnel" max={780} colors="ramp" />)
    const bars = container.querySelectorAll<HTMLElement>('[data-role="bar"]')
    expect(bars[0].style.width).toBe('100%')
    expect(bars[1].style.width).toBe(`${(312 / 780) * 100}%`)
    expect(bars[2].style.width).toBe('0%')
    expect(bars[0].style.background).not.toBe(bars[1].style.background)
    expect(screen.getByRole('list', { name: 'Funnel' })).toHaveTextContent('312')
    expectClean(container)
  })
  it('supports per-item maxima and custom display (limits)', () => {
    const { container } = render(<HBarList items={[{ label: 'Positions', value: 2, max: 8, display: '2 / 8' }]} ariaLabel="Limits" />)
    expect(container.querySelector<HTMLElement>('[data-role="bar"]')!.style.width).toBe('25%')
    expect(container).toHaveTextContent('2 / 8')
  })
  it('empty list and NaN values', () => {
    const { container, rerender } = render(<HBarList items={[{ label: 'x', value: NaN }]} ariaLabel="a" />)
    expectClean(container)
    rerender(<HBarList items={[]} ariaLabel="a" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('BulletBar', () => {
  it('fills value/max and places the threshold mark', () => {
    const { container } = render(<BulletBar value={0.4} max={1} marks={[{ at: 0.95 }]} status="pass" ariaLabel="PSR 0.40 vs 0.95" />)
    expect(container.querySelector<HTMLElement>('[data-role="fill"]')!.style.width).toBe('40%')
    expect(container.querySelector<HTMLElement>('[data-role="mark"]')!.style.left).toBe('95%')
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'PSR 0.40 vs 0.95')
    expectClean(container)
  })
  it('failing status uses the down colour, captions render for labelled marks', () => {
    const { container } = render(
      <BulletBar value={1.4} max={10} status="fail" valueLabel="Now −1.4%"
        marks={[{ at: 5, label: '−5%', sub: 'risk ×0.5' }, { at: 10, label: '−10%', sub: 'halt', align: 'right' }]} ariaLabel="dd" />)
    expect(container.querySelector<HTMLElement>('[data-role="fill"]')!.style.background).toMatch(/var\(--down\)/)
    expect(container).toHaveTextContent('Now −1.4%')
    expect(container).toHaveTextContent('halt')
    expectClean(container)
  })
  it('clamps overflow and tolerates missing values', () => {
    const { container, rerender } = render(<BulletBar value={50} max={10} ariaLabel="o" />)
    expect(container.querySelector<HTMLElement>('[data-role="fill"]')!.style.width).toBe('100%')
    rerender(<BulletBar value={NaN} max={10} marks={[{ at: NaN }]} ariaLabel="o" />)
    expect(container.querySelector<HTMLElement>('[data-role="fill"]')!.style.width).toBe('0%')
    expect(container.querySelector('[data-role="mark"]')).toBeNull()
    expectClean(container)
  })
})

describe('Histogram', () => {
  const values = [-3, -2, -2, -1, -0.5, 0.5, 1, 1, 2, 2, 2, 3, 4]
  it('bins values, colours bars by sign and labels the edges', () => {
    const { container } = render(<Histogram values={values} binCount={7} ariaLabel="Return per trade" noun="trades" format={(v) => `${v.toFixed(0)}%`} />)
    const bins = container.querySelectorAll<HTMLElement>('[data-role="bin"]')
    expect(bins).toHaveLength(7)
    expect(bins[0].style.background).toMatch(/var\(--down\)/) // down
    expect(bins[6].style.background).toMatch(/var\(--up\)/) // up
    const total = Array.from(bins).reduce((n, b) => n + Number(b.title.split(' ')[0]), 0)
    expect(total).toBe(values.length)
    expect(container).toHaveTextContent('−3%'.replace('−', '-'))
    expect(screen.getByRole('figure', { name: 'Return per trade' })).toBeInTheDocument()
    expectClean(container)
  })
  it('accepts precomputed bins and ignores non-finite values', () => {
    const { container } = render(<Histogram values={[1, NaN, null, 2]} binCount={2} ariaLabel="h" />)
    expect(container.querySelectorAll('[data-role="bin"]')).toHaveLength(2)
    expectClean(container)
  })
  it('empty -> empty state', () => {
    render(<Histogram values={[]} ariaLabel="h" noun="trades" />)
    expect(screen.getByRole('status')).toHaveTextContent('No trades')
  })
})

describe('SparklinePair', () => {
  const price = [100, 102, 101, 105, 108, 107, 111]
  const ma = [null, null, 101, 102, 103.5, 104.5, 106]
  it('draws the price and moving-average paths on a shared scale', () => {
    const { container } = render(<SparklinePair price={price} ma={ma} ariaLabel="SPY vs 10-month average" />)
    const px = container.querySelector('path[data-role="price"]')!.getAttribute('d')!
    const m = container.querySelector('path[data-role="ma"]')!.getAttribute('d')!
    expect(px.startsWith('M0.0')).toBe(true)
    expect(m.startsWith('M')).toBe(true)
    expect(m).not.toBe(px)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'SPY vs 10-month average')
    expectClean(container)
  })
  it('not enough history -> empty state', () => {
    render(<SparklinePair price={[100]} ma={[]} ariaLabel="x" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('hidden fallback table', () => {
  it('is wrapped in an sr-only div so it takes no layout space (a table box ignores 1px sizing)', () => {
    const { container } = render(<LineChart x={x} series={[{ name: 'A', values: a }]} ariaLabel="t" height={100} />)
    const table = container.querySelector('table')!
    expect(table.classList.contains('sr-only')).toBe(false)
    expect(table.parentElement!.classList.contains('sr-only')).toBe(true)
  })
})
