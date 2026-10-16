import { HttpsError } from 'firebase-functions/v2/https'

export function signedIn(request) {
  if (
    !request.auth ||
    !['password', 'google.com'].includes(request.auth.token.firebase?.sign_in_provider)
  )
    throw new HttpsError('unauthenticated', 'Sign in with your WCIP account.')
  return request.auth.uid
}
