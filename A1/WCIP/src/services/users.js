import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'

const syncActivity = httpsCallable(functions, 'wcipSyncUserActivity')
let latestKey = ''
let latestRequest
let queue = Promise.resolve()
export function syncUserProfile(user) {
  if (!user?.email) return Promise.resolve()
  const key = JSON.stringify([user.uid, user.displayName, user.metadata?.lastSignInTime])
  if (key === latestKey && latestRequest) return latestRequest
  latestKey = key
  // Registration may update displayName after the initial Auth callback.
  // Serialize those syncs and use only server-fetched account data.
  queue = queue
    .catch(() => {})
    .then(() => {
      if (auth.currentUser?.uid !== user.uid) return
      return syncActivity({})
    })
  latestRequest = queue.catch((error) => {
    if (latestKey === key) latestKey = ''
    throw error
  })
  return latestRequest
}
