import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'
import { syncUserProfile } from './users'

const preferences = httpsCallable(functions, 'wcipEmailPreferences')

async function requestPreferences(uid, data) {
  const account = auth.currentUser
  const checkAccount = () => {
    if (!uid || auth.currentUser?.uid !== uid)
      throw new DOMException('Account changed.', 'AbortError')
  }
  checkAccount()
  await syncUserProfile(account)
  checkAccount()
  const response = await preferences(data)
  checkAccount()
  return response.data
}

export const getEmailPreferences = (uid) => requestPreferences(uid, {})
export const saveEmailPreferences = (uid, subscribed) => requestPreferences(uid, { subscribed })
