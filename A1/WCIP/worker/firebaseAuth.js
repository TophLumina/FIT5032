import { importX509, jwtVerify } from 'jose'

const certificatesUrl =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
let certificates
let expiresAt = 0
let pending
const imported = new Map()

async function firebaseKey(header) {
  if (header.alg !== 'RS256' || typeof header.kid !== 'string')
    throw new Error('Invalid token header')
  if (!certificates || Date.now() >= expiresAt) {
    if (!pending)
      pending = (async () => {
        const response = await fetch(certificatesUrl, { signal: AbortSignal.timeout(5000) })
        if (!response.ok) throw new Error('Certificate service unavailable')
        const next = await response.json()
        const ttl = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] ?? 0)
        certificates = next
        imported.clear()
        expiresAt = Date.now() + Math.min(ttl, 21600) * 1000
      })().finally(() => {
        pending = null
      })
    await pending
  }
  if (!Object.hasOwn(certificates, header.kid)) throw new Error('Unknown signing key')
  if (!imported.has(header.kid))
    imported.set(header.kid, importX509(certificates[header.kid], 'RS256'))
  return imported.get(header.kid)
}

export async function verifyFirebaseToken(token, projectId, keyResolver = firebaseKey) {
  const { payload } = await jwtVerify(token, keyResolver, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    requiredClaims: ['sub', 'exp', 'iat', 'auth_time'],
  })
  const now = Math.floor(Date.now() / 1000)
  if (
    typeof payload.sub !== 'string' ||
    !payload.sub.length ||
    payload.sub.length > 128 ||
    !Number.isInteger(payload.iat) ||
    payload.iat > now ||
    !Number.isInteger(payload.auth_time) ||
    payload.auth_time > now ||
    !payload.firebase?.sign_in_provider ||
    payload.firebase.sign_in_provider === 'anonymous'
  )
    throw new Error('Invalid Firebase identity')
  return payload.sub
}
