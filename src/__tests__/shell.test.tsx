import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithClient as render } from '../test/utils'
import App from '../App'

describe('app shell', () => {
  it('lists the nav in the agreed order with the Overview item active', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const labels = within(nav).getAllByRole('link').map((a) => a.textContent)
    expect(labels).toEqual(['Overview', 'Scanner', 'Pairs', 'ML', 'Stress', 'Allocation', 'Risk & orders', 'Settings'])
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveClass('on')
    expect(within(nav).getByRole('link', { name: 'Scanner' })).not.toHaveClass('on')
  })
  it('routes each nav item and puts the page title in the header bar', async () => {
    render(<App />)
    const header = screen.getByRole('banner')
    expect(await within(header).findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Allocation' }))
    expect(await within(header).findByRole('heading', { name: 'Allocation' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Risk & orders' }))
    expect(await within(header).findByRole('heading', { name: 'Risk & orders' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Risk & orders' })).toHaveClass('on')
  })
})
