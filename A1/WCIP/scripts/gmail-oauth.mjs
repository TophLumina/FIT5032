import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { gmailSendScope, verifiedGmailIdentity } from '../functions/gmail.js'

export function desktopClient(document, project) {
  const client = document?.installed
  if (
    !client ||
    client.project_id !== project ||
    typeof client.client_id !== 'string' ||
    !client.client_id.endsWith('.apps.googleusercontent.com') ||
    typeof client.client_secret !== 'string' ||
    !client.client_secret ||
    client.auth_uri !== 'https://accounts.google.com/o/oauth2/auth' ||
    client.token_uri !== 'https://oauth2.googleapis.com/token'
  )
    throw new Error(
      'Use a downloaded Desktop app OAuth client JSON from the specified Firebase project.',
    )
  return { clientId: client.client_id, clientSecret: client.client_secret }
}

export function authorizationRequest(client, email, port) {
  if (!/^[a-zA-Z0-9.]+@gmail\.com$/.test(email))
    throw new Error('Use the configured personal Gmail sender address.')
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const redirect = `http://127.0.0.1:${port}/oauth2/callback`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: `openid email ${gmailSendScope}`,
    access_type: 'offline',
    prompt: 'consent select_account',
    login_hint: email,
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString()
  return { url: url.href, state, verifier, redirect }
}

export function callbackCode(url, pending) {
  if (url.pathname !== '/oauth2/callback') throw new Error('Invalid callback path.')
  const values = url.searchParams.getAll('state')
  const incoming = Buffer.from(values[0] || '')
  const expected = Buffer.from(pending.state)
  if (
    values.length !== 1 ||
    incoming.length !== expected.length ||
    !timingSafeEqual(incoming, expected)
  )
    throw new Error('Invalid OAuth state. No credentials were saved.')
  if (url.searchParams.has('error'))
    throw new Error('Google authorization was not granted. No credentials were saved.')
  const codes = url.searchParams.getAll('code')
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096)
    throw new Error('Missing OAuth authorization code.')
  return codes[0]
}

export async function exchangeAuthorization(client, pending, code, email, fetcher = fetch) {
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: pending.redirect,
      code_verifier: pending.verifier,
      grant_type: 'authorization_code',
    }).toString(),
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  })
  if (!response.ok)
    throw new Error(
      `Google authorization exchange failed (HTTP ${response.status}). Run setup again.`,
    )
  const result = await response.json()
  const scopes = typeof result.scope === 'string' ? result.scope.split(' ') : []
  if (
    !scopes.includes(gmailSendScope) ||
    typeof result.access_token !== 'string' ||
    typeof result.refresh_token !== 'string' ||
    !result.refresh_token
  )
    throw new Error('Grant Gmail sending permission and offline access, then run setup again.')
  await verifiedGmailIdentity(result.access_token, email, fetcher)
  return {
    ...client,
    refreshToken: result.refresh_token,
    email,
    scopes,
    authorizedAt: new Date().toISOString(),
  }
}
