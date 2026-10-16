import { describe, expect, it } from 'vitest'
import { analyticsRange, shiftDay } from '../src/utils/analytics'
import { siteDayRange } from '../src/utils/siteDate'

describe('Melbourne analytics dates', () => {
  it('includes both end dates and handles leap days', () => {
    expect(analyticsRange('2024-02-28', '2024-03-01', '2026-10-15').days).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ])
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('resolves daylight saving boundaries to 23 and 25 hours', () => {
    for (const [day, hours] of [
      ['2026-10-04', 23],
      ['2026-04-05', 25],
    ]) {
      const { start, end } = siteDayRange(day)
      expect((end - start) / 3600000).toBe(hours)
    }
  })
  it('rejects invalid, future, reversed and excessive ranges', () => {
    for (const [from, to] of [
      ['2026-02-30', '2026-03-01'],
      ['2026-10-15', '2026-10-16'],
      ['2026-10-15', '2026-10-14'],
      ['2026-01-01', '2026-10-15'],
      ['', '2026-10-15'],
    ])
      expect(() => analyticsRange(from, to, '2026-10-15')).toThrow()
  })
})
