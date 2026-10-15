import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

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
