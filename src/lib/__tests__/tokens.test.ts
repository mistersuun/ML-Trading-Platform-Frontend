import { describe, it, expect } from 'vitest'
import { SERIES } from '../tokens'

describe('categorical series colours', () => {
  it('has six distinct colours, one per group row (the sixth group must not reuse the first)', () => {
    expect(SERIES).toHaveLength(6)
    expect(new Set(SERIES.map((c) => c.toLowerCase())).size).toBe(6)
  })
})
