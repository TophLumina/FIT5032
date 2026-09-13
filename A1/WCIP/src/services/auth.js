import { readonly, shallowRef } from 'vue'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase'
import { syncUserProfile } from './users'

const currentUser = shallowRef(null)
const ready = shallowRef(false)
const admin = shallowRef(false)
const roleError = shallowRef('')
const roleReady = shallowRef(false)
const profileError = shallowRef('')
let unsubscribeRole = () => {}
export const user = readonly(currentUser)
export const authReady = readonly(ready)
export const isAdmin = readonly(admin)
export const adminRoleError = readonly(roleError)
export const adminRoleReady = readonly(roleReady)
export const userProfileError = readonly(profileError)

export async function waitForAdminRole() {
  await authInitialized
  const uid = auth.currentUser?.uid
  if (!uid) return false
  if (roleReady.value) return admin.value
  try {
    const snapshot = await getDocFromServer(doc(db, 'admins', uid))
    if (auth.currentUser?.uid !== uid) return false
    admin.value = snapshot.data()?.role === 'admin'
    roleReady.value = true
    return admin.value
  } catch {
    if (auth.currentUser?.uid === uid) {
      admin.value = false
      roleReady.value = true
      roleError.value = 'Account permissions could not be checked. Refresh to try again.'
    }
    return false
  }
}

function updateUserDirectory(value) {
  profileError.value = ''
  if (!value) return
  syncUserProfile(value).catch(() => {
    if (auth.currentUser?.uid === value.uid) {
      profileError.value = 'Your account information could not be synced. Sign in again to retry.'
    }
  })
}

function observeRole(value) {
  unsubscribeRole()
  admin.value = false
  roleReady.value = !value
  roleError.value = ''
  if (!value) return
  unsubscribeRole = onSnapshot(
    doc(db, 'admins', value.uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (auth.currentUser?.uid !== value.uid) return
      admin.value = !snapshot.metadata.fromCache && snapshot.data()?.role === 'admin'
      roleReady.value = !snapshot.metadata.fromCache
      roleError.value = ''
    },
    () => {
      if (auth.currentUser?.uid !== value.uid) return
      admin.value = false
      roleReady.value = true
      roleError.value = 'Account permissions could not be checked. Refresh to try again.'
    },
  )
}

// Firebase owns session persistence and token refresh. Wait before checking protected routes.
export const authInitialized = new Promise((resolve) => {
  onAuthStateChanged(
    auth,
    (value) => {
      currentUser.value = value
      observeRole(value)
      updateUserDirectory(value)
      ready.value = true
      resolve()
    },
    () => {
      currentUser.value = null
      observeRole(null)
      updateUserDirectory(null)
      ready.value = true
      resolve()
    },
  )
})

export async function login(email, password) {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password)
  currentUser.value = result.user
}

export async function register(displayName, email, password) {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password)
  // Account creation has already succeeded if updating the optional display name fails.
  let profileSaved = true
  try {
    await updateProfile(result.user, { displayName: displayName.trim() })
  } catch {
    profileSaved = false
  }
  currentUser.value = result.user
  updateUserDirectory(result.user)
  return profileSaved
}

export async function logout() {
  await signOut(auth)
  currentUser.value = null
  observeRole(null)
}

export function authErrorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'Unable to create this account. Try signing in instead.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/password-does-not-meet-requirements':
      'Your password does not meet the account password policy.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/network-request-failed': 'Could not connect. Check your connection and try again.',
    'auth/user-disabled': 'This account is unavailable.',
    'auth/operation-not-allowed': 'Email sign-in is currently unavailable.',
  }
  return messages[error?.code] ?? 'Unable to complete the request. Please try again.'
}
