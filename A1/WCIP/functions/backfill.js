import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { projectDocument } from './reporting.js'

export async function backfillAnalytics(db) {
  const config = db.doc('status/config')
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(config)
    if (!snapshot.data()?.loginTrackingStartedAt)
      tx.set(config, { loginTrackingStartedAt: Timestamp.now() }, { merge: true })
  })
  let processed = 0
  for (const collection of [
    db.collection('visits'),
    db.collectionGroup('comments'),
    db.collection('analyticsEntries'),
  ]) {
    let cursor
    while (true) {
      let query = collection.orderBy(FieldPath.documentId()).limit(200)
      if (cursor) query = query.startAfter(cursor)
      const page = await query.get()
      if (page.empty) break
      // Sequential transactions avoid a hot global-counter document during initial migration.
      for (const document of page.docs) {
        const path =
          document.ref.parent.id === 'analyticsEntries' ? document.data().path : document.ref.path
        await projectDocument(db, path)
        processed++
      }
      cursor = page.docs.at(-1)
    }
  }
  await config.set(
    { analyticsReady: true, analyticsVersion: 1, analyticsBackfilledAt: Timestamp.now() },
    { merge: true },
  )
  return { processed }
}
