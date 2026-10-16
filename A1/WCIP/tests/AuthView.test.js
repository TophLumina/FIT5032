import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AuthView from '../src/views/AuthView.vue'
import { authReady, login, loginWithGoogle } from '../src/services/auth'
import { useRoute, useRouter } from 'vue-router'

vi.mock('../src/services/auth', async () => ({
  authReady: (await import('vue')).ref(true),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  authErrorMessage: (error) => error.message,
}))
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  const route = reactive({ name: 'login', query: {} })
  const router = {
    replace: vi.fn(),
    resolve: vi.fn((path) => ({
      name: path === '/map' ? 'plant-map' : 'not-found',
      fullPath: path,
    })),
  }
  return {
    useRoute: () => route,
    useRouter: () => router,
    RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  }
})
enableAutoUnmount(afterEach)
beforeEach(() => {
  authReady.value = true
  useRoute().name = 'login'
  useRoute().query = {}
  loginWithGoogle.mockResolvedValue(undefined)
})

describe('Google sign-in entry', () => {
  it('allows Google on login and registration without requiring password fields', async () => {
    for (const name of ['login', 'register']) {
      useRoute().name = name
      const wrapper = mount(AuthView)
      await wrapper.get('.google-auth-button').trigger('click')
      await flushPromises()
      expect(useRouter().replace).toHaveBeenLastCalledWith({ name: 'account' })
      expect(loginWithGoogle).toHaveBeenCalled()
      expect(login).not.toHaveBeenCalled()
      wrapper.unmount()
    }
  })
  it('preserves valid protected destinations and rejects external redirects', async () => {
    const wrapper = mount(AuthView)
    useRoute().query = { redirect: '/map' }
    await wrapper.get('.google-auth-button').trigger('click')
    await flushPromises()
    expect(useRouter().replace).toHaveBeenLastCalledWith('/map')
    for (const redirect of ['https://external.test', '//external.test', '/\\external.test']) {
      useRoute().query = { redirect }
      await wrapper.get('.google-auth-button').trigger('click')
      await flushPromises()
      expect(useRouter().replace).toHaveBeenLastCalledWith({ name: 'account' })
    }
  })
  it('prevents competing password and Google requests while the popup is open', async () => {
    let finish
    loginWithGoogle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = mount(AuthView)
    await wrapper.get('.google-auth-button').trigger('click')
    expect(wrapper.get('.google-auth-button').element.disabled).toBe(true)
    expect(wrapper.get('fieldset').element.disabled).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(login).not.toHaveBeenCalled()
    finish()
    await flushPromises()
  })
  it('shows cancellation or popup errors and keeps email login available', async () => {
    loginWithGoogle.mockRejectedValueOnce(
      new Error('Google sign-in was cancelled. You can try again.'),
    )
    const wrapper = mount(AuthView)
    await wrapper.get('.google-auth-button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('cancelled')
    expect(wrapper.get('fieldset').element.disabled).toBe(false)
    await wrapper.get('#auth-email').setValue('gardener@example.test')
    await wrapper.get('#auth-password').setValue('example-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(login).toHaveBeenCalledWith('gardener@example.test', 'example-password')
  })
})
