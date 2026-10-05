import { describe, it, expect } from 'vitest'
import { pct, num, usd, signColor, signedPct, signedUsd, signedNum, int } from '../format'

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
    expect(signColor(1)).toContain('--up')
    expect(signColor(-1)).toContain('--down')
    expect(signColor(null)).toContain('--text-1')
  })
  it('signed helpers use a true minus and an explicit plus', () => {
    expect(signedPct(0.0049, 2)).toBe('+0.49%')
    expect(signedPct(-0.014)).toBe('\u22121.4%')
    expect(signedPct(0)).toBe('0.0%')
    expect(signedPct(-0.00001)).toBe('0.0%')
    expect(signedUsd(612.4)).toBe('+$612.40')
    expect(signedUsd(-1234.5)).toBe('\u2212$1,234.50')
    expect(signedNum(-2.9)).toBe('\u22122.9')
    expect(signedNum(3.04)).toBe('+3.0')
    expect(int(12345.6)).toBe('12,346')
  })
  it.each([null, undefined, NaN, Infinity])('signed helpers render %s as n/a', (v) => {
    expect(signedPct(v as number)).toBe('n/a')
    expect(signedUsd(v as number)).toBe('n/a')
    expect(signedNum(v as number)).toBe('n/a')
    expect(int(v as number)).toBe('n/a')
  })
})

import { shortDate, signedUsd as signedUsdZero } from '../format'
import { describe as d2, it as it2, expect as ex2 } from 'vitest'
d2('zero and short dates', () => {
  it2('signedUsd(0) is unsigned', () => {
    ex2(signedUsdZero(0)).toBe('$0.00')
    ex2(signedUsdZero(0.001)).toBe('$0.00')
    ex2(signedUsdZero(5, 0)).toBe('+$5')
  })
  it2('shortDate', () => {
    ex2(shortDate('2026-06-07')).toBe('7 Jun')
    ex2(shortDate('2025-07-01', true)).toBe('Jul 25')
    ex2(shortDate('junk')).toBe('junk')
  })
})
