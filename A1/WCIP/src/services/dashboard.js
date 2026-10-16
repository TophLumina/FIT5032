import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'
import { syncUserProfile } from './users'
import { recordVisit } from './status'

const requestDashboard = httpsCallable(functions, 'wcipDashboard')
export async function getDashboardData(from, to, signal) {
  signal?.throwIfAborted()
  await Promise.all([recordVisit(), syncUserProfile(auth.currentUser)])
  signal?.throwIfAborted()
  const response = await requestDashboard({ from, to })
  signal?.throwIfAborted()
  return response.data
}
