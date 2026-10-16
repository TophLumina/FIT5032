export const gmailSendScope = 'https://www.googleapis.com/auth/gmail.send'

export function gmailCredentials(value, expectedEmail) {
  let credentials
  try {
    credentials = JSON.parse(value)
  } catch {
    throw new Error('Gmail sender authorization is not configured. Reconnect the sending account.')
  }
  if (
    !credentials ||
    credentials.email !== expectedEmail ||
    typeof credentials.clientId !== 'string' ||
    !credentials.clientId.endsWith('.apps.googleusercontent.com') ||
    typeof credentials.clientSecret !== 'string' ||
    !credentials.clientSecret ||
    typeof credentials.refreshToken !== 'string' ||
    !credentials.refreshToken ||
    !Array.isArray(credentials.scopes) ||
    !credentials.scopes.includes(gmailSendScope)
  )
    throw new Error(
      'Gmail sender authorization does not match the configured sender. Reconnect the sending account.',
    )
  return credentials
}

export async function verifiedGmailIdentity(accessToken, expectedEmail, fetcher = fetch) {
  const response = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  })
  if (!response.ok)
    throw new Error('Gmail sender identity could not be verified. Reconnect the sending account.')
  const profile = await response.json()
  if (profile.email !== expectedEmail || profile.email_verified !== true)
    throw new Error(
      'Gmail authorization belongs to a different account. Reconnect the configured sender.',
    )
}

export async function gmailAccess(credentials, fetcher = fetch) {
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  })
  if (!response.ok)
    throw new Error(
      'Gmail authorization is unavailable or expired. Reconnect the sending account before retrying.',
    )
  const result = await response.json()
  if (
    typeof result.access_token !== 'string' ||
    !result.access_token ||
    (result.scope && !result.scope.split(' ').includes(gmailSendScope))
  )
    throw new Error('Gmail sending permission is missing. Reconnect the sending account.')
  await verifiedGmailIdentity(result.access_token, credentials.email, fetcher)
  return { token: result.access_token, expiresIn: Number(result.expires_in) || 0 }
}

export function createGmailSender({ getCredentials, fetcher = fetch, now = () => Date.now() }) {
  let cached
  return async (payload) => {
    const outcome = (status, message, providerId = null) => ({
      status,
      message,
      providerId,
      provider: 'gmail',
    })
    let token
    try {
      const secret = getCredentials()
      const credentials = gmailCredentials(secret, payload.senderEmail)
      if (
        !cached ||
        cached.secret !== secret ||
        cached.email !== payload.senderEmail ||
        cached.until <= now()
      ) {
        const access = await gmailAccess(credentials, fetcher)
        cached = {
          secret,
          email: payload.senderEmail,
          token: access.token,
          until: now() + Math.max(0, Math.min(300, access.expiresIn - 60)) * 1000,
        }
      }
      token = cached.token
    } catch {
      cached = undefined
      // No message request was made: a fresh explicit retry after reconnection is safe.
      return outcome(
        'rejected',
        'Gmail sender authorization could not be verified. Reconnect the sending account before retrying. No email was submitted.',
      )
    }
    try {
      const response = await fetcher(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: payload.raw }),
          signal: AbortSignal.timeout(10000),
          redirect: 'error',
        },
      )
      if (response.status === 200) {
        const result = await response.json()
        if (typeof result.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(result.id))
          return outcome(
            'accepted',
            'Gmail accepted this email. Recipient delivery is not confirmed; check the sending mailbox for any delivery failure notice.',
            result.id,
          )
      }
      if (response.status >= 400 && response.status < 500) {
        if (response.status === 401 || response.status === 403) cached = undefined
        return outcome(
          'rejected',
          response.status === 429
            ? 'Gmail sending limit reached. Wait before trying again.'
            : response.status === 401 || response.status === 403
              ? 'Gmail denied sending. Check the sender authorization, Gmail API access and mailbox sending limits.'
              : `Gmail rejected this request (HTTP ${response.status}). Check the sending account before retrying.`,
        )
      }
    } catch {
      // The message may already have been sent. Never retry this request automatically.
    }
    return outcome(
      'unknown',
      'Gmail acceptance could not be confirmed. Check the sending mailbox Sent folder before taking further action; automatic resending is blocked.',
    )
  }
}
