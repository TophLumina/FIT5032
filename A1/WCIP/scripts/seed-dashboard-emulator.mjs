// Synthetic data for the local demo-wcip emulator only. Never imports live credentials.
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp, writeBatch } from 'firebase/firestore'

const projectId = 'demo-wcip'
const authOrigin = 'http://127.0.0.1:9099'
const password = 'Local-demo-123!'
async function localAccount(email) {
  const request = async (operation) =>
    fetch(`${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:${operation}?key=demo-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
  let response = await request('signUp')
  if (!response.ok) response = await request('signInWithPassword')
  if (!response.ok) throw new Error('Local emulator account setup failed')
  return (await response.json()).localId
}
const adminUid = await localAccount('admin@wcip.test')
const memberUid = await localAccount('member@wcip.test')
const environment = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
})
try {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const now = new Date()
    const noon = (offset) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 1))
    const writes = []
    for (let i = 0; i < 14; i++) {
      const uid = i === 0 ? adminUid : i === 1 ? memberUid : `demo-gardener-${i}`
      writes.push([
        'users/' + uid,
        {
          email:
            i === 0
              ? 'admin@wcip.test'
              : i === 1
                ? 'member@wcip.test'
                : `gardener${i}@example.test`,
          displayName: i === 0 ? 'Local administrator' : `Demo Gardener ${i}`,
          updatedAt: Timestamp.now(),
        },
      ])
      if (i === 0 || i === 2) writes.push(['admins/' + uid, { role: 'admin' }])
    }
    writes.push(['status/config', { trackingStartedAt: Timestamp.fromDate(noon(89)) }])
    for (let day = 0; day < 90; day++)
      for (let visit = 0; visit < 3 + ((day * 7) % 18); visit++)
        writes.push([
          `visits/demo${String(day).padStart(8, '0')}${String(visit).padStart(8, '0')}`,
          { visitedAt: Timestamp.fromDate(noon(day)) },
        ])
    const slugs = [
      'native-violet',
      'coastal-rosemary',
      'silver-banksia',
      'river-mint',
      'chocolate-lily',
      'common-correa',
    ]
    for (let i = 0; i < 48; i++)
      writes.push([
        `discussions/plant:${slugs[i % 6]}/comments/demo-${i}`,
        {
          authorUid: i % 3 === 0 ? adminUid : memberUid,
          author: `Demo Gardener ${i % 8}`,
          message:
            'Synthetic local test feedback: this plant has worked well in a Melbourne garden.',
          rating: i % 5 === 0 ? null : 1 + (i % 5),
          createdAt: Timestamp.fromDate(noon(i % 20)),
          updatedAt: Timestamp.now(),
        },
      ])
    for (let offset = 0; offset < writes.length; offset += 400) {
      const batch = writeBatch(db)
      for (const [path, data] of writes.slice(offset, offset + 400)) batch.set(doc(db, path), data)
      await batch.commit()
    }
    await setDoc(doc(db, 'discussions', 'guide:soil'), { contentType: 'guide' })
  })
  console.log(
    'Local demo-wcip fixtures ready. Admin: admin@wcip.test; member: member@wcip.test; password: Local-demo-123! (emulator only).',
  )
} finally {
  await environment.cleanup()
}
