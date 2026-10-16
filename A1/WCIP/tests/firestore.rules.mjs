import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  getCountFromServer,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'

let environment
const password = { firebase: { sign_in_provider: 'password' } }
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-wcip',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  })
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, 'admins', 'admin'), { role: 'admin' }),
      setDoc(doc(db, 'users', 'admin'), { email: 'admin@example.test', displayName: 'Admin' }),
      setDoc(doc(db, 'users', 'member'), { email: 'member@example.test', displayName: 'Member' }),
      setDoc(doc(db, 'visits', '01234567890123456789'), {
        visitedAt: Timestamp.fromDate(new Date('2026-10-15T00:00:00Z')),
      }),
      setDoc(doc(db, 'status', 'config'), { trackingStartedAt: Timestamp.now() }),
      setDoc(doc(db, 'books', 'legacy-book'), { name: 'Exercise fixture', isbn: 123 }),
      setDoc(doc(db, 'discussions', 'plant:native-violet', 'comments', 'one'), {
        authorUid: 'member',
        message: 'A useful plant.',
        rating: 5,
      }),
    ])
  })
})
after(async () => {
  await environment?.cleanup()
})

test('administrator can read their own role but reports require a Cloud Function', async () => {
  const db = environment.authenticatedContext('admin', password).firestore()
  await assertSucceeds(getDoc(doc(db, 'admins', 'admin')))
})
for (const identity of ['guest', 'member', 'admin'])
  test(`${identity} cannot read administrator reports`, async () => {
    const db =
      identity === 'guest'
        ? environment.unauthenticatedContext().firestore()
        : environment.authenticatedContext(identity, password).firestore()
    await Promise.all([
      assertFails(getDocs(collection(db, 'admins'))),
      assertFails(getDocs(collection(db, 'users'))),
      assertFails(getCountFromServer(collection(db, 'visits'))),
      assertFails(getDoc(doc(db, 'status', 'config'))),
      assertFails(getDocs(collectionGroup(db, 'comments'))),
    ])
  })
test('members can still read their own profile and public plant comments', async () => {
  const db = environment.authenticatedContext('member', password).firestore()
  await assertSucceeds(getDoc(doc(db, 'users', 'member')))
  await assertSucceeds(getDocs(collection(db, 'discussions', 'plant:native-violet', 'comments')))
})
test('neither members nor administrators can assign roles from the client', async () => {
  for (const uid of ['member', 'admin'])
    await assertFails(
      setDoc(doc(environment.authenticatedContext(uid, password).firestore(), 'admins', uid), {
        role: 'admin',
      }),
    )
})
for (const identity of ['guest', 'member', 'admin'])
  test(`${identity} cannot access or recreate exercise collections`, async () => {
    const db =
      identity === 'guest'
        ? environment.unauthenticatedContext().firestore()
        : environment.authenticatedContext(identity, password).firestore()
    await Promise.all([
      assertFails(getDocs(collection(db, 'books'))),
      assertFails(getDoc(doc(db, 'books', 'legacy-book'))),
      assertFails(setDoc(doc(db, 'books', 'new-book'), { name: 'Exercise', isbn: 456 })),
      assertFails(updateDoc(doc(db, 'books', 'legacy-book'), { name: 'Changed' })),
      assertFails(deleteDoc(doc(db, 'books', 'legacy-book'))),
      assertFails(setDoc(doc(db, 'library', 'new-book'), { name: 'Exercise' })),
    ])
  })
test('revoking the administrator document denies subsequent report reads', async () => {
  await environment.withSecurityRulesDisabled((context) =>
    deleteDoc(doc(context.firestore(), 'admins', 'admin')),
  )
  const db = environment.authenticatedContext('admin', password).firestore()
  await assertFails(getDocs(collection(db, 'admins')))
  await assertFails(getDocs(collection(db, 'users')))
})

for (const identity of ['member', 'admin'])
  test(
    identity + ' cannot write profiles, login history or analytics from the client',
    async () => {
      const db = environment.authenticatedContext(identity, password).firestore()
      for (const path of [
        'users/' + identity,
        'loginEvents/forged',
        'loginDays/2026-10-16/users/forged',
        'analyticsDays/2026-10-16',
        'analyticsTotals/current',
        'analyticsEntries/forged',
        'analyticsComments/forged',
        'analyticsUserStats/forged',
      ]) {
        await assertFails(setDoc(doc(db, path), { count: 999, lastLoginAt: Timestamp.now() }))
        if (!path.startsWith('users/')) await assertFails(getDoc(doc(db, path)))
      }
    },
  )
