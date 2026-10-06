import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithClient } from '../../test/utils'
import { server } from '../../test/server'
import { briefingFixture } from '../../test/handlers'
import BriefingPanel from '../BriefingPanel'
import { absoluteTime, briefingTitle, costLabel, monthSpend, relativeTime, skipReason } from '../briefingModel'

const serve = (body: object) => server.use(http.get('*/api/briefing', () => HttpResponse.json({ ...briefingFixture, ...body })))

describe('BriefingPanel states', () => {
  it('shows a loading skeleton first', async () => {
    renderWithClient(<BriefingPanel />)
    expect(screen.getByRole('status', { name: 'Loading briefing' })).toBeInTheDocument()
    await screen.findByRole('heading', { name: briefingFixture.briefing.headline })
  })

  it('ok: headline, bullets and the meta line', async () => {
    renderWithClient(<BriefingPanel />)
    expect(await screen.findByRole('heading', { name: 'Scan found no new survivors; the signal sleeve is quiet' })).toBeInTheDocument()
    expect(screen.getByText('International equity is 3 points under target')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Risks' })).getByText(/Drawdown is 1\.4%/)).toBeInTheDocument()
    const meta = screen.getByTestId('briefing-meta')
    expect(meta).toHaveTextContent('claude-opus-5-5')
    expect(meta).toHaveTextContent('US$0.012')
    expect(meta).toHaveTextContent('US$0.41 of US$5.00 this month')
    expect(meta).toHaveTextContent('Advisory · never places orders')
    expect(meta.querySelector('time')).toHaveAttribute('title', '2026-10-05 22:40 UTC')
  })

  it('none: computed fallback title', async () => {
    serve({ status: 'none', briefing: null, generated_at: null, model: null, cost_usd: null })
    renderWithClient(<BriefingPanel />)
    expect(await screen.findByRole('heading', { name: 'No briefing yet — the nightly run writes one' })).toBeInTheDocument()
    expect(screen.getByTestId('briefing-meta')).toHaveTextContent('Advisory')
  })

  it.each([
    ['budget', /spending cap has been reached/],
    ['no_api_key', /no Anthropic API key is configured/],
    ['disabled', /switched off/],
    ['ledger', /spend ledger could not be written/],
  ])('skipped (%s) explains why in plain words', async (reason, re) => {
    serve({ status: 'skipped', reason, error: 'estimated worst case $0.14 would exceed the budget', briefing: null })
    renderWithClient(<BriefingPanel />)
    expect(await screen.findByRole('note')).toHaveTextContent(re)
    expect(screen.getByRole('heading')).toHaveTextContent(re)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('a budget skip shows the daily figure and the backend estimate text', async () => {
    serve({ status: 'skipped', reason: 'budget', error: 'estimated worst case $0.14 would exceed the budget', briefing: null })
    renderWithClient(<BriefingPanel />)
    expect(await screen.findByText(/estimated worst case \$0\.14/)).toBeInTheDocument()
    expect(screen.getByTestId('briefing-meta')).toHaveTextContent('US$0.01 of US$0.50 today')
  })

  it('error status shows its message as a result, not a failed request', async () => {
    serve({ status: 'error', reason: 'api_error', error: 'upstream timeout', briefing: null })
    renderWithClient(<BriefingPanel />)
    expect(await screen.findByRole('heading', { name: 'The last briefing attempt failed' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('upstream timeout')
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('ok with a newer failed attempt keeps the briefing and notes the attempt', async () => {
    serve({ last_attempt: { status: 'skipped', reason: 'budget', error: 'x', at: '2026-10-05T23:00:00Z' } })
    renderWithClient(<BriefingPanel />)
    expect(await screen.findByRole('heading', { name: briefingFixture.briefing.headline })).toBeInTheDocument()
    expect(screen.getByTestId('last-attempt')).toHaveTextContent(/skipped, the spending cap has been reached/)
  })

  it('request failure shows a short message and retries', async () => {
    let n = 0
    server.use(http.get('*/api/briefing', () => (n++ === 0
      ? HttpResponse.json({ error: { code: 'internal', message: 'Something went wrong' } }, { status: 500 })
      : HttpResponse.json(briefingFixture))))
    renderWithClient(<BriefingPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: briefingFixture.briefing.headline })).toBeInTheDocument()
  })
})

describe('regenerate', () => {
  it('is disabled while pending and replaces the briefing', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    server.use(http.post('*/api/briefing/regenerate', async () => {
      await gate
      return HttpResponse.json({ ...briefingFixture, briefing: { ...briefingFixture.briefing, headline: 'Fresh headline' } })
    }))
    renderWithClient(<BriefingPanel />)
    await screen.findByRole('heading', { name: briefingFixture.briefing.headline })
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    expect(await screen.findByRole('button', { name: 'Regenerating…' })).toBeDisabled()
    release()
    expect(await screen.findByRole('heading', { name: 'Fresh headline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled()
  })

  it('handles 429 with a plain message and keeps the old briefing', async () => {
    server.use(http.post('*/api/briefing/regenerate', () =>
      HttpResponse.json({ error: { code: 'busy', message: 'busy' } }, { status: 429 })))
    renderWithClient(<BriefingPanel />)
    await screen.findByRole('heading', { name: briefingFixture.briefing.headline })
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/busy with another heavy job/))
    expect(screen.getByRole('heading', { name: briefingFixture.briefing.headline })).toBeInTheDocument()
  })
})

describe('briefingModel', () => {
  it('formats times, costs and spend', () => {
    const now = Date.parse('2026-10-06T00:00:00Z')
    expect(relativeTime('2026-10-05T23:20:00Z', now)).toBe('40 min ago')
    expect(relativeTime('2026-10-05T23:59:40Z', now)).toBe('just now')
    expect(relativeTime('2026-10-01T00:00:00Z', now)).toBe('5 days ago')
    expect(absoluteTime('2026-10-05T22:40:00Z')).toBe('2026-10-05 22:40 UTC')
    expect(costLabel(0.0123)).toBe('US$0.012')
    expect(monthSpend({ ...briefingFixture.budget, spent_month_usd: 5 }).atCap).toBe(true)
    expect(monthSpend(briefingFixture.budget).atCap).toBe(false)
    expect(skipReason('x')).toContain('(x)')
    expect(briefingTitle(undefined)).toMatch(/Loading/)
  })
})
