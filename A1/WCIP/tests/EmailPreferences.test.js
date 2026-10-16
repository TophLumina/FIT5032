import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import EmailPreferences from '../src/components/EmailPreferences.vue'
import { user } from '../src/services/auth'
import { getEmailPreferences, saveEmailPreferences } from '../src/services/emailPreferences'

vi.mock('../src/services/auth', async () => ({ user: (await import('vue')).ref(null) }))
vi.mock('../src/services/emailPreferences', () => ({
  getEmailPreferences: vi.fn(),
  saveEmailPreferences: vi.fn(),
}))
enableAutoUnmount(afterEach)
beforeEach(() => {
  user.value = { uid: 'member' }
  getEmailPreferences.mockResolvedValue({ subscribed: false, email: 'member@example.test' })
  saveEmailPreferences.mockImplementation(async (_, subscribed) => ({
    subscribed,
    email: 'member@example.test',
  }))
})

describe('seasonal email preferences', () => {
  it('starts opted out and requires an explicit save for subscribing and unsubscribing', async () => {
    const wrapper = mount(EmailPreferences)
    expect(wrapper.text()).toContain('Loading email preferences')
    await flushPromises()
    const checkbox = wrapper.get('input[type="checkbox"]')
    expect(checkbox.element.checked).toBe(false)
    expect(saveEmailPreferences).not.toHaveBeenCalled()
    await checkbox.setValue(true)
    expect(saveEmailPreferences).not.toHaveBeenCalled()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(saveEmailPreferences).toHaveBeenCalledWith('member', true)
    expect(wrapper.text()).toContain('Saved preference: Subscribed')
    await checkbox.setValue(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(saveEmailPreferences).toHaveBeenLastCalledWith('member', false)
    expect(wrapper.text()).toContain('Saved preference: Not subscribed')
  })

  it('does not claim a failed update was saved, and allows retry', async () => {
    saveEmailPreferences.mockRejectedValueOnce(new Error('network unavailable'))
    const wrapper = mount(EmailPreferences)
    await flushPromises()
    await wrapper.get('input').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be confirmed')
    expect(wrapper.text()).toContain('Saved preference: Not subscribed')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Saved preference: Subscribed')
  })

  it('cannot change preferences when loading fails', async () => {
    getEmailPreferences.mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = mount(EmailPreferences)
    await flushPromises()
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be loaded')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('input').exists()).toBe(true)
    expect(saveEmailPreferences).not.toHaveBeenCalled()
  })

  it('discards a previous account response after the session changes', async () => {
    let finish
    getEmailPreferences.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = mount(EmailPreferences)
    user.value = { uid: 'next-account' }
    getEmailPreferences.mockResolvedValue({ subscribed: false, email: 'next@example.test' })
    await flushPromises()
    finish({ subscribed: true, email: 'previous@example.test' })
    await flushPromises()
    expect(wrapper.text()).toContain('next@example.test')
    expect(wrapper.text()).not.toContain('previous@example.test')
    expect(wrapper.get('input').element.checked).toBe(false)
  })
})
