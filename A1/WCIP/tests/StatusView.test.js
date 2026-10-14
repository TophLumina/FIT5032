import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import StatusView from '../src/views/StatusView.vue'
import { isAdmin } from '../src/services/auth'
import { getSiteStatus } from '../src/services/status'

vi.mock('../src/services/auth', async () => {
  const { ref } = await import('vue')
  return { isAdmin: ref(true) }
})
vi.mock('../src/services/status', () => ({ getSiteStatus: vi.fn() }))
enableAutoUnmount(afterEach)
const status = {
  dailyVisits: 4,
  totalVisits: 70,
  commentCount: 21,
  trackingStartedAt: null,
  users: Array.from({ length: 21 }, (_, i) => ({
    uid: `u${i}`,
    email: `user${i}@example.test`,
    displayName: `Gardener ${i}`,
    commentCount: i,
  })),
}
beforeEach(() => {
  isAdmin.value = true
  getSiteStatus.mockResolvedValue(status)
})

describe('administrator user table', () => {
  it('retains visit statistics, paginates users and supports column searches without exports', async () => {
    const wrapper = mount(StatusView)
    await flushPromises()
    expect(wrapper.get('[data-stat="daily-visits"]').text()).toBe('4')
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    await wrapper.get('#admin-users-displayName').setValue('Gardener 20')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('user20@')
    expect(wrapper.text()).not.toMatch(/CSV|Export|Download/i)
  })

  it('does not request or show administrator data for ordinary users', async () => {
    isAdmin.value = false
    const wrapper = mount(StatusView)
    await flushPromises()
    expect(getSiteStatus).not.toHaveBeenCalled()
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('discards in-flight data when the administrator role is lost', async () => {
    let resolve
    getSiteStatus.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = mount(StatusView)
    isAdmin.value = false
    await flushPromises()
    resolve(status)
    await flushPromises()
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('user0@')
  })

  it('shows a retryable failure without a stale user list', async () => {
    getSiteStatus.mockRejectedValue(new Error('unavailable'))
    const wrapper = mount(StatusView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be loaded')
    expect(wrapper.find('table').exists()).toBe(false)
    getSiteStatus.mockResolvedValue(status)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('table').exists()).toBe(true)
  })
})
