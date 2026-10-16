import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { createBackend } from '../functions/backend.js'
import { backfillAnalytics } from '../functions/backfill.js'
import { keyFor, projectDocument } from '../functions/reporting.js'
import { siteDay } from '../functions/shared/siteDate.js'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
  throw new Error('Local Firestore emulator required')
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')
  throw new Error('Local Auth emulator required')
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
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
  await db
    .doc('status/config')
    .set({
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
