import { describe, it, expect } from 'vitest'
import { shouldRetry } from '../query'
import { ApiError } from '../client'

describe('shouldRetry', () => {
  it('does not retry the deterministic state_not_initialized 503', () => {
    expect(shouldRetry(0, new ApiError(503, 'state_not_initialized', 'x'))).toBe(false)
  })
  it('still retries other 5xx and network errors, but not 4xx', () => {
    expect(shouldRetry(0, new ApiError(500, 'internal', 'x'))).toBe(true)
    expect(shouldRetry(0, new ApiError(0, 'network_error', 'x'))).toBe(true)
    expect(shouldRetry(0, new ApiError(404, 'not_found', 'x'))).toBe(false)
  })
})
