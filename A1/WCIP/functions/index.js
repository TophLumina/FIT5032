import { onCall, onRequest } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createBackend } from './backend.js'
import { projectDocument } from './reporting.js'
import { defineSecret } from 'firebase-functions/params'
import { createSeasonalEmail } from './seasonalEmail.js'
import { senderConfig } from './emailMessage.js'
import { createGmailSender } from './gmail.js'
import plants from './data/plants.json' with { type: 'json' }

initializeApp()
const db = getFirestore()
const backend = createBackend({ db, auth: getAuth(), plants })
const gmailCredentials = defineSecret('GMAIL_SENDER_CREDENTIALS')
const sendGmail = createGmailSender({ getCredentials: () => gmailCredentials.value() })
const seasonalEmail = createSeasonalEmail({
  db,
  auth: getAuth(),
  plants,
  getSender: () =>
    senderConfig(
      process.env.FUNCTIONS_EMULATOR === 'true'
        ? {
            MAIL_FROM_EMAIL: 'wcip@example.test',
            MAIL_FROM_NAME: 'WCIP (emulator)',
            MAIL_REPLY_TO_EMAIL: 'wcip@example.test',
          }
        : process.env,
    ),
  sendMail: async (payload) => {
    // Emulators must never access the real provider, even if local credentials are present.
    if (process.env.FUNCTIONS_EMULATOR === 'true')
      return {
        status: 'rejected',
        message: 'Real email delivery is disabled in the emulator.',
        providerId: null,
      }
    return sendGmail(payload)
  },
})
const options = {
  region: 'australia-southeast1',
  minInstances: 0,
  maxInstances: 2,
  memory: '256MiB',
  timeoutSeconds: 60,
}
const callableOptions = {
  ...options,
  invoker: 'public',
  cors: [
    'https://wcip-fit5032-e0aef.web.app',
    'https://wcip-fit5032-e0aef.firebaseapp.com',
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ],
}
export const wcipSyncUserActivity = onCall(callableOptions, backend.syncUserActivity)
export const wcipDashboard = onCall(callableOptions, backend.getDashboard)
export const wcipEmailPreferences = onCall(callableOptions, backend.emailPreferences)
export const wcipSeasonalEmailPreview = onCall(callableOptions, seasonalEmail.preview)
export const wcipSaveSeasonalEmailDraft = onCall(callableOptions, seasonalEmail.saveDraft)
export const wcipSendSeasonalEmail = onCall(
  { ...callableOptions, timeoutSeconds: 180, secrets: [gmailCredentials] },
  seasonalEmail.send,
)
export const wcipAggregateVisits = onDocumentWritten(
  { ...options, retry: true, document: 'visits/{visitId}' },
  (event) => projectDocument(db, `visits/${event.params.visitId}`),
)
export const wcipAggregateComments = onDocumentWritten(
  { ...options, retry: true, document: 'discussions/{contentKey}/comments/{commentId}' },
  (event) =>
    projectDocument(
      db,
      `discussions/${event.params.contentKey}/comments/${event.params.commentId}`,
    ),
)

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
