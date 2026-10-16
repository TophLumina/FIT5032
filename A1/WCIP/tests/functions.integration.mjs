import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { createBackend } from '../functions/backend.js'
import { backfillAnalytics } from '../functions/backfill.js'
import { keyFor, projectDocument } from '../functions/reporting.js'
import { siteDay } from '../functions/shared/siteDate.js'
import { googleAccount } from './googleEmulator.mjs'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
  throw new Error('Local Firestore emulator required')
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')
  throw new Error('Local Auth emulator required')
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const app = initializeApp({ projectId: 'demo-wcip' }, 'integration')
const db = getFirestore(app)
const auth = getAuth(app)
const plants = [{ slug: 'native-violet', commonName: 'Native Violet' }]
const backend = createBackend({ db, auth, plants })
const today = siteDay()
let member, admin
async function account(email) {
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Local-test-123!', returnSecureToken: true }),
    },
  )
  assert.equal(response.status, 200)
  const data = await response.json()
  return { uid: data.localId, token: data.idToken }
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
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Trigger did not converge within 10 seconds')
}
before(async () => {
  const cleared = await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-wcip/databases/(default)/documents',
    { method: 'DELETE' },
  )
  assert.equal(cleared.status, 200)
  member = await account('member@integration.test')
  admin = await account('admin@integration.test')
  await db.doc(`admins/${admin.uid}`).set({ role: 'admin' })
  await db.doc('status/config').set({
    loginTrackingStartedAt: Timestamp.fromMillis(Date.now() - 600000),
    analyticsReady: true,
  })
})
after(async () => {
  await db.terminate()
  await deleteApp(app)
})

test('callable rejects guests, invalid tokens, forged profile fields and member reports', async () => {
  assert.equal((await callable('wcipSyncUserActivity')).status, 401)
  assert.equal((await callable('wcipSyncUserActivity', { token: 'invalid' })).status, 401)
  assert.equal(
    (await callable('wcipSyncUserActivity', member, { uid: admin.uid, email: 'forged@test.test' }))
      .status,
    400,
  )
  assert.equal((await callable('wcipDashboard', member, { from: today, to: today })).status, 403)
})
test('parallel and repeated session syncs create canonical profiles and only one login per session', async () => {
  await auth.updateUser(member.uid, { displayName: 'Canonical member' })
  const result = await Promise.all(
    Array.from({ length: 4 }, () => callable('wcipSyncUserActivity', member)),
  )
  for (const response of result) assert.equal(response.status, 200, JSON.stringify(response.body))
  assert.equal(result.filter((response) => response.body.result.loginRecorded).length, 1)
  assert.equal((await db.collection('loginEvents').get()).size, 1)
  const profile = (await db.doc(`users/${member.uid}`).get()).data()
  assert.equal(profile.displayName, 'Canonical member')
  assert.equal(profile.email, 'member@integration.test')
  assert.ok(profile.lastLoginAt)
  assert.equal(profile.seasonalEmailSubscribed, false)
  await auth.updateUser(member.uid, { displayName: 'Updated canonical name' })
  assert.equal((await callable('wcipSyncUserActivity', member)).status, 200)
  assert.equal(
    (await db.doc(`users/${member.uid}`).get()).data().displayName,
    'Updated canonical name',
  )
  assert.equal((await db.doc(`analyticsDays/${today}`).get()).data().logins, 1)
  assert.equal((await db.doc(`analyticsDays/${today}`).get()).data().loginUsers, 1)
})
test('second authentication counts a session but not another daily user; old restored sessions are not invented', async () => {
  const claims = await auth.verifyIdToken(member.token)
  const request = {
    auth: { uid: member.uid, token: { ...claims, auth_time: claims.auth_time + 1 } },
    data: {},
  }
  // Unit boundary uses trusted claims; the real callable token verification is tested above.
  await backend.syncUserActivity(request)
  assert.equal((await db.doc(`analyticsDays/${today}`).get()).data().logins, 2)
  assert.equal((await db.doc(`analyticsDays/${today}`).get()).data().loginUsers, 1)
  request.auth.token.auth_time = claims.auth_time - 3600
  // Simulate a valid older account session without a later token revocation timestamp.
  const olderBackend = createBackend({
    db,
    plants,
    auth: {
      getUser: async () => ({
        ...(await auth.getUser(member.uid)),
        tokensValidAfterTime: '1970-01-01T00:00:00Z',
      }),
    },
  })
  assert.equal((await olderBackend.syncUserActivity(request)).loginRecorded, false)
  assert.equal((await db.doc(`analyticsDays/${today}`).get()).data().logins, 2)
})
test('email preferences require authentication and reject other identities or forged consent fields', async () => {
  assert.equal((await callable('wcipEmailPreferences')).status, 401)
  assert.equal((await callable('wcipEmailPreferences', { token: 'invalid' })).status, 401)
  for (const data of [
    { subscribed: 'true' },
    { subscribed: 1 },
    { subscribed: null },
    { subscribed: true, uid: admin.uid },
    { subscribed: true, email: 'external@example.test' },
    { subscribed: true, updatedAt: '2020-01-01' },
  ])
    assert.equal((await callable('wcipEmailPreferences', member, data)).status, 400)
  assert.equal(
    (await callable('wcipEmailPreferences', admin, { subscribed: true, uid: member.uid })).status,
    400,
  )
  assert.equal((await db.doc(`users/${member.uid}`).get()).data().seasonalEmailSubscribed, false)
})

