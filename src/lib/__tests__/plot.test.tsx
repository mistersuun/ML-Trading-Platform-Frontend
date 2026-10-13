import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Plot wrapper', () => {
  beforeEach(() => { vi.resetModules() })

  it('unwraps a CommonJS module object ({ default }) into the component', async () => {
    const Comp = () => null
    vi.doMock('react-plotly.js', () => ({ default: { default: Comp, __esModule: false } }))
    const mod = await import('../Plot')
    expect(typeof mod.default).toBe('function')
    expect(mod.default).toBe(Comp)
  })

  it('passes a plain component through', async () => {
    const Comp = () => null
    vi.doMock('react-plotly.js', () => ({ default: Comp }))
    const mod = await import('../Plot')
    expect(mod.default).toBe(Comp)
  })
})
