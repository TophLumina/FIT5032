import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null },
  popup: vi.fn(),
  link: vi.fn(),
  sync: vi.fn(),
  parameters: vi.fn(),
  observer: null,
}))
vi.mock('../src/services/firebase', () => ({ auth: mocks.auth, db: {} }))
vi.mock('../src/services/users', () => ({ syncUserProfile: mocks.sync }))
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  onAuthStateChanged: (_, callback) => {
    mocks.observer = callback
    callback(null)
  },
  GoogleAuthProvider: class {
    providerId = 'google.com'
    setCustomParameters = mocks.parameters
  },
  signInWithPopup: mocks.popup,
  linkWithPopup: mocks.link,
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}))
beforeEach(() => {
  vi.resetModules()
  mocks.auth.currentUser = null
  mocks.sync.mockResolvedValue(undefined)
})

describe('Google Firebase integration', () => {
  it('opens Firebase Google auth without requesting extra Google API scopes or storing OAuth tokens', async () => {
    const service = await import('../src/services/auth')
    const account = {
      uid: 'google-user',
      email: 'google@example.test',
      providerData: [{ providerId: 'google.com' }],
    }
    mocks.popup.mockImplementationOnce(async () => {
      mocks.auth.currentUser = account
      mocks.observer(account)
      return { user: account }
    })
    await service.loginWithGoogle()
    expect(mocks.popup).toHaveBeenCalledWith(
      mocks.auth,
      expect.objectContaining({ providerId: 'google.com' }),
    )
    expect(mocks.parameters).toHaveBeenCalledWith({ prompt: 'select_account' })
    expect(service.user.value.uid).toBe('google-user')
    expect(service.isAdmin.value).toBe(false)
    expect(mocks.sync).toHaveBeenCalledWith(account)
  })
  it('links to the authenticated user instead of signing in as another account', async () => {
    const service = await import('../src/services/auth')
    const account = {
      uid: 'existing-user',
      email: 'existing@example.test',
      providerData: [{ providerId: 'password' }],
    }
    mocks.auth.currentUser = account
    mocks.observer(account)
    mocks.link.mockResolvedValueOnce({ user: account })
    await service.connectGoogle()
    expect(mocks.link).toHaveBeenCalledWith(
      account,
      expect.objectContaining({ providerId: 'google.com' }),
    )
    expect(mocks.popup).not.toHaveBeenCalled()
    expect(service.user.value.uid).toBe('existing-user')
  })
  it('does not restore stale account state if the session changes during linking', async () => {
    const service = await import('../src/services/auth')
    const account = { uid: 'old', email: 'old@example.test' }
    mocks.auth.currentUser = account
    mocks.observer(account)
    mocks.link.mockImplementationOnce(async () => {
      mocks.auth.currentUser = null
      mocks.observer(null)
      return { user: account }
    })
    await expect(service.connectGoogle()).rejects.toMatchObject({ name: 'AbortError' })
    expect(service.user.value).toBe(null)
  })
  it('explains blocked popups and credential collisions without silently merging accounts', async () => {
    const { authErrorMessage } = await import('../src/services/auth')
    expect(authErrorMessage({ code: 'auth/popup-blocked' })).toContain('Allow pop-ups')
    expect(authErrorMessage({ code: 'auth/account-exists-with-different-credential' })).toContain(
      'connect Google in My account',
    )
    expect(authErrorMessage({ code: 'auth/credential-already-in-use' })).toContain(
      'not merged automatically',
    )
  })
})