test('subscriptions persist across syncs, repeated saves are idempotent and unsubscribing takes effect', async () => {
  const initial = await callable('wcipEmailPreferences', member)
  assert.equal(initial.status, 200)
  assert.equal(initial.body.result.subscribed, false)
  const subscribed = await callable('wcipEmailPreferences', member, { subscribed: true })
  assert.equal(subscribed.status, 200)
  assert.equal(subscribed.body.result.subscribed, true)
  assert.equal(subscribed.body.result.email, 'member@integration.test')
  assert.ok(subscribed.body.result.updatedAt)
  const again = await callable('wcipEmailPreferences', member, { subscribed: true })
  assert.equal(again.body.result.updatedAt, subscribed.body.result.updatedAt)
  assert.equal((await callable('wcipSyncUserActivity', member)).status, 200)
  assert.equal((await callable('wcipEmailPreferences', member)).body.result.subscribed, true)
  assert.equal((await db.doc(`users/${member.uid}`).get()).data().seasonalEmailSubscribed, true)
  const unsubscribed = await callable('wcipEmailPreferences', member, { subscribed: false })
  assert.equal(unsubscribed.status, 200)
  assert.equal(unsubscribed.body.result.subscribed, false)
  assert.equal((await callable('wcipEmailPreferences', member)).body.result.subscribed, false)
})

test('legacy profiles default to no subscription and an email change does not inherit consent', async () => {
  const profile = db.doc(`users/${member.uid}`)
  await profile.update({ seasonalEmailSubscribed: FieldValue.delete() })
  assert.equal((await callable('wcipEmailPreferences', member)).body.result.subscribed, false)
  assert.equal((await callable('wcipSyncUserActivity', member)).status, 200)
  assert.equal((await profile.get()).data().seasonalEmailSubscribed, false)
  await callable('wcipEmailPreferences', member, { subscribed: true })
  await profile.update({ email: 'old-account-address@example.test' })
  const staleAddress = await callable('wcipEmailPreferences', member, { subscribed: true })
  assert.equal(staleAddress.status, 400)
  assert.equal(staleAddress.body.error.status, 'FAILED_PRECONDITION')
  assert.equal((await callable('wcipSyncUserActivity', member)).status, 200)
  assert.equal((await profile.get()).data().seasonalEmailSubscribed, false)
  assert.equal((await profile.get()).data().email, 'member@integration.test')
})

test('real triggers aggregate visits and feedback; retries, edits, deletion and backfill do not double count', async () => {
  const visit = db.doc('visits/abcdefghijklmnopqrst')
  const comment = db.doc('discussions/plant:native-violet/comments/integration')
  await visit.set({ visitedAt: Timestamp.now() })
  await comment.set({
    authorUid: member.uid,
    author: 'Gardener',
    message: 'A good choice for this garden.',
    rating: 5,
    createdAt: Timestamp.now(),
  })
  await until(
    async () => (await db.doc('analyticsTotals/current').get()).data()?.currentComments === 1,
  )
  await until(async () => (await db.doc('analyticsTotals/current').get()).data()?.totalVisits === 1)
  await Promise.all([
    projectDocument(db, visit.path),
    projectDocument(db, comment.path),
    projectDocument(db, comment.path),
  ])
  await backfillAnalytics(db)
  await backfillAnalytics(db)
  assert.equal((await db.doc('analyticsTotals/current').get()).data().totalVisits, 1)
  assert.equal((await db.doc('analyticsTotals/current').get()).data().currentComments, 1)
  await comment.update({ rating: 2, message: 'Updated feedback after more growing time.' })
  await until(async () => (await db.doc(`analyticsDays/${today}`).get()).data()?.ratingSum === 2)
  await projectDocument(db, comment.path)
  assert.equal((await db.doc(`analyticsDays/${today}`).get()).data().ratings, 1)
  assert.equal(
    (await db.doc(`analyticsUserStats/${keyFor(member.uid)}`).get()).data().commentCount,
    1,
  )
  assert.equal((await callable('wcipSyncUserActivity', admin)).status, 200)
  const response = await callable('wcipDashboard', admin, { from: today, to: today })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  const report = response.body.result
  assert.equal(report.periodVisits, 1)
  assert.equal(report.periodComments, 1)
  assert.equal(report.averageRating, 2)
  assert.equal(report.periodLogins, 3)
  assert.equal(report.trend[0].loginUsers, 2)
  assert.equal(report.users.find((user) => user.uid === member.uid).commentCount, 1)
  assert.ok(report.users.find((user) => user.uid === member.uid).lastLoginAt)
  assert.equal(report.users.find((user) => user.uid === member.uid).seasonalEmailSubscribed, false)
  assert.match(report.comments[0].message, /Updated feedback/)
  await comment.delete()
  await until(
    async () => (await db.doc('analyticsTotals/current').get()).data()?.currentComments === 0,
  )
  await projectDocument(db, comment.path)
  assert.equal((await db.doc(`analyticsDays/${today}`).get()).data().ratings, 0)
  assert.equal((await db.collection('analyticsComments').get()).size, 0)
})
test('dashboard validates date ranges and checks current administrator membership', async () => {
  assert.equal(
    (await callable('wcipDashboard', admin, { from: '2026-02-30', to: today })).status,
    400,
  )
  assert.equal(
    (await callable('wcipDashboard', admin, { from: '2020-01-01', to: today })).status,
    400,
  )
  await db.doc(`admins/${admin.uid}`).delete()
  assert.equal((await callable('wcipDashboard', admin, { from: today, to: today })).status, 403)
})

