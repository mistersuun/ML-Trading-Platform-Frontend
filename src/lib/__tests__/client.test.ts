import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { ApiError, listPatterns } from '../../api/client'

const fail = async (p: Promise<unknown>) => {
  try { await p } catch (e) { return e as ApiError }
  throw new Error('expected rejection')
}

describe('api client interceptor', () => {
  it('throws ApiError from structured 4xx body', async () => {
    server.use(http.get('*/api/patterns/list', () =>
      HttpResponse.json({ error: { code: 'not_found', message: 'nope', details: { x: 1 } } }, { status: 404 })))
    const e = await fail(listPatterns())
    expect(e).toBeInstanceOf(ApiError)
    expect([e.status, e.code, e.message]).toEqual([404, 'not_found', 'nope'])
  })
  it('throws ApiError from 500 with detail', async () => {
    server.use(http.get('*/api/patterns/list', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    const e = await fail(listPatterns())
    expect([e.status, e.message]).toEqual([500, 'boom'])
  })
  it('throws on legacy 200 {error: string}', async () => {
    server.use(http.get('*/api/patterns/list', () => HttpResponse.json({ error: 'No data' })))
    const e = await fail(listPatterns())
    expect([e.status, e.message]).toEqual([200, 'No data'])
  })
  it('throws on legacy 200 {error: {...}}', async () => {
    server.use(http.get('*/api/patterns/list', () => HttpResponse.json({ error: { code: 'c', message: 'm' } })))
    const e = await fail(listPatterns())
    expect([e.code, e.message]).toEqual(['c', 'm'])
  })
  it('passes through normal responses', async () => {
    const res = await listPatterns()
    expect(res.patterns.length).toBeGreaterThan(0)
  })
})
