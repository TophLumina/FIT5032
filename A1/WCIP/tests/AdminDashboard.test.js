import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AdminDashboard from '../src/views/AdminDashboardView.vue'
import ActivityChart from '../src/components/ActivityChart.vue'
import { isAdmin } from '../src/services/auth'
import { getDashboardData } from '../src/services/dashboard'
import { siteDay } from '../src/utils/siteDate'

vi.mock('../src/services/auth', async () => ({ isAdmin: (await import('vue')).ref(true) }))
vi.mock('../src/services/dashboard', () => ({ getDashboardData: vi.fn() }))
vi.mock('../src/composables/usePlants', async () => {
  const { ref } = await import('vue')
  return {
    usePlants: () => ({
      plants: ref([
        { slug: 'violet', commonName: 'Violet' },
        { slug: 'mint', commonName: 'Mint' },
      ]),
      loading: ref(false),
      error: ref(''),
      loadPlants: vi.fn(),
    }),
  }
})
enableAutoUnmount(afterEach)
const today = siteDay()
const source = {
  totalVisits: 70,
  periodVisits: 4,
  periodComments: 1,
  periodLogins: 3,
  periodRatings: 1,
  averageRating: 5,
  currentComments: 1,
  undatedComments: 0,
  trackingStartedAt: null,
  loginTrackingStartedAt: new Date().toISOString(),
  trend: [{ day: today, visits: 4, comments: 1, logins: 3, loginUsers: 2 }],
  roleCounts: [
    { role: 'Administrator', count: 1 },
    { role: 'Gardener', count: 20 },
  ],
  users: Array.from({ length: 21 }, (_, i) => ({
    uid: 'u' + i,
    email: 'user' + i + '@example.test',
    displayName: 'Gardener ' + i,
    role: i === 0 ? 'Administrator' : 'Gardener',
    seasonalEmailSubscribed: i === 1,
    commentCount: i === 0 ? 1 : 0,
    lastLoginAt: i === 0 ? new Date().toISOString() : null,
  })),
  plantStats: [
    { slug: 'violet', name: 'Violet', comments: 1, ratings: 1, average: 5 },
    { slug: 'mint', name: 'Mint', comments: 0, ratings: 0, average: null },
  ],
  comments: [
    {
      id: 'one',
      path: 'discussions/plant:violet/comments/one',
      type: 'plant',
      slug: 'violet',
      contentKey: 'plant:violet',
      content: 'Violet',
      url: '/plants/violet',
      author: 'Example',
      message: 'Great plant for this garden.',
      rating: 5,
      day: today,
    },
  ],
}
const render = () =>
  mount(AdminDashboard, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })
beforeEach(() => {
  isAdmin.value = true
  getDashboardData.mockResolvedValue(source)
})

describe('administrator dashboard', () => {
  it('filters email subscribers without granting administrators a consent-editing control', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#admin-email-subscription').setValue('Subscribed')
    const table = wrapper.get('[aria-label="Registered users, roles and current comment counts"]')
    expect(table.findAll('tbody tr')).toHaveLength(1)
    expect(table.get('tbody').text()).toContain('user1@example.test')
    expect(table.get('tbody').text()).toContain('Subscribed')
    expect(table.find('tbody input').exists()).toBe(false)
    await wrapper.get('#admin-email-subscription').setValue('Not subscribed')
    expect(wrapper.get('#admin-users-help').exists()).toBe(true)
    expect(
      wrapper.get('[aria-label="Registered users, roles and current comment counts"] tbody').text(),
    ).not.toContain('user1@example.test')
  })
  it('shows real aggregates, ten-row users and role/column filters', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-stat="period-visits"]').text()).toBe('4')
    expect(wrapper.get('[data-stat="rating"]').text()).toBe('5.00 / 5')
    expect(wrapper.get('[data-stat="period-logins"]').text()).toBe('3')
    expect(wrapper.find('#admin-users-lastLoginAt').exists()).toBe(true)
    const table = wrapper.get('[aria-label="Registered users, roles and current comment counts"]')
    expect(table.findAll('tbody tr')).toHaveLength(10)
    await wrapper.get('#admin-users-displayName').setValue('Gardener 20')
    expect(table.get('tbody').text()).toContain('user20@')
    await wrapper.findAll('.role-card')[0].trigger('click')
    expect(
      wrapper.get('[aria-label="Registered users, roles and current comment counts"] tbody').text(),
    ).toContain('user0@')
    expect(wrapper.text()).not.toMatch(/CSV|Export|Download/)
  })
  it('changes chart series, ranking metric and filters details from chart selection', async () => {
    const wrapper = render()
    await flushPromises()
    const chart = wrapper.getComponent(ActivityChart)
    expect(chart.props('series')).toHaveLength(4)
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(false)
    expect(chart.props('series')).toHaveLength(3)
    await wrapper.get('#plant-metric').setValue('average')
    expect(wrapper.get('.plant-bars').attributes('aria-label')).toContain('average rating')
    await wrapper.findAll('.plant-bar')[0].trigger('click')
    expect(wrapper.get('#feedback-heading').text()).toBe('Feedback: Violet')
    chart.vm.$emit('select', today)
    await flushPromises()
    expect(wrapper.get('#feedback-heading').text()).toBe(`Day details: ${today}`)
  })
  it('validates dates before requesting and applies a preset', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#analytics-from').setValue('2026-02-30')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('valid date')
    expect(getDashboardData).toHaveBeenCalledTimes(1)
    await wrapper.findAll('[aria-label="Quick date ranges"] button')[1].trigger('click')
    await flushPromises()
    expect(getDashboardData).toHaveBeenCalledTimes(2)
  })
  it('never loads or shows data to ordinary users', async () => {
    isAdmin.value = false
    const wrapper = render()
    await flushPromises()
    expect(getDashboardData).not.toHaveBeenCalled()
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it('clears data on role loss and ignores a late response', async () => {
    let resolve
    getDashboardData.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = render()
    isAdmin.value = false
    await flushPromises()
    resolve(source)
    await flushPromises()
    expect(wrapper.find('table').exists()).toBe(false)
    expect(getDashboardData.mock.calls[0][2].aborted).toBe(true)
  })
  it('shows failure and retries without stale data', async () => {
    getDashboardData.mockRejectedValue(Object.assign(new Error('network'), { code: 'unavailable' }))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be loaded')
    expect(wrapper.find('table').exists()).toBe(false)
    getDashboardData.mockResolvedValue(source)
    await wrapper.get('header button').trigger('click')
    await flushPromises()
    expect(wrapper.find('table').exists()).toBe(true)
  })
  it('ignores a superseded range request', async () => {
    let resolve
    getDashboardData.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = render()
    await wrapper.findAll('[aria-label="Quick date ranges"] button')[1].trigger('click')
    await flushPromises()
    resolve({ ...source, totalVisits: 999 })
    await flushPromises()
    expect(wrapper.text()).not.toContain('999 recorded all time')
  })
})

it('supports arrow-key navigation and Enter activation in the trend chart', async () => {
  const wrapper = mount(ActivityChart, {
    attachTo: document.body,
    props: {
      rows: [
        { day: '2026-10-14', visits: 1 },
        { day: '2026-10-15', visits: 2 },
      ],
      series: [{ key: 'visits', label: 'Visits', color: '#24563f' }],
    },
  })
  const points = wrapper.findAll('circle')
  await points[0].trigger('keydown', { key: 'ArrowRight' })
  expect(points[1].attributes('tabindex')).toBe('0')
  await points[1].trigger('keydown', { key: 'Enter' })
  expect(wrapper.emitted('select')).toEqual([['2026-10-15']])
})
