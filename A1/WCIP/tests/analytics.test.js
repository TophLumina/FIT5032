import { describe, expect, it } from 'vitest'
import { analyticsRange, buildAnalytics, shiftDay } from '../src/utils/analytics'
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

describe('Firestore reporting semantics', () => {
  it('joins roles to profiles, excludes unrated feedback and groups by Melbourne creation date', () => {
    const source = {
      totalVisits: 99,
      visits: [{ day: '2026-10-15', count: 7 }],
      profiles: [{ uid: 'a', email: 'a@example.test' }, { uid: 'b' }],
      roles: [
        { uid: 'a', role: 'admin' },
        { uid: 'orphan', role: 'admin' },
      ],
      comments: [
        {
          path: 'discussions/plant:violet/comments/1',
          authorUid: 'a',
          rating: 5,
          createdAt: new Date('2026-10-14T13:10:00Z'),
        },
        {
          path: 'discussions/plant:violet/comments/2',
          authorUid: 'b',
          rating: null,
          createdAt: new Date('2026-10-15T00:00:00Z'),
        },
        {
          path: 'discussions/plant:violet/comments/3',
          authorUid: 'a',
          rating: 1,
          createdAt: new Date('2026-10-14T12:59:59Z'),
        },
        {
          path: 'discussions/guide:soil/comments/4',
          authorUid: 'b',
          rating: 5,
          createdAt: new Date('2026-10-15T00:00:00Z'),
        },
        { path: 'discussions/plant:violet/comments/5', rating: 0 },
        { path: 'unrelated/x/comments/6', rating: 5, createdAt: new Date('2026-10-15T00:00:00Z') },
      ],
    }
    const result = buildAnalytics(
      source,
      [
        { slug: 'violet', commonName: 'Violet' },
        { slug: 'mint', commonName: 'Mint' },
      ],
      analyticsRange('2026-10-15', '2026-10-15', '2026-10-15'),
    )
    expect(result.roleCounts).toEqual([
      { role: 'Administrator', count: 1 },
      { role: 'Gardener', count: 1 },
    ])
    expect(result.users[0].commentCount).toBe(2)
    expect(result.currentComments).toBe(5)
    expect(result.comments).toHaveLength(3)
    expect(result.periodRatings).toBe(1)
    expect(result.averageRating).toBe(5)
    expect(result.undatedComments).toBe(1)
    expect(result.plantStats[0]).toMatchObject({ comments: 2, ratings: 1, average: 5 })
    expect(result.plantStats[1]).toMatchObject({ comments: 0, ratings: 0, average: null })
    expect(result.trend).toEqual([{ day: '2026-10-15', visits: 7, comments: 3 }])
  })
  it('returns honest empty states', () => {
    const result = buildAnalytics(
      { profiles: [], roles: [], comments: [], visits: [], totalVisits: 0 },
      [],
      analyticsRange('2026-10-15', '2026-10-15', '2026-10-15'),
    )
    expect(result.averageRating).toBeNull()
    expect(result.periodVisits).toBe(0)
    expect(result.comments).toEqual([])
  })
})
