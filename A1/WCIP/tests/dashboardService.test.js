import { beforeEach, expect, it, vi } from 'vitest'
import { getDashboardData } from '../src/services/dashboard'
import { getCountFromServer, getDocsFromServer, getDocFromServer } from 'firebase/firestore'

vi.mock('../src/services/firebase', () => ({ db: {} }))
vi.mock('../src/services/status', () => ({ recordVisit: vi.fn().mockResolvedValue() }))
vi.mock('firebase/firestore', () => ({
  collection: (_, path) => ({ path }),
  collectionGroup: (_, path) => ({ path }),
  doc: (_, ...parts) => ({ path: parts.join('/') }),
  limit: (value) => ({ limit: value }),
  where: (field, op, value) => ({ field, op, value }),
  query: (ref, ...constraints) => ({ ...ref, constraints }),
  getCountFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  getDocFromServer: vi.fn(),
}))
beforeEach(() => {
  getCountFromServer.mockResolvedValue({ data: () => ({ count: 2 }) })
  getDocsFromServer.mockResolvedValue({ size: 0, docs: [] })
  getDocFromServer.mockResolvedValue({ data: () => undefined })
})
it('queries both Melbourne midnights and returns server aggregates for each day', async () => {
  const data = await getDashboardData('2026-10-04', '2026-10-04')
  expect(data.visits).toEqual([{ day: '2026-10-04', count: 2 }])
  const constraints = getCountFromServer.mock.calls[1][0].constraints
  expect(constraints[0].op).toBe('>=')
  expect(constraints[1].op).toBe('<')
  expect(constraints[0].value.toISOString()).toBe('2026-10-03T14:00:00.000Z')
  expect(constraints[1].value.toISOString()).toBe('2026-10-04T13:00:00.000Z')
})
it('fails clearly instead of reporting a truncated profile directory', async () => {
  getDocsFromServer.mockImplementation((ref) =>
    Promise.resolve({ size: ref.path === 'users' ? 2001 : 0, docs: [] }),
  )
  await expect(getDashboardData('2026-10-04', '2026-10-04')).rejects.toThrow(
    'partial totals are not shown',
  )
})
it('does not start work when revoked or superseded', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(getDashboardData('2026-10-04', '2026-10-04', controller.signal)).rejects.toThrow()
  expect(getDocsFromServer).not.toHaveBeenCalled()
})
it('stops scheduling daily reads after an in-flight request is aborted', async () => {
  const controller = new AbortController()
  getDocFromServer.mockImplementation(async () => {
    controller.abort()
    return { data: () => undefined }
  })
  await expect(getDashboardData('2026-10-01', '2026-10-14', controller.signal)).rejects.toThrow()
  expect(getCountFromServer).toHaveBeenCalledTimes(1)
})
