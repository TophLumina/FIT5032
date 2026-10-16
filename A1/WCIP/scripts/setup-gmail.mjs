// One-time sender authorization. Tokens stay in memory and Google Secret Manager.
// No email is sent, and no refresh token is written to a local file or console.
// Keep the downloaded Desktop client JSON in .firebase/ (Git-ignored).
// External OAuth apps in Testing issue Gmail refresh tokens that expire after seven days.
// Re-run this setup if consent expires/revokes, then redeploy wcipSendSeasonalEmail
// to bind the new GMAIL_SENDER_CREDENTIALS secret version.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import {
  desktopClient,
  authorizationRequest,
  callbackCode,
  exchangeAuthorization,
} from './gmail-oauth.mjs'

delete process.env.DEBUG
const require = createRequire(import.meta.url)
let server, timeout
try {
  const { values } = parseArgs({
    options: {
      project: { type: 'string' },
      sender: { type: 'string' },
      client: { type: 'string' },
    },
  })
  if (
    values.project !== 'fit5032-e0aef' ||
    values.sender !== 'elin2625792753@gmail.com' ||
    !values.client
  )
    throw new Error(
      'Usage: node scripts/setup-gmail.mjs --project fit5032-e0aef --sender elin2625792753@gmail.com --client .firebase/gmail-client.json',
    )
  const client = desktopClient(JSON.parse(await readFile(values.client, 'utf8')), values.project)
  const cliAuth = require('firebase-tools/lib/auth')
  const account = cliAuth.getProjectDefaultAccount(process.cwd())
  if (!account?.tokens?.refresh_token)
    throw new Error('Sign in with firebase login before running Gmail setup.')
  async function storeCredentials(credentials) {
    const access = await cliAuth.getAccessToken(account.tokens.refresh_token, [
      'https://www.googleapis.com/auth/cloud-platform',
    ])
    const root = `https://secretmanager.googleapis.com/v1/projects/${values.project}/secrets`
    const headers = {
      Authorization: `Bearer ${access.access_token}`,
      'Content-Type': 'application/json',
    }
    const secretUrl = `${root}/GMAIL_SENDER_CREDENTIALS`
    const existing = await fetch(secretUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    })
    if (existing.status === 404) {
      const created = await fetch(`${root}?secretId=GMAIL_SENDER_CREDENTIALS`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ replication: { automatic: {} } }),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      })
      if (!created.ok && created.status !== 409)
        throw new Error(`Secret creation failed (HTTP ${created.status}).`)
    } else if (!existing.ok) throw new Error(`Secret lookup failed (HTTP ${existing.status}).`)
    const saved = await fetch(`${secretUrl}:addVersion`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        payload: { data: Buffer.from(JSON.stringify(credentials)).toString('base64') },
      }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    })
    if (!saved.ok) throw new Error(`Secret save failed (HTTP ${saved.status}). Run setup again.`)
    return (await saved.json()).name
  }
  let pending,
    handling = false
  let complete, fail
  const finished = new Promise((resolve, reject) => {
    complete = resolve
    fail = reject
  })
  server = createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    const url = new URL(request.url, pending.redirect)
    if (request.method !== 'GET' || url.pathname !== '/oauth2/callback') {
      response.writeHead(404).end('Not found.')
      return
    }
    let code
    try {
      code = callbackCode(url, pending)
    } catch {
      response
        .writeHead(400)
        .end(
          'Authorization was cancelled or could not be validated. Restart the Gmail setup command.',
        )
      return
    }
    if (handling) {
      response.writeHead(409).end('Authorization is already being processed.')
      return
    }
    handling = true
    try {
      const credentials = await exchangeAuthorization(client, pending, code, values.sender)
      const version = await storeCredentials(credentials)
      response.end(
        'WCIP Gmail sender authorized. Credentials were saved to Google Secret Manager. You may close this tab. No email was sent.',
      )
      complete({ sender: credentials.email, secretVersion: version, deliveryRequested: false })
    } catch {
      response
        .writeHead(400)
        .end(
          'Gmail setup did not complete. Confirm the selected account and sending permission, then restart setup. No email was sent.',
        )
      fail(
        new Error(
          'Gmail setup failed. Check the selected account, sending permission, OAuth client and Secret Manager access. No credentials were printed.',
        ),
      )
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  pending = authorizationRequest(client, values.sender, server.address().port)
  console.log(
    'Open this Google authorization URL in your browser and select the configured Gmail sender:',
  )
  console.log(pending.url)
  console.log(
    'Only send-email and basic identity permissions are requested. Waiting up to 10 minutes; no email will be sent.',
  )
  timeout = setTimeout(
    () => fail(new Error('Gmail authorization timed out. Run setup again.')),
    600000,
  )
  console.log(JSON.stringify(await finished))
} catch (error) {
  const safe =
    /^(Usage:|Use a downloaded|Sign in with firebase|Gmail setup failed|Gmail authorization timed out)/.test(
      error.message,
    )
  console.error(
    safe
      ? error.message
      : 'Gmail setup could not start. Check the client JSON path, Firebase login and network connection. No credentials were printed.',
  )
  process.exitCode = 1
} finally {
  clearTimeout(timeout)
  if (server) {
    server.closeAllConnections()
    server.close()
  }
}
