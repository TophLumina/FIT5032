import { collection, doc, getDocFromServer, getDocsFromServer } from 'firebase/firestore'
import { db } from './firebase'

async function getCollection(name) {
  const snapshot = await getDocsFromServer(collection(db, name))
  return snapshot.docs.map((entry) => ({ ...entry.data(), slug: entry.id }))
}

export function getGuides() {
  return getCollection('guides')
}

async function getContent(name, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) return null
  const snapshot = await getDocFromServer(doc(db, name, slug))
  return snapshot.exists() ? { ...snapshot.data(), slug: snapshot.id } : null
}

export function getGuide(slug) {
  return getContent('guides', slug)
}
