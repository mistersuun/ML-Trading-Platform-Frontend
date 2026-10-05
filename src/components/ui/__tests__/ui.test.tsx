import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Panel, Status, Meter, DataTable, Hero, KeyValueList, PageHeader, EmptyState } from '..'
import { HeaderSlotContext } from '../headerSlot'

describe('Status', () => {
  it.each([
    ['pass', '✓', 'Pass'],
    ['fail', '✕', 'Fail'],
    ['warn', '!', 'Warn'],
    ['recorded', '–', 'Recorded'],
  ] as const)('%s shows a glyph and a word, not colour alone', (kind, glyph, word) => {
    const { container } = render(<Status kind={kind} />)
    expect(container).toHaveTextContent(`${glyph} ${word}`)
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(glyph)
  })
  it('custom text keeps the glyph', () => {
    const { container } = render(<Status kind="warn">2 of 3</Status>)
    expect(container).toHaveTextContent('! 2 of 3')
  })
})

describe('Meter', () => {
  it('exposes value/limit as a meter and fills proportionally', () => {
    render(<Meter label="Open risk" value={1} max={4} text="1.0% / 4%" />)
    const m = screen.getByRole('meter', { name: 'Open risk' })
    expect(m).toHaveAttribute('aria-valuenow', '1')
    expect(m).toHaveAttribute('aria-valuemax', '4')
    expect(screen.getByTestId('meter-fill').style.width).toBe('25%')
    expect(screen.getByText('1.0% / 4%')).toBeInTheDocument()
  })
  it('turns warn then down past thresholds and clamps at 100%', () => {
    const { rerender } = render(<Meter label="m" value={3} max={4} warnAt={3} failAt={4} />)
    expect(screen.getByTestId('meter-fill').style.background).toContain('--warn')
    rerender(<Meter label="m" value={9} max={4} warnAt={3} failAt={4} />)
    expect(screen.getByTestId('meter-fill').style.background).toContain('--down')
    expect(screen.getByTestId('meter-fill').style.width).toBe('100%')
  })
  it('missing value renders n/a, no NaN', () => {
    const { container } = render(<Meter label="m" value={NaN} max={4} />)
    expect(container).toHaveTextContent('n/a')
    expect(container.innerHTML).not.toMatch(/NaN/)
  })
})

describe('Panel / Hero / KeyValueList', () => {
  it('Panel labels itself with the finding title and shows the subtitle', () => {
    render(<Panel title="Portfolio is ahead of 60/40 by 2.1 points" subtitle="Growth of $100">x</Panel>)
    const sec = screen.getByRole('region', { name: 'Portfolio is ahead of 60/40 by 2.1 points' })
    expect(sec).toHaveTextContent('Growth of $100')
  })
  it('Hero shows the big value, a delta with glyph and stats', () => {
    const { container } = render(<Hero label="Total portfolio value" value="$124,380.52"
      delta={{ text: '+$612.40', tone: 'up', note: 'today' }} stats={[{ label: 'Max drawdown', value: '−4.7%', tone: 'down' }]} />)
    expect(container).toHaveTextContent('$124,380.52')
    expect(container).toHaveTextContent('▲ +$612.40')
    expect(container).toHaveTextContent('Max drawdown')
  })
  it('KeyValueList renders label/value pairs in both layouts', () => {
    const items = [{ label: 'Win rate', value: '51%' }, { label: 'Avg loss', value: '−1.6%', tone: 'down' as const }]
    const { rerender } = render(<KeyValueList items={items} />)
    expect(screen.getByText('Win rate').tagName).toBe('DT')
    rerender(<KeyValueList items={items} layout="grid" columns={2} />)
    expect(screen.getByText('51%').tagName).toBe('DD')
  })
})

describe('DataTable', () => {
  const cols = [
    { key: 's', header: 'Symbol', render: (r: { s: string; n: number }) => r.s },
    { key: 'n', header: 'Amount', align: 'right' as const, render: (r: { s: string; n: number }) => r.n },
  ]
  const rows = [{ s: 'VEA', n: 108 }, { s: 'TLT', n: 11 }]
  it('renders sticky headers, right-aligned numbers and 32px rows by default', () => {
    render(<DataTable columns={cols} rows={rows} rowKey={(r) => r.s} caption="Trades" />)
    const th = screen.getByRole('columnheader', { name: 'Amount' })
    expect(th.style.position).toBe('sticky')
    expect(th.style.textAlign).toBe('right')
    expect(th.style.height).toBe('32px')
    const cell = screen.getByRole('cell', { name: '108' })
    expect(cell.style.textAlign).toBe('right')
    expect(cell.style.fontVariantNumeric).toBe('tabular-nums')
  })
  it('supports 28 and 24px density', () => {
    const { rerender } = render(<DataTable columns={cols} rows={rows} rowKey={(r) => r.s} density={28} />)
    expect(screen.getByRole('cell', { name: 'VEA' }).style.height).toBe('28px')
    rerender(<DataTable columns={cols} rows={rows} rowKey={(r) => r.s} density={24} />)
    expect(screen.getByRole('cell', { name: 'VEA' }).style.height).toBe('24px')
  })
  it('empty rows show the empty state', () => {
    render(<DataTable columns={cols} rows={[]} rowKey={() => 0} empty="No trades proposed." />)
    expect(screen.getByRole('status')).toHaveTextContent('No trades proposed.')
  })
})

describe('PageHeader', () => {
  it('renders inline when there is no shell slot', () => {
    render(<PageHeader title="Overview" meta="Prices at close" actions={<button>1M</button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument()
  })
  it('portals into the shell slot when present', () => {
    const slot = document.createElement('header')
    document.body.appendChild(slot)
    render(<HeaderSlotContext.Provider value={slot}><PageHeader title="Risk &amp; orders" /></HeaderSlotContext.Provider>)
    expect(within(slot).getByRole('heading', { name: /Risk/ })).toBeInTheDocument()
    slot.remove()
  })
})

describe('EmptyState', () => {
  it('is a status region', () => {
    render(<EmptyState>Nothing yet</EmptyState>)
    expect(screen.getByRole('status')).toHaveTextContent('Nothing yet')
  })
})
