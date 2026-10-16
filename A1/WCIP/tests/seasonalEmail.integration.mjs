import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { createSeasonalEmail } from '../functions/seasonalEmail.js'
import { createSeasonalGuide, previewDigest } from '../functions/seasonalGuide.js'
import { keyFor } from '../functions/reporting.js'
import { siteDay } from '../functions/shared/siteDate.js'
import plants from '../functions/data/plants.json' with { type: 'json' }
import { googleAccount } from './googleEmulator.mjs'

if (
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
)
  throw new Error('Local emulators required')
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const app = initializeApp({ projectId: 'demo-wcip' }, 'seasonal-mail')
const db = getFirestore(app)
const auth = getAuth(app)
const sender = { email: 'wcip@example.test', name: 'WCIP', replyTo: 'wcip@example.test' }
let admin, member, second, calls, provider
const service = createSeasonalEmail({
  db,
  auth,
  plants,
  getSender: () => sender,
  sendMail: async (payload) => {
    calls.push(payload)
    return provider(payload)
  },
})
const guide = createSeasonalGuide(plants)
const ref = (uid) => db.doc(`seasonalMailIssues/${guide.issueId}/recipients/${keyFor(uid)}`)
const request = (recipientUids, extra = {}) => ({
  auth: admin.claims,
  data: {
    issueId: guide.issueId,
    digest: previewDigest(guide, sender),
    recipientUids,
    requestId: randomUUID(),
    ...extra,
  },
})
async function account(email) {
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Mail-test-123!', returnSecureToken: true }),
    },
  )
  assert.equal(response.status, 200)
  const result = await response.json()
  const token = await auth.verifyIdToken(result.idToken)
  return {
    uid: result.localId,
    token: result.idToken,
    email,
    claims: { uid: result.localId, token },
  }
}
async function callable(name, user, data = {}) {
  const response = await fetch(`http://127.0.0.1:5001/demo-wcip/australia-southeast1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
    },
    body: JSON.stringify({ data }),
  })
  return { status: response.status, body: await response.json() }
}
before(async () => {
  admin = await account('mail-admin@integration.test')
  member = await account('mail-member@integration.test')
  second = await account('mail-second@integration.test')
})
beforeEach(async () => {
  calls = []
  provider = async () => ({
    status: 'accepted',
    message: 'Accepted by SendGrid; delivery is not yet confirmed.',
    providerId: 'mock-provider-id',
  })
  await db.doc(`admins/${admin.uid}`).set({ role: 'admin' })
  await auth.updateUser(admin.uid, { disabled: false })
  for (const user of [member, second]) {
    await auth.updateUser(user.uid, { disabled: false, email: user.email })
    await db.doc(`users/${user.uid}`).set({ email: user.email, seasonalEmailSubscribed: true })
    await ref(user.uid).delete()
  }
  await db.doc(`seasonalMailDays/${siteDay()}`).delete()
})
after(async () => {
  await db.terminate()
  await deleteApp(app)
})

test('real callables deny guests/members and emulator never sends real email', async () => {
  for (const name of ['wcipSeasonalEmailPreview', 'wcipSendSeasonalEmail']) {
    assert.equal((await callable(name)).status, 401)
    assert.equal((await callable(name, member)).status, 403)
  }
  const preview = await callable('wcipSeasonalEmailPreview', admin)
  assert.equal(preview.status, 200, JSON.stringify(preview.body))
  assert.equal(
    Buffer.from(preview.body.result.attachment.base64, 'base64').subarray(0, 5).toString(),
    '%PDF-',
  )
  const result = await callable('wcipSendSeasonalEmail', admin, {
    ...request([member.uid]).data,
    digest: preview.body.result.digest,
  })
  assert.equal(result.status, 200, JSON.stringify(result.body))
  assert.match(result.body.result.results[0].message, /disabled in the emulator/)
})

test('preview omits opted-out, changed-email, disabled and deleted accounts', async () => {
  await db.doc(`users/${member.uid}`).update({ seasonalEmailSubscribed: false })
  await auth.updateUser(second.uid, { disabled: true })
  await db
    .doc('users/deleted-mail-user')
    .set({ email: 'deleted@example.test', seasonalEmailSubscribed: true })
  const result = await service.preview({ auth: admin.claims, data: {} })
  assert.ok(
    !result.recipients.some((row) =>
      [member.uid, second.uid, 'deleted-mail-user'].includes(row.uid),
    ),
  )
  await auth.updateUser(second.uid, { disabled: false, email: 'changed-mail@example.test' })
  assert.ok(
    !(await service.preview({ auth: admin.claims, data: {} })).recipients.some(
      (row) => row.uid === second.uid,
    ),
  )
})

test('rejects arbitrary addresses, forged sender/content, duplicate IDs and stale previews', async () => {
  for (const data of [
    { email: 'outsider@example.test' },
    { from: sender.email },
    { body: 'forged' },
    { recipientUids: ['invalid/path'] },
    { recipientUids: [member.uid, member.uid] },
    { recipientUids: [] },
    { recipientUids: Array.from({ length: 11 }, (_, i) => 'uid' + i) },
  ])
    await assert.rejects(service.send(request([member.uid], data)), { code: 'invalid-argument' })
  for (const data of [{ digest: 'old' }, { issueId: '2020-01' }])
    await assert.rejects(service.send(request([member.uid], data)), { code: 'failed-precondition' })
  assert.equal(calls.length, 0)
})

test('parallel and repeated sends submit exactly one private email with a real PDF', async () => {
  const results = await Promise.all([
    service.send(request([member.uid])),
    service.send(request([member.uid])),
  ])
  assert.equal(calls.length, 1)
  assert.ok(results.some((result) => result.results[0].status === 'accepted'))
  assert.deepEqual(calls[0].personalizations, [{ to: [{ email: member.email }] }])
  assert.deepEqual(calls[0].from, { email: sender.email, name: sender.name })
  assert.match(calls[0].content[0].value, /To unsubscribe/)
  const attachment = calls[0].attachments[0]
  assert.equal(attachment.type, 'application/pdf')
  assert.equal(attachment.disposition, 'attachment')
  assert.match(Buffer.from(attachment.content, 'base64').subarray(0, 8).toString(), /^%PDF-1\./)
  assert.equal((await service.send(request([member.uid]))).results[0].status, 'accepted')
  assert.equal(calls.length, 1)
  assert.equal((await db.doc(`seasonalMailDays/${siteDay()}`).get()).data().attempts, 1)
})

test('rechecks consent between recipients, and never substitutes a changed account email', async () => {
  provider = async () => {
    await db.doc(`users/${second.uid}`).update({ seasonalEmailSubscribed: false })
    return { status: 'accepted', message: 'Accepted' }
  }
  const result = await service.send(request([member.uid, second.uid]))
  assert.deepEqual(
    result.results.map((row) => row.status),
    ['accepted', 'skipped'],
  )
  assert.equal(calls.length, 1)
  await db.doc(`users/${second.uid}`).update({ seasonalEmailSubscribed: true })
  await auth.updateUser(second.uid, { email: 'changed-mail@example.test' })
  assert.equal((await service.send(request([second.uid]))).results[0].status, 'skipped')
  assert.equal(calls.length, 1)
})

test('unknown outcomes and unfinished claims cannot be retried, even with a new request ID', async () => {
  provider = async () => {
    throw new Error('lost response after acceptance')
  }
  assert.equal((await service.send(request([member.uid]))).results[0].status, 'unknown')
  assert.equal((await service.send(request([member.uid]))).results[0].status, 'unknown')
  assert.equal(calls.length, 1)
  const record = (await ref(member.uid).get()).data()
  await ref(member.uid).update({ status: 'processing', startedAt: new Date(Date.now() - 300000) })
  assert.equal((await service.send(request([member.uid]))).results[0].status, 'unknown')
  assert.equal(calls.length, 1)
  assert.equal(record.attempts, 1)
})

test('definite rejection requires a new explicit request and current consent before retry', async () => {
  provider = async () => ({
    status: 'rejected',
    message: 'Authorization rejected',
    providerId: null,
  })
  const original = request([member.uid])
  await service.send(original)
  await service.send(original)
  assert.equal(calls.length, 1)
  await db.doc(`users/${member.uid}`).update({ seasonalEmailSubscribed: false })
  assert.equal((await service.send(request([member.uid]))).results[0].status, 'skipped')
  assert.equal(calls.length, 1)
  await db.doc(`users/${member.uid}`).update({ seasonalEmailSubscribed: true })
  provider = async () => ({ status: 'accepted', message: 'Accepted', providerId: 'mock' })
  assert.equal((await service.send(request([member.uid]))).results[0].status, 'accepted')
  assert.equal(calls.length, 2)
})

test('daily and monthly attempt limits prevent further provider calls', async () => {
  await db.doc(`seasonalMailDays/${siteDay()}`).set({ attempts: 100 })
  assert.equal((await service.send(request([member.uid]))).results[0].status, 'limited')
  assert.equal(calls.length, 0)
  await db.doc(`seasonalMailDays/${siteDay()}`).delete()
  provider = async () => ({ status: 'rejected', message: 'Rejected' })
  for (let i = 0; i < 4; i++) await service.send(request([member.uid]))
  assert.equal(calls.length, 3)
  assert.equal((await ref(member.uid).get()).data().attempts, 3)
})

test('revoked role and disabled administrator cannot preview or send', async () => {
  await db.doc(`admins/${admin.uid}`).delete()
  await assert.rejects(service.send(request([member.uid])), { code: 'permission-denied' })
  await db.doc(`admins/${admin.uid}`).set({ role: 'admin' })
  await auth.updateUser(admin.uid, { disabled: true })
  await assert.rejects(service.preview({ auth: admin.claims, data: {} }), {
    code: 'unauthenticated',
  })
  assert.equal(calls.length, 0)
})

test('Google administrators can use email callables while Google members cannot', async () => {
  const google = await googleAccount('google-mail-admin@integration.test')
  assert.equal((await callable('wcipSeasonalEmailPreview', google)).status, 403)
  assert.equal((await callable('wcipSendSeasonalEmail', google)).status, 403)
  await db.doc(`admins/${google.uid}`).set({ role: 'admin' })
  const preview = await callable('wcipSeasonalEmailPreview', google)
  assert.equal(preview.status, 200)
  const sent = await callable('wcipSendSeasonalEmail', google, {
    ...request([member.uid]).data,
    digest: preview.body.result.digest,
  })
  assert.equal(sent.status, 200)
  assert.match(sent.body.result.results[0].message, /disabled in the emulator/)
  await db.doc(`admins/${google.uid}`).delete()
})
