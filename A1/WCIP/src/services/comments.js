import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'

function commentsCollection(contentKey) {
  return collection(db, 'discussions', contentKey, 'comments')
}

function validateComment(message, rating, contentKey) {
  const text = message.trim()
  if (text.length < 10 || text.length > 300) {
    throw new Error('Comment must contain 10–300 characters.')
  }
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error('Choose a rating from 1 to 5, or leave it unrated.')
  }
  if (!contentKey.startsWith('plant:') && rating !== null) {
    throw new Error('Ratings are available for plants only.')
  }
  return text
}

export function subscribeToComments(contentKey, onChange, onError) {
  return onSnapshot(
    query(commentsCollection(contentKey), orderBy('createdAt', 'desc')),
    { includeMetadataChanges: true },
    (snapshot) =>
      onChange({
        comments: snapshot.docs.map((entry) => ({
          ...entry.data(),
          id: entry.id,
          pending: entry.metadata.hasPendingWrites,
        })),
        fromCache: snapshot.metadata.fromCache,
        pending: snapshot.metadata.hasPendingWrites,
      }),
    onError,
  )
}

export async function addComment(contentKey, message, rating) {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('Sign in before adding a comment.')
  const text = validateComment(message, rating, contentKey)
  await addDoc(commentsCollection(contentKey), {
    authorUid: currentUser.uid,
    author: currentUser.displayName?.trim().slice(0, 30) || 'Gardener',
    message: text,
    rating,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Firestore Rules check administrator status independently of the buttons in the browser.
export async function editComment(contentKey, id, message, rating) {
  const text = validateComment(message, rating, contentKey)
  await updateDoc(doc(commentsCollection(contentKey), id), {
    message: text,
    rating,
    updatedAt: serverTimestamp(),
  })
}

export async function removeComment(contentKey, id) {
  await deleteDoc(doc(commentsCollection(contentKey), id))
}
