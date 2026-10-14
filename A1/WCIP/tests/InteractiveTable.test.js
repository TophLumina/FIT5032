import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import InteractiveTable from '../src/components/InteractiveTable.vue'

enableAutoUnmount(afterEach)
const rows = Array.from({ length: 24 }, (_, i) => ({
  uid: `u${i}`,
  email: `gardener${i}@example.test`,
  displayName: i % 2 ? 'Alex' : 'Sam',
  commentCount: i,
}))
const columns = [
  { key: 'email', label: 'Email' },
  { key: 'displayName', label: 'Display name' },
  { key: 'commentCount', label: 'Comments' },
]
const setup = () =>
  mount(InteractiveTable, {
    props: {
      id: 'users',
      caption: 'User statistics',
      rows,
      columns,
      rowKey: 'uid',
      initialSort: 'commentCount',
      initialDirection: 'desc',
    },
  })

describe('interactive tables', () => {
  it('shows 10, 10 and 4 rows with bounded keyboard-operable page controls', async () => {
    const wrapper = setup()
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    const next = wrapper.findAll('button').find((button) => button.text() === 'Next')
    await next.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    await next.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
    expect(next.attributes('disabled')).toBeDefined()
    await wrapper.get('#users-page').setValue('1')
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
  })

  it('combines global and individual-column search, resets pagination and supports numeric sorting', async () => {
    const wrapper = setup()
    await wrapper.get('#users-page').setValue('3')
    await wrapper.get('#users-search').setValue('gardener1')
    await wrapper.get('#users-displayName').setValue('alex')
    expect(wrapper.findAll('tbody tr')).toHaveLength(6)
    expect(wrapper.get('#users-page').element.value).toBe('1')
    await wrapper.get('#users-commentCount').setValue('19')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('gardener19@')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Clear table filters')
      .trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    await wrapper.get('button[aria-label="Sort by Comments, ascending"]').trigger('click')
    expect(wrapper.get('tbody tr').text()).toContain('gardener0@')
    expect(wrapper.get('th[aria-sort="ascending"]').text()).toContain('Comments')
  })

  it('announces empty results and emits all filtered rows for export instead of one page', async () => {
    const wrapper = setup()
    expect(wrapper.emitted('change')[0][0]).toHaveLength(24)
    await wrapper.get('#users-email').setValue('missing')
    expect(wrapper.get('tbody').text()).toContain('No rows match')
    expect(wrapper.get('[role="status"]').text()).toContain('0–0')
    expect(wrapper.get('div[role="region"]').attributes('tabindex')).toBe('0')
    for (const input of wrapper.findAll('input'))
      expect(wrapper.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
  })
})
