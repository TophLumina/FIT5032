import { createRequire } from 'node:module'
import { backfillAnalytics } from '../functions/backfill.js'
const require = createRequire(import.meta.url)
const serverRequire = createRequire(new URL('../functions/package.json', import.meta.url))
const { Firestore } = serverRequire('firebase-admin/firestore')
let db
if (process.argv.includes('--emulator')) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
  db = new Firestore({ projectId: 'demo-wcip' })
} else {
  if (process.argv.slice(2).join(' ') !== '--project fit5032-e0aef')
    throw new Error('Use --emulator or explicitly --project fit5032-e0aef.')
  if (process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error('Remove FIRESTORE_EMULATOR_HOST for a production backfill.')
  const auth = require('firebase-tools/lib/auth')
  const account = auth.getProjectDefaultAccount(process.cwd())
  if (!account?.tokens?.refresh_token) throw new Error('Sign in to the Firebase CLI first.')
  const token = await auth.getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
  ])
  const { OAuth2Client } = serverRequire('google-auth-library')
  const client = new OAuth2Client()
  client.setCredentials({ access_token: token.access_token, expiry_date: Date.now() + 50 * 60000 })
  db = new Firestore({ projectId: 'fit5032-e0aef', authClient: client })
}
try {
  console.log(JSON.stringify(await backfillAnalytics(db)))
} finally {
  await db.terminate()
}