test('disabled accounts cannot change subscription preferences', async () => {
  await auth.updateUser(member.uid, { disabled: true })
  assert.equal((await callable('wcipEmailPreferences', member, { subscribed: true })).status, 401)
  assert.equal((await db.doc(`users/${member.uid}`).get()).data().seasonalEmailSubscribed, false)
})

test('Google sessions sync canonical profiles, record one login and manage opt-in without elevated access', async () => {
  const google = await googleAccount('google-gardener@integration.test')
  const decoded = await auth.verifyIdToken(google.token)
  assert.equal(decoded.firebase.sign_in_provider, 'google.com')
  const responses = await Promise.all([
    callable('wcipSyncUserActivity', google),
    callable('wcipSyncUserActivity', google),
  ])
  assert.ok(responses.every((response) => response.status === 200))
  assert.equal(responses.filter((response) => response.body.result.loginRecorded).length, 1)
  const profile = (await db.doc(`users/${google.uid}`).get()).data()
  assert.equal(profile.email, google.email)
  assert.equal(profile.displayName, 'Google Gardener')
  assert.equal(profile.seasonalEmailSubscribed, false)
  assert.equal(
    (await callable('wcipEmailPreferences', google, { subscribed: true })).body.result.subscribed,
    true,
  )
  assert.equal((await callable('wcipDashboard', google, { from: today, to: today })).status, 403)
  assert.equal((await callable('wcipSeasonalEmailPreview', google)).status, 403)
  await db.doc(`admins/${google.uid}`).set({ role: 'admin' })
  assert.equal((await callable('wcipDashboard', google, { from: today, to: today })).status, 200)
  await db.doc(`admins/${google.uid}`).delete()
  await auth.updateUser(google.uid, { disabled: true })
  assert.equal((await callable('wcipSyncUserActivity', google)).status, 401)
})

test('linking Google to an existing account retains its UID, role and subscription', async () => {
  const existing = await account('google-link@integration.test')
  await callable('wcipSyncUserActivity', existing)
  await callable('wcipEmailPreferences', existing, { subscribed: true })
  await db.doc(`admins/${existing.uid}`).set({ role: 'admin' })
  const linked = await googleAccount('google-link@integration.test', existing.token)
  assert.equal(linked.uid, existing.uid)
  const googleLogin = await googleAccount('google-link@integration.test')
  assert.equal(googleLogin.uid, existing.uid)
  assert.equal((await callable('wcipSyncUserActivity', googleLogin)).status, 200)
  assert.equal((await callable('wcipEmailPreferences', googleLogin)).body.result.subscribed, true)
  assert.equal(
    (await callable('wcipDashboard', googleLogin, { from: today, to: today })).status,
    200,
  )
  const providers = (await auth.getUser(existing.uid)).providerData.map((entry) => entry.providerId)
  assert.ok(providers.includes('password') && providers.includes('google.com'))
  await db.doc(`admins/${existing.uid}`).delete()
})

test('server identity checks continue to reject unsupported and anonymous providers', async () => {
  for (const provider of ['anonymous', 'custom', 'facebook.com', undefined]) {
    const request = {
      auth: { uid: admin.uid, token: { firebase: { sign_in_provider: provider } } },
      data: {},
    }
    await assert.rejects(backend.syncUserActivity(request), { code: 'unauthenticated' })
    await assert.rejects(backend.emailPreferences(request), { code: 'unauthenticated' })
    await assert.rejects(backend.getDashboard(request), { code: 'unauthenticated' })
  }
})
