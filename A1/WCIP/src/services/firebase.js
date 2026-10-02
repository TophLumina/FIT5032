import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Public web configuration, identical to Week67/firebase_app/src/main.js.
const config = {
  apiKey: 'AIzaSyBSXXF3JVuxtvCD5fteR1ug1BRwZdiuEE8',
  authDomain: 'fit5032-e0aef.firebaseapp.com',
  projectId: 'fit5032-e0aef',
  storageBucket: 'fit5032-e0aef.firebasestorage.app',
  messagingSenderId: '162413777778',
  appId: '1:162413777778:web:88f2966dd6d5f8dce943eb',
}

const app = getApps().length ? getApp() : initializeApp(config)
// Email/password auth needs no popup resolver or third-party sign-in scripts.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
})
export const db = getFirestore(app)
