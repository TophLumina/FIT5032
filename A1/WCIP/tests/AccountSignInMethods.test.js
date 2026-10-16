import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AccountSignInMethods from '../src/components/AccountSignInMethods.vue'
import { user, connectGoogle } from '../src/services/auth'

vi.mock('../src/services/auth', async () => {
  const { ref } = await import('vue')
  return {
    authReady: ref(true),
    user: ref(null),
    connectGoogle: vi.fn(),
    authErrorMessage: (reason) => reason.message,
  }
})
enableAutoUnmount(afterEach)
beforeEach(() => {
  user.value = {
    uid: 'member',
    email: 'member@example.test',
    providerData: [{ providerId: 'password' }],
  }
})
describe('account sign-in methods', () => {
  it('connects only after a click and then shows the linked Google identity', async () => {
    connectGoogle.mockImplementationOnce(async () => {
      user.value = {
        ...user.value,
        providerData: [
          ...user.value.providerData,
          { providerId: 'google.com', email: 'member@example.test' },
        ],
      }
    })
    const wrapper = mount(AccountSignInMethods)
    expect(connectGoogle).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Google connected: member@example.test')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('Google is connected')
  })
  it('keeps the connection control available if linking fails', async () => {
    connectGoogle.mockRejectedValueOnce(new Error('Google sign-in was cancelled.'))
    const wrapper = mount(AccountSignInMethods)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('cancelled')
    expect(wrapper.get('button').element.disabled).toBe(false)
  })
})
