import { onRequest } from 'firebase-functions/v2/https'

// Infrastructure smoke check. Business endpoints will be added in later stages.
// This endpoint does not read account data, accept uploads, or write to Firestore.
export const wcipHealth = onRequest(
  {
    region: 'australia-southeast1',
    minInstances: 0,
    maxInstances: 2,
    memory: '256MiB',
    timeoutSeconds: 15,
    invoker: 'public',
    cors: false,
  },
  (request, response) => {
    response.set('Cache-Control', 'no-store')
    response.set('X-Content-Type-Options', 'nosniff')

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.set('Allow', 'GET, HEAD')
      response.status(405).json({ error: 'Method not allowed' })
      return
    }

    response.status(200).json({
      service: 'wcip',
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  },
)
