// This command can only use SendGrid sandbox mode. It never delivers email.
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { createSeasonalGuide, emailText } from '../functions/seasonalGuide.js'
import { guidePdf } from '../functions/guidePdf.js'
import { senderConfig, mailPayload } from '../functions/sendgrid.js'

delete process.env.DEBUG
const require = createRequire(import.meta.url)
try {
  if (process.argv.slice(2).join(' ') !== '--project fit5032-e0aef')
    throw new Error(
      'Use --project fit5032-e0aef to validate the configured mail provider in sandbox mode.',
    )
  const env = parseEnv(
    await readFile(new URL('../functions/.env.fit5032-e0aef', import.meta.url), 'utf8'),
  )
  const sender = senderConfig(env)
  const auth = require('firebase-tools/lib/auth')
  const account = auth.getProjectDefaultAccount(process.cwd())
  if (!account?.tokens?.refresh_token) throw new Error('Sign in to Firebase CLI first.')
  const token = await auth.getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
  ])
  const secretResponse = await fetch(
    'https://secretmanager.googleapis.com/v1/projects/fit5032-e0aef/secrets/SENDGRID_API_KEY/versions/latest:access',
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    },
  )
  if (!secretResponse.ok)
    throw new Error(`Secret Manager access failed (HTTP ${secretResponse.status}).`)
  const secret = await secretResponse.json()
  const apiKey = Buffer.from(secret.payload.data, 'base64').toString('utf8')
  const plants = JSON.parse(
    await readFile(new URL('../public/data/plants.json', import.meta.url), 'utf8'),
  )
  const guide = createSeasonalGuide(plants)
  const payload = mailPayload({
    sender,
    email: sender.email,
    guide,
    text: emailText(guide),
    pdf: await guidePdf(guide),
  })
  payload.mail_settings = { sandbox_mode: { enable: true } }
  const result = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  })
  if (result.status !== 200)
    throw new Error(
      `SendGrid sandbox validation failed (HTTP ${result.status}). Check the key, sender and provider account. No email delivery was requested.`,
    )
  console.log(
    JSON.stringify({
      sandboxValidated: true,
      httpStatus: result.status,
      attachment: guide.filename,
      deliveryRequested: false,
    }),
  )
} catch (error) {
  // Only our deliberate error messages are safe to expose; never dump credential-bearing objects.
  const known =
    /^(Use --project|Sign in to Firebase|Secret Manager access failed|SendGrid sandbox validation failed|The verified email sender)/.test(
      error.message,
    )
  console.error(
    known
      ? error.message
      : 'Sandbox validation could not complete. Check local configuration and network access. No email delivery was requested.',
  )
  process.exitCode = 1
}
