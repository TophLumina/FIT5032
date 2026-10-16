import assert from 'node:assert/strict'

// Synthetic identity assertions are accepted only by the loopback Auth emulator.
export async function googleAccount(email, existingToken) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')
    throw new Error('Local Auth emulator required')
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: 'http://localhost',
        returnSecureToken: true,
        postBody: new URLSearchParams({
          providerId: 'google.com',
          id_token: JSON.stringify({
            sub: `test-google-${email}`,
            email,
            email_verified: true,
            name: 'Google Gardener',
          }),
        }).toString(),
        ...(existingToken ? { idToken: existingToken } : {}),
      }),
    },
  )
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.ok(data.localId && data.idToken, 'Google emulator must issue a Firebase session')
  return { uid: data.localId, token: data.idToken, email }
}
