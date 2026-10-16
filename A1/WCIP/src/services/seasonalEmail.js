import { httpsCallable } from 'firebase/functions'
import { auth, functions } from './firebase'
import { syncUserProfile } from './users'

const preview = httpsCallable(functions, 'wcipSeasonalEmailPreview')
const saveDraft = httpsCallable(functions, 'wcipSaveSeasonalEmailDraft')
const send = httpsCallable(functions, 'wcipSendSeasonalEmail', { timeout: 210000 })

async function request(call, data) {
  const account = auth.currentUser
  const check = () => {
    if (!account || auth.currentUser?.uid !== account.uid)
      throw new DOMException('Account changed.', 'AbortError')
  }
  check()
  await syncUserProfile(account)
  check()
  const response = await call(data)
  check()
  return response.data
}

export const previewSeasonalEmail = () => request(preview, {})
export const saveSeasonalEmailDraft = (data) => request(saveDraft, data)
export const sendSeasonalEmail = (data) => request(send, data)

export function downloadGuide(attachment) {
  const bytes = Uint8Array.from(atob(attachment.base64), (character) => character.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
