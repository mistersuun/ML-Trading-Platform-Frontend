import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { createQueryClient } from '../api/query'

/** Test client: no retries (production policy has its own tests), no delay. */
export function testClient(): QueryClient {
  const c = createQueryClient({ retryDelay: 0 })
  c.setDefaultOptions({ ...c.getDefaultOptions(), queries: { ...c.getDefaultOptions().queries, retry: false } })
  return c
}

export function renderWithClient(ui: ReactElement, client: QueryClient = testClient()) {
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}
