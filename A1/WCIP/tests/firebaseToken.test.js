// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { generateKeyPair, SignJWT } from 'jose'
import { verifyFirebaseToken } from '../worker/firebaseAuth.js'

let keys
const projectId = 'fit5032-e0aef'
beforeAll(async () => {
  keys = await generateKeyPair('RS256')
})
async function token(overrides = {}, privateKey = keys.privateKey) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    sub: 'ordinary-gardener',
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    exp: now + 3600,
    iat: now - 5,
    auth_time: now - 10,
    firebase: { sign_in_provider: 'password' },
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .sign(privateKey)
}
describe('Firebase JWT verification', () => {
  it('accepts a signed ordinary user without requiring admin privileges', async () => {
    expect(await verifyFirebaseToken(await token(), projectId, keys.publicKey)).toBe(
      'ordinary-gardener',
    )
  })
  it('accepts a Google session through the existing Firebase signature and project checks', async () => {
    expect(
      await verifyFirebaseToken(
        await token({ firebase: { sign_in_provider: 'google.com' } }),
        projectId,
        keys.publicKey,
      ),
    ).toBe('ordinary-gardener')
  })
  it.each([
    { aud: 'different-project' },
    { iss: 'https://attacker.test' },
    { sub: '' },
    { exp: 1 },
    { iat: 9999999999 },
    { auth_time: 9999999999 },
    { auth_time: null },
    { firebase: { sign_in_provider: 'anonymous' } },
  ])('rejects invalid claims: %o', async (claims) => {
    await expect(
      verifyFirebaseToken(await token(claims), projectId, keys.publicKey),
    ).rejects.toThrow()
  })
  it('rejects a token signed by an untrusted key', async () => {
    const other = await generateKeyPair('RS256')
    await expect(
      verifyFirebaseToken(await token({}, other.privateKey), projectId, keys.publicKey),
    ).rejects.toThrow()
  })
  it('rejects unsigned emulator tokens in production', async () => {
    const unsigned = `${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(JSON.stringify({ sub: 'admin' }))}.`
    await expect(verifyFirebaseToken(unsigned, projectId, keys.publicKey)).rejects.toThrow()
  })
})
