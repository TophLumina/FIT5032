import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import GardenAssistantView from '../src/views/GardenAssistantView.vue'
import { user } from '../src/services/auth'
import { assistantStatus, askAssistant } from '../src/services/assistant'
import { conversationInput } from '../shared/assistant.js'

vi.mock('../src/services/auth', async () => {
  const { ref } = await import('vue')
  return { user: ref(null), authReady: ref(true) }
})
vi.mock('../src/services/assistant', () => ({ assistantStatus: vi.fn(), askAssistant: vi.fn() }))
vi.mock('../src/composables/usePlants', async () => {
  const { ref } = await import('vue')
  const { default: plants } = await import('../public/data/plants.json')
  return { usePlants: () => ({ plants: ref(plants) }) }
})
enableAutoUnmount(afterEach)
beforeEach(() => {
  user.value = { uid: 'gardener' }
  assistantStatus.mockResolvedValue(true)
  askAssistant.mockResolvedValue({
    answer: 'Native Violet prefers shade.',
    plants: [{ slug: 'native-violet', name: 'Native Violet' }],
    quota: { remaining: 19, resetsAt: '2026-10-17T00:00:00Z' },
  })
})
async function setup(path = '/assistant') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/assistant', name: 'garden-assistant', component: GardenAssistantView },
      ...[
        ['/', 'home'],
        ['/login', 'login'],
        ['/plants', 'plants'],
        ['/plants/:slug', 'plant-detail'],
        ['/map', 'plant-map'],
      ].map(([path, name]) => ({ path, name, component: { template: '<div />' } })),
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(GardenAssistantView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}
describe('AI gardening conversation', () => {
  it('invites ordinary users to sign in and prevents guest sends', async () => {
    user.value = null
    const wrapper = await setup()
    expect(wrapper.text()).toContain('Sign in to chat')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(askAssistant).not.toHaveBeenCalled()
  })
  it('supports follow-up questions, selected plant context and relevant links', async () => {
    const wrapper = await setup('/assistant?plant=native-violet')
    await wrapper.get('textarea').setValue('Would this suit my balcony?')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(askAssistant.mock.calls[0][1]).toBe('native-violet')
    expect(wrapper.text()).toContain('Native Violet prefers shade.')
    expect(wrapper.find('a[href="/map?plant=native-violet"]').exists()).toBe(true)
    await wrapper.get('textarea').setValue('How much water?')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(askAssistant.mock.calls[1][0].map((item) => item.role)).toEqual([
      'user',
      'assistant',
      'user',
    ])
  })
  it('renders generated HTML as text and retains a failed question', async () => {
    askAssistant
      .mockResolvedValueOnce({ answer: '<img src=x onerror=alert(1)>', plants: [] })
      .mockRejectedValueOnce(new Error('Usage limit reached'))
    const wrapper = await setup()
    await wrapper.get('textarea').setValue('Test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    await wrapper.get('textarea').setValue('A follow-up')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Usage limit reached')
    expect(wrapper.get('textarea').element.value).toBe('A follow-up')
  })
  it('clears history and ignores an in-flight answer after sign-out', async () => {
    let finish
    askAssistant.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = await setup()
    await wrapper.get('textarea').setValue('Private question')
    await wrapper.get('form').trigger('submit')
    user.value = null
    finish({ answer: 'Old answer', plants: [] })
    await flushPromises()
    expect(askAssistant.mock.calls[0][2].aborted).toBe(true)
    expect(wrapper.text()).not.toContain('Old answer')
    expect(wrapper.text()).not.toContain('Private question')
  })
  it('shows unavailable state without pretending to answer', async () => {
    assistantStatus.mockResolvedValue(false)
    const wrapper = await setup()
    expect(wrapper.text()).toContain('not available yet')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
  it('bounds context by removing complete oldest turns', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: 'x'.repeat(i % 2 ? 5000 : 1000),
    }))
    const result = conversationInput(messages, 'follow-up')
    expect(result[0].role).toBe('user')
    expect(result.at(-1).content).toBe('follow-up')
    expect(result.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(12000)
  })
})
