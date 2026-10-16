import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
  connectAuthEmulator,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

// WCIP production configuration. Course exercises use separate local emulators.
const config = {
  apiKey: 'AIzaSyBSXXF3JVuxtvCD5fteR1ug1BRwZdiuEE8',
  authDomain: 'fit5032-e0aef.firebaseapp.com',
  projectId: 'fit5032-e0aef',
  storageBucket: 'fit5032-e0aef.firebasestorage.app',
  messagingSenderId: '162413777778',
  appId: '1:162413777778:web:88f2966dd6d5f8dce943eb',
}

// Production builds always use the live project.
const localEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true'
const app = getApps().length
  ? getApp()
  : initializeApp(
      localEmulators
        ? {
            ...config,
            projectId: 'demo-wcip',
            apiKey: 'demo-key',
            authDomain: 'demo-wcip.firebaseapp.com',
          }
        : config,
    )
// Firebase handles the Google OAuth popup and keeps provider credentials out of app storage.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
})
export const db = getFirestore(app)
export const functions = getFunctions(app, 'australia-southeast1')
if (localEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
