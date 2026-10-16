import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import SeasonalEmail from '../src/views/SeasonalEmailView.vue'
import { isAdmin, user } from '../src/services/auth'
import {
  previewSeasonalEmail,
  sendSeasonalEmail,
  downloadGuide,
} from '../src/services/seasonalEmail'

vi.mock('../src/services/auth', async () => {
  const { ref } = await import('vue')
  return { isAdmin: ref(true), user: ref({ uid: 'admin' }) }
})
vi.mock('../src/services/seasonalEmail', () => ({
  previewSeasonalEmail: vi.fn(),
  sendSeasonalEmail: vi.fn(),
  downloadGuide: vi.fn(),
}))
enableAutoUnmount(afterEach)
const source = {
  guide: {
    issueId: '2026-10',
    subject: 'WCIP planting guide',
    season: 'Spring',
    edition: 'October 2026',
    introduction: 'Plant for your conditions.',
    tasks: ['Check soil.'],
  },
  sender: { name: 'WCIP', email: 'sender@example.test', replyTo: 'sender@example.test' },
  text: 'Hello subscribers. Manage your subscription in My account.',
  digest: 'digest',
  maximumBatch: 10,
  dailyLimit: 100,
  attachment: { filename: 'guide.pdf', base64: 'JVBERi0=', type: 'application/pdf' },
  recipients: Array.from({ length: 13 }, (_, i) => ({
    uid: `u${i}`,
    email: `user${String(i).padStart(2, '0')}@example.test`,
    displayName: `User ${i}`,
    status: i === 12 ? 'accepted' : 'ready',
    attempts: i === 12 ? 1 : 0,
    selectable: i !== 12,
    message: i === 12 ? 'Already accepted this month' : 'Not sent this month',
  })),
}
const render = () =>
  mount(SeasonalEmail, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })
beforeEach(() => {
  vi.clearAllMocks()
  isAdmin.value = true
  user.value = { uid: 'admin' }
  previewSeasonalEmail.mockResolvedValue(structuredClone(source))
  sendSeasonalEmail.mockResolvedValue({
    issueId: '2026-10',
    results: [{ uid: 'u0', status: 'accepted', message: 'Accepted; not confirmed delivered.' }],
  })
})

describe('seasonal mail administrator flow', () => {
  it('requires selection and review, then submits only UIDs and the server preview digest', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    expect(sendSeasonalEmail).not.toHaveBeenCalled()
    await wrapper.get('input[aria-label="Send to user00@example.test"]').setValue(true)
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    await wrapper.get('#mail-reviewed').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(sendSeasonalEmail).toHaveBeenCalledWith({
      issueId: '2026-10',
      digest: 'digest',
      recipientUids: ['u0'],
      requestId: expect.any(String),
    })
    expect(wrapper.text()).toContain('not confirmed delivered')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Reload the preview')
  })
  it('paginates ten subscribers, limits selection and keeps accepted accounts locked', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    for (const checkbox of wrapper.findAll('tbody input[type="checkbox"]'))
      await checkbox.setValue(true)
    await wrapper.get('#mail-subscribers-page').setValue('2')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.findAll('tbody input').every((input) => input.element.disabled)).toBe(true)
    await wrapper.get('#mail-subscribers-email').setValue('user12')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody input').element.disabled).toBe(true)
    expect(wrapper.get('tbody').text()).toContain('Accepted by SendGrid')
  })
  it('downloads the exact preview attachment without sending mail', async () => {
    const wrapper = render()
    await flushPromises()
    const button = wrapper
      .findAll('button')
      .find((entry) => entry.text() === 'Download PDF to review')
    await button.trigger('click')
    expect(downloadGuide).toHaveBeenCalledWith(source.attachment)
    expect(sendSeasonalEmail).not.toHaveBeenCalled()
  })
  it('requires reloading after an uncertain response instead of silently resending', async () => {
    sendSeasonalEmail.mockRejectedValueOnce(new Error('network disconnected'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('input[aria-label="Send to user00@example.test"]').setValue(true)
    await wrapper.get('#mail-reviewed').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('check recorded results')
    await wrapper.get('form').trigger('submit')
    expect(sendSeasonalEmail).toHaveBeenCalledTimes(1)
  })
  it('clears subscriber details on an account change and ignores stale responses', async () => {
    let finish
    previewSeasonalEmail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = render()
    isAdmin.value = false
    user.value = null
    await flushPromises()
    finish(source)
    await flushPromises()
    expect(wrapper.text()).not.toContain('user00@example.test')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
