import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  connectAuthEmulator,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

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
// Email/password auth needs no popup resolver or third-party sign-in scripts.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
})
export const db = getFirestore(app)
if (localEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
