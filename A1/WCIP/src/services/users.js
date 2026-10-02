import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export function syncUserProfile(user) {
  if (!user?.email) return Promise.resolve()
  // Emails stay in an administrator-only directory, separate from public comments.
  return setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    displayName: user.displayName?.trim().slice(0, 30) || '',
    updatedAt: serverTimestamp(),
  })
}
