import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { delay, http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { nightly } from '../../test/handlers'
import { renderWithClient } from '../../test/utils'
import { createQueryClient } from '../query'
import { createApi, getApi, getConfig, setApi } from '../client'
import App from '../../App'
import Dashboard from '../../pages/Dashboard'
import TechnicalScanner from '../../pages/TechnicalScanner'
import { usePatterns } from '../hooks'

const counter = () => {
  const n = { v: 0 }
  return n
}

function PatternsProbe() {
  const { data, error } = usePatterns()
  return <div>{error ? `error:${error.message}` : data ? `patterns:${data.patterns.join(',')}` : 'loading'}</div>
}

describe('query cache', () => {
  it('navigating away and back reuses the cache (one request)', async () => {
    const n = counter()
    server.use(http.get('*/api/patterns/list', () => {
      n.v++
      return HttpResponse.json({ patterns: ['golden_cross'], count: 1 })
    }))
    renderWithClient(<App />) // App brings its own BrowserRouter; navigate through the sidebar
    await userEvent.click(screen.getByRole('link', { name: /^scanner$/i }))
    await screen.findByRole('option', { name: 'golden_cross' })
    await userEvent.click(screen.getByRole('link', { name: /settings/i }))
    await screen.findByText('initial capital')
    await userEvent.click(screen.getByRole('link', { name: /^scanner$/i }))
    await screen.findByRole('option', { name: 'golden_cross' })
    expect(n.v).toBe(1)
  })
})

describe('in-flight requests', () => {
  it('double-clicking Analyze sends the candidate request once', async () => {
    const n = { candidate: 0 }
    server.use(
      http.get('*/api/scanner/candidate', async () => {
        n.candidate++; await delay(50)
        return HttpResponse.json({ error: { code: 'no_data', message: 'No price data returned for QQQ' } }, { status: 404 })
      }),
    )
    renderWithClient(<TechnicalScanner />)
    await screen.findByRole('option', { name: 'golden_cross' })
    await userEvent.dblClick(screen.getByRole('button', { name: 'Analyze' }))
    await screen.findByText(/No price data returned/)
    expect(n).toEqual({ candidate: 1 })
  })

  it('double-clicking Run scan now sends one request', async () => {
    const n = counter()
    server.use(http.post('*/api/patterns/scan', async () => {
      n.v++; await delay(50)
      return HttpResponse.json({ count: 0, signals: [], failed: [] })
    }))
    renderWithClient(<Dashboard />)
    await userEvent.dblClick(screen.getByRole('button', { name: /run scan now/i }))
    await screen.findByText(/No signals detected/)
    expect(n.v).toBe(1)
  })

  it('unmounting aborts the in-flight request', async () => {
    const state = { started: false, aborted: false }
    server.use(http.get('*/api/patterns/list', async ({ request }) => {
      state.started = true
      await new Promise<void>((resolve) => {
        request.signal.addEventListener('abort', () => { state.aborted = true; resolve() })
        setTimeout(resolve, 3000)
      })
      return HttpResponse.json({ patterns: [], count: 0 })
    }))
    const { unmount } = renderWithClient(<PatternsProbe />)
    await waitFor(() => expect(state.started).toBe(true))
    unmount()
    await waitFor(() => expect(state.aborted).toBe(true))
  })
})

describe('retry policy', () => {
  const productionClient = () => createQueryClient({ retryDelay: 0 })

  it('GET 503 once then success shows data', async () => {
    const n = counter()
    server.use(http.get('*/api/patterns/list', () => {
      n.v++
      return n.v === 1
        ? HttpResponse.json({ error: { code: 'upstream', message: 'feed down' } }, { status: 503 })
        : HttpResponse.json({ patterns: ['golden_cross'], count: 1 })
    }))
    render(<QueryClientProvider client={productionClient()}><PatternsProbe /></QueryClientProvider>)
    expect(await screen.findByText('patterns:golden_cross')).toBeInTheDocument()
    expect(n.v).toBe(2)
  })

  it('does not retry 4xx', async () => {
    const n = counter()
    server.use(http.get('*/api/patterns/list', () => {
      n.v++
      return HttpResponse.json({ error: { code: 'not_found', message: 'nope' } }, { status: 404 })
    }))
    render(<QueryClientProvider client={productionClient()}><PatternsProbe /></QueryClientProvider>)
    expect(await screen.findByText('error:nope')).toBeInTheDocument()
    expect(n.v).toBe(1)
  })

  it('gives up after 2 retries on persistent 5xx', async () => {
    const n = counter()
    server.use(http.get('*/api/patterns/list', () => {
      n.v++
      return HttpResponse.json({ detail: 'boom' }, { status: 500 })
    }))
    render(<QueryClientProvider client={productionClient()}><PatternsProbe /></QueryClientProvider>)
    expect(await screen.findByText('error:boom')).toBeInTheDocument()
    expect(n.v).toBe(3)
  })

  it('mutations are never retried', async () => {
    const n = counter()
    server.use(http.post('*/api/patterns/scan', () => {
      n.v++
      return HttpResponse.json({ detail: 'boom' }, { status: 500 })
    }))
    renderWithClient(<Dashboard />, productionClient())
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    expect(n.v).toBe(1)
  })
})

describe('busy (429)', () => {
  it('shows a friendly message when a scan is already running', async () => {
    server.use(http.post('*/api/patterns/scan', () =>
      HttpResponse.json({ error: { code: 'busy', message: 'Another heavy job is running' } }, { status: 429 })))
    renderWithClient(<Dashboard />)
    await userEvent.click(screen.getByRole('button', { name: /run scan now/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/busy with another heavy job/i)
    // the button is usable again
    expect(screen.getByRole('button', { name: /run scan now/i })).toBeEnabled()
  })
})

describe('Dashboard nightly results', () => {
  it('shows the latest nightly scan with generated_at', async () => {
    server.use(http.get('*/api/results/technical/latest', () => HttpResponse.json(nightly)))
    renderWithClient(<Dashboard />)
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText(/Latest scan:/)).toBeInTheDocument()
    expect(screen.queryByText('STALE')).not.toBeInTheDocument()
  })

  it('shows a stale badge when the result is old', async () => {
    server.use(http.get('*/api/results/technical/latest', () =>
      HttpResponse.json({ ...nightly, age_hours: 52, stale: true })))
    renderWithClient(<Dashboard />)
    expect(await screen.findByText('STALE')).toBeInTheDocument()
  })

  it('shows an empty state (not an error) when no nightly run exists', async () => {
    renderWithClient(<Dashboard />)
    expect(await screen.findByText(/No nightly scan results yet/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('base URL', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('createApi honours an explicit base URL', async () => {
    const n = counter()
    server.use(http.get('http://api.example.test/v1/api/patterns/list', () => {
      n.v++
      return HttpResponse.json({ patterns: ['x'], count: 1 })
    }))
    const api = createApi('http://api.example.test/v1/api')
    const { data } = await api.GET('/api/patterns/list')
    expect(data?.patterns).toEqual(['x'])
    expect(n.v).toBe(1)
  })

  it('the default client reads VITE_API_BASE_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://other.example.test/api')
    vi.resetModules()
    server.use(http.get('http://other.example.test/api/patterns/list', () =>
      HttpResponse.json({ patterns: ['from-env'], count: 1 })))
    const mod = await import('../client')
    const res = await mod.listPatterns()
    expect(res.patterns).toEqual(['from-env'])
  })

  it('defaults to /api on the current origin', async () => {
    const res = await createApi().GET('/api/patterns/list')
    expect(res.data?.count).toBe(2)
  })
})

describe('error middleware', () => {
  it('turns a network failure into ApiError(0, network_error)', async () => {
    server.use(http.get('*/api/patterns/list', () => HttpResponse.error()))
    const mod = await import('../client')
    await expect(mod.listPatterns()).rejects.toMatchObject({ status: 0, code: 'network_error' })
    await expect(mod.listPatterns()).rejects.toBeInstanceOf(mod.ApiError)
  })
})

describe('API token', () => {
  it('sends Authorization: Bearer when a token is configured', async () => {
    let seen: string | null = null
    server.use(http.get('*/api/config/', ({ request }) => {
      seen = request.headers.get('authorization')
      return HttpResponse.json({})
    }))
    const prev = getApi()
    setApi(createApi('/api', 'tk-123'))
    try { await getConfig() } finally { setApi(prev) }
    expect(seen).toBe('Bearer tk-123')
  })

  it('sends no Authorization header without a token', async () => {
    let seen: string | null = 'unset'
    server.use(http.get('*/api/config/', ({ request }) => {
      seen = request.headers.get('authorization')
      return HttpResponse.json({})
    }))
    const prev = getApi()
    setApi(createApi('/api', undefined))
    try { await getConfig() } finally { setApi(prev) }
    expect(seen).toBeNull()
  })
})
