import { user } from './auth'
import { plantApiOrigin } from './plantApi'

const origin =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_WORKER === 'true'
    ? 'http://127.0.0.1:8787'
    : plantApiOrigin

export async function assistantStatus(signal) {
  const response = await fetch(`${origin}/api/assistant/status`, { signal })
  if (!response.ok) throw new Error('The AI assistant could not be reached.')
  return (await response.json()).available === true
}

export async function askAssistant(messages, plant, signal) {
  const account = user.value
  if (!account) throw new Error('Sign in to use the AI Garden Assistant.')
  const token = await account.getIdToken()
  if (signal.aborted || user.value?.uid !== account.uid)
    throw new DOMException('Conversation closed', 'AbortError')
  const response = await fetch(`${origin}/api/assistant/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, plant: plant || null }),
  })
  const body = await response.json()
  if (!response.ok)
    throw new Error(body.error?.message || 'The AI assistant could not answer. Please try again.')
  if (typeof body.answer !== 'string' || !Array.isArray(body.plants))
    throw new Error('The AI response could not be read.')
  return body
}
