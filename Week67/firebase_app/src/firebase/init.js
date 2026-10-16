import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// This exercise runs locally only. Never connect it to the WCIP production project.
const app = initializeApp({
  apiKey: 'demo-week67-key',
  authDomain: 'demo-week67.firebaseapp.com',
  projectId: 'demo-week67',
})
const auth = getAuth(app)
const db = getFirestore(app)

// Keep these ports separate from WCIP's demo-wcip emulators (9099 / 8080).
// With the emulators stopped, requests fail locally; there is no cloud fallback.
connectAuthEmulator(auth, 'http://127.0.0.1:9098')
connectFirestoreEmulator(db, '127.0.0.1', 8088)

export default db
