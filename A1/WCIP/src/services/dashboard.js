import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { recordVisit } from './status'
import { siteDayRange } from '@/utils/siteDate'
import { analyticsRange } from '@/utils/analytics'

async function boundedDocuments(reference, maximum, label) {
  const snapshot = await getDocsFromServer(query(reference, limit(maximum + 1)))
  if (snapshot.size > maximum)
    throw new Error(
      `${label} exceed the dashboard's current reporting limit. A paginated reporting backend is needed; partial totals are not shown.`,
    )
  return snapshot.docs
}

export async function getDashboardData(from, to, signal) {
  const range = analyticsRange(from, to)
  signal?.throwIfAborted()
  await recordVisit()
  signal?.throwIfAborted()
  const visits = collection(db, 'visits')
  const [total, profiles, roles, comments, config] = await Promise.all([
    getCountFromServer(visits),
    boundedDocuments(collection(db, 'users'), 2000, 'User profiles'),
    boundedDocuments(collection(db, 'admins'), 2000, 'Administrator roles'),
    boundedDocuments(collectionGroup(db, 'comments'), 5000, 'Comments'),
    getDocFromServer(doc(db, 'status', 'config')),
  ])
  const dailyVisits = []
  // Aggregate on the server; avoid downloading every visit or 90 simultaneous requests.
  for (let i = 0; i < range.days.length; i += 6) {
    signal?.throwIfAborted()
    dailyVisits.push(
      ...(await Promise.all(
        range.days.slice(i, i + 6).map(async (day) => {
          const { start, end } = siteDayRange(day)
          const result = await getCountFromServer(
            query(visits, where('visitedAt', '>=', start), where('visitedAt', '<', end)),
          )
          return { day, count: result.data().count }
        }),
      )),
    )
  }
  signal?.throwIfAborted()
  return {
    totalVisits: total.data().count,
    visits: dailyVisits,
    profiles: profiles.map((entry) => ({ ...entry.data(), uid: entry.id })),
    roles: roles.map((entry) => ({ role: entry.data().role, uid: entry.id })),
    comments: comments.map((entry) => ({ ...entry.data(), path: entry.ref.path })),
    trackingStartedAt: config.data()?.trackingStartedAt ?? null,
  }
}
