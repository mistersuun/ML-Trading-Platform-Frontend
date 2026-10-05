import { describe, it, expect } from 'vitest'
import { pct, num, usd, signColor } from '../format'

describe('format', () => {
  it('pct renders a fraction as a percentage', () => {
    expect(pct(0.153)).toBe('15.3%')
    expect(pct(-0.12)).toBe('-12.0%')
    expect(pct(0.5, 0)).toBe('50%')
    expect(pct(0.12345, 2)).toBe('12.35%')
    expect(pct(0)).toBe('0.0%')
  })
  it('num renders fixed digits', () => {
    expect(num(1.234)).toBe('1.23')
    expect(num(2, 0)).toBe('2')
    expect(num(-0.5, 1)).toBe('-0.5')
  })
  it('usd renders dollars with grouping', () => {
    expect(usd(1234.5)).toBe('$1,234.50')
    expect(usd(-5)).toBe('-$5.00')
    expect(usd(10, 0)).toBe('$10')
  })
  it.each([null, undefined, NaN, Infinity, -Infinity])('renders %s as n/a', (v) => {
    expect(pct(v as number)).toBe('n/a')
    expect(num(v as number)).toBe('n/a')
    expect(usd(v as number)).toBe('n/a')
  })
  it('non-numbers render n/a', () => {
    expect(pct('15%' as unknown as number)).toBe('n/a')
  })
  it('signColor', () => {
    expect(signColor(1)).toContain('green')
    expect(signColor(-1)).toContain('red')
    expect(signColor(null)).toContain('text-primary')
  })
})
