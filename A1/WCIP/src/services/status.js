import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDocFromServer,
  getDocsFromServer,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { siteDayRange } from '@/utils/siteDate'

let visitRequest
export function recordVisit() {
  // One record per application load. Repeated calls and SPA navigation cannot add duplicates.
  if (!visitRequest) {
    const visit = doc(collection(db, 'visits'))
    visitRequest = setDoc(visit, { visitedAt: serverTimestamp() }).catch(() => {
      // Analytics must not stop browsing when a request is blocked or the network fails.
    })
  }
  return visitRequest
}

export async function getSiteStatus(day) {
  await recordVisit()
  const { start, end } = siteDayRange(day)
  const visits = collection(db, 'visits')
  const [total, daily, profiles, comments, config] = await Promise.all([
    getCountFromServer(visits),
    getCountFromServer(
      query(visits, where('visitedAt', '>=', start), where('visitedAt', '<', end)),
    ),
    getDocsFromServer(collection(db, 'users')),
    getDocsFromServer(collectionGroup(db, 'comments')),
    getDocFromServer(doc(db, 'status', 'config')),
  ])
  const counts = new Map()
  for (const comment of comments.docs) {
    const uid = comment.data().authorUid
    counts.set(uid, (counts.get(uid) || 0) + 1)
  }
  return {
    totalVisits: total.data().count,
    dailyVisits: daily.data().count,
    commentCount: comments.size,
    users: profiles.docs.map((entry) => ({
      uid: entry.id,
      email: entry.data().email || '',
      displayName: entry.data().displayName || 'Gardener',
      commentCount: counts.get(entry.id) || 0,
    })),
    trackingStartedAt: config.data()?.trackingStartedAt?.toDate() ?? null,
  }
}
