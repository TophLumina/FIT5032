import { beforeEach, expect, it, vi } from 'vitest'
import { getDashboardData } from '../src/services/dashboard'
import { syncUserProfile } from '../src/services/users'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/services/firebase', () => ({
  functions: {},
  auth: { currentUser: { uid: 'admin' } },
}))
vi.mock('../src/services/status', () => ({ recordVisit: vi.fn().mockResolvedValue() }))
vi.mock('../src/services/users', () => ({ syncUserProfile: vi.fn().mockResolvedValue() }))
vi.mock('firebase/functions', () => ({ httpsCallable: () => mocks.request }))
beforeEach(() => {
  mocks.request.mockResolvedValue({ data: { periodVisits: 4, periodLogins: 2 } })
  syncUserProfile.mockResolvedValue()
})
it('uses the server report after synchronizing the current account', async () => {
  expect(await getDashboardData('2026-10-04', '2026-10-04')).toEqual({
    periodVisits: 4,
    periodLogins: 2,
  })
  expect(mocks.request).toHaveBeenCalledWith({ from: '2026-10-04', to: '2026-10-04' })
  expect(syncUserProfile).toHaveBeenCalledWith({ uid: 'admin' })
})
it('preserves explicit server failures instead of falling back to browser statistics', async () => {
  mocks.request.mockRejectedValue(new Error('Report detail limit exceeded'))
  await expect(getDashboardData('2026-10-04', '2026-10-04')).rejects.toThrow(
    'Report detail limit exceeded',
  )
})
it('does not start work when revoked or superseded', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(getDashboardData('2026-10-04', '2026-10-04', controller.signal)).rejects.toThrow()
  expect(mocks.request).not.toHaveBeenCalled()
})
it('does not fetch a report when the request becomes stale during profile sync', async () => {
  const controller = new AbortController()
  syncUserProfile.mockImplementationOnce(async () => {
    controller.abort()
  })
  await expect(getDashboardData('2026-10-04', '2026-10-04', controller.signal)).rejects.toThrow()
  expect(mocks.request).not.toHaveBeenCalled()
})
it('discards a report completed after the request is aborted', async () => {
  const controller = new AbortController()
  mocks.request.mockImplementationOnce(async () => {
    controller.abort()
    return { data: {} }
  })
  await expect(getDashboardData('2026-10-04', '2026-10-04', controller.signal)).rejects.toThrow()
})
