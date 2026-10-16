import { HttpsError } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { keyFor } from './reporting.js'
import { siteDay } from './shared/siteDate.js'
import {
  createSeasonalGuide,
  emailText,
  previewDigest,
  guideContent,
  validateGuideContent,
} from './seasonalGuide.js'
import { guidePdf } from './guidePdf.js'
import { mailPayload } from './emailMessage.js'
import { signedIn } from './identity.js'

const maximumBatch = 10
const maximumAttempts = 3
const dailyLimit = 100
const locked = new Set(['accepted', 'processing', 'unknown'])
const validUid = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/')
function fields(data, allowed) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).some((key) => !allowed.includes(key))
  )
    throw new HttpsError('invalid-argument', 'Unexpected email request fields.')
}
function publicRecord(record, now) {
  if (!record) return { status: 'ready', message: 'Not sent this month.', attempts: 0 }
  const provider = record.provider || 'sendgrid'
  if (record.status === 'processing' && now.getTime() - record.startedAt.toMillis() > 180000)
    return {
      status: 'unknown',
      message:
        'An earlier attempt did not finish recording its result. Check the sending provider before taking further action; resending is blocked.',
      attempts: record.attempts,
      provider,
    }
  return { status: record.status, message: record.message, attempts: record.attempts, provider }
}

export function createSeasonalEmail({
  db,
  auth,
  plants,
  getSender,
  sendMail,
  now = () => new Date(),
}) {
  async function requireAdmin(request) {
    signedIn(request)
    const { uid, token } = request.auth
    let account
    try {
      account = await auth.getUser(uid)
    } catch (error) {
      if (error.code === 'auth/user-not-found')
        throw new HttpsError('unauthenticated', 'Your account no longer exists.')
      throw error
    }
    if (
      account.disabled ||
      !Number.isInteger(token.auth_time) ||
      token.auth_time <= 0 ||
      token.auth_time * 1000 > now().getTime() + 60000 ||
      token.auth_time < Math.floor(Date.parse(account.tokensValidAfterTime || 0) / 1000)
    )
      throw new HttpsError('unauthenticated', 'Your account session is no longer valid.')
    if ((await db.doc(`admins/${uid}`).get()).data()?.role !== 'admin')
      throw new HttpsError('permission-denied', 'Administrator access is required.')
    return uid
  }
  async function eligible(uid) {
    const profile = (await db.doc(`users/${uid}`).get()).data()
    if (profile?.seasonalEmailSubscribed !== true) return null
    try {
      const account = await auth.getUser(uid)
      return !account.disabled && account.email && account.email === profile.email
        ? { email: account.email, displayName: account.displayName || '' }
        : null
    } catch (error) {
      if (error.code === 'auth/user-not-found') return null
      throw error
    }
  }
  const deliveryRef = (issueId, uid) =>
    db.doc(`seasonalMailIssues/${issueId}/recipients/${keyFor(uid)}`)
  const draftRef = (issueId) => db.doc(`seasonalMailDrafts/${issueId}`)

  async function currentGuide() {
    const defaults = createSeasonalGuide(plants, now())
    const draft = (await draftRef(defaults.issueId).get()).data()
    return draft
      ? { ...defaults, ...validateGuideContent(draft.content), draftVersion: draft.version }
      : defaults
  }

  async function contentPreview(guide) {
    const sender = getSender()
    const pdf = await guidePdf(guide)
    return {
      guide,
      defaults: guideContent(createSeasonalGuide(plants, now())),
      sender,
      text: emailText(guide),
      digest: previewDigest(guide, sender),
      attachment: {
        filename: guide.filename,
        base64: pdf.toString('base64'),
        type: 'application/pdf',
      },
    }
  }

  async function saveDraft(request) {
    const adminUid = await requireAdmin(request)
    fields(request.data, ['issueId', 'draftVersion', 'content'])
    const { issueId, draftVersion, content } = request.data
    const defaults = createSeasonalGuide(plants, now())
    if (issueId !== defaults.issueId)
      throw new HttpsError(
        'failed-precondition',
        'The month has changed. Reload the current guide.',
      )
    if (!Number.isSafeInteger(draftVersion) || draftVersion < 0)
      throw new HttpsError('invalid-argument', 'A valid draft version is required.')
    const validated = validateGuideContent(content)
    const guide = { ...defaults, ...validated, draftVersion: draftVersion + 1 }
    // Generate the reviewable attachment before saving, so a rendering failure does not save a bad draft.
    const response = await contentPreview(guide)
    await requireAdmin(request)
    await db.runTransaction(async (tx) => {
      const [previous, role] = await tx.getAll(draftRef(issueId), db.doc(`admins/${adminUid}`))
      if (role.data()?.role !== 'admin')
        throw new HttpsError('permission-denied', 'Administrator access is required.')
      if ((previous.data()?.version || 0) !== draftVersion)
        throw new HttpsError(
          'failed-precondition',
          'Another administrator updated this draft. Reload before editing again.',
        )
      tx.set(draftRef(issueId), {
        content: validated,
        version: guide.draftVersion,
        updatedBy: adminUid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    return response
  }

  async function preview(request) {
    await requireAdmin(request)
    fields(request.data, [])
    const guide = await currentGuide()
    const snapshot = await db
      .collection('users')
      .where('seasonalEmailSubscribed', '==', true)
      .limit(501)
      .get()
    if (snapshot.size > 500)
      throw new HttpsError(
        'resource-exhausted',
        'The subscriber preview supports up to 500 subscribers. Add server pagination before expanding this mailing list.',
      )
    const accounts = new Map()
    for (let offset = 0; offset < snapshot.size; offset += 100) {
      const result = await auth.getUsers(
        snapshot.docs.slice(offset, offset + 100).map((doc) => ({ uid: doc.id })),
      )
      result.users.forEach((account) => accounts.set(account.uid, account))
    }
    const profiles = snapshot.docs.filter((doc) => {
      const account = accounts.get(doc.id)
      return account && !account.disabled && account.email && account.email === doc.data().email
    })
    const records = profiles.length
      ? await db.getAll(...profiles.map((doc) => deliveryRef(guide.issueId, doc.id)))
      : []
    const recipients = profiles
      .map((doc, index) => {
        const account = accounts.get(doc.id)
        const record = publicRecord(records[index].data(), now())
        return {
          uid: doc.id,
          email: account.email,
          displayName: account.displayName || '',
          ...record,
          selectable: !locked.has(record.status) && record.attempts < maximumAttempts,
        }
      })
      .sort((a, b) => a.email.localeCompare(b.email))
    const response = await contentPreview(guide)
    await requireAdmin(request)
    return {
      ...response,
      recipients,
      maximumBatch,
      dailyLimit,
    }
  }

  async function send(request) {
    const adminUid = await requireAdmin(request)
    fields(request.data, ['issueId', 'digest', 'recipientUids', 'requestId'])
    const { issueId, digest, recipientUids, requestId } = request.data
    if (
      !Array.isArray(recipientUids) ||
      !recipientUids.length ||
      recipientUids.length > maximumBatch ||
      recipientUids.some((uid) => !validUid(uid)) ||
      new Set(recipientUids).size !== recipientUids.length ||
      typeof requestId !== 'string' ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)
    )
      throw new HttpsError(
        'invalid-argument',
        'Choose 1 to 10 unique site users and a valid request ID.',
      )
    const guide = await currentGuide()
    const sender = getSender()
    if (issueId !== guide.issueId || digest !== previewDigest(guide, sender))
      throw new HttpsError(
        'failed-precondition',
        'The monthly guide or sender has changed. Reload and review the current preview.',
      )
    const pdf = await guidePdf(guide)
    const text = emailText(guide)
    const results = []
    for (const uid of recipientUids) {
      // Re-check the administrator and canonical recipient before every individual provider call.
      await requireAdmin(request)
      const recipient = await eligible(uid)
      if (!recipient) {
        results.push({
          uid,
          status: 'skipped',
          message: 'This account is no longer an active subscriber with a matching email address.',
          attempts: 0,
        })
        continue
      }
      const ref = deliveryRef(issueId, uid)
      const quotaRef = db.doc(`seasonalMailDays/${siteDay(now())}`)
      const claim = await db.runTransaction(async (tx) => {
        const [previous, quota, profile, role, draft] = await tx.getAll(
          ref,
          quotaRef,
          db.doc(`users/${uid}`),
          db.doc(`admins/${adminUid}`),
          draftRef(issueId),
        )
        if (role.data()?.role !== 'admin')
          throw new HttpsError('permission-denied', 'Administrator access is required.')
        if ((draft.data()?.version || 0) !== guide.draftVersion)
          throw new HttpsError(
            'failed-precondition',
            'The draft changed during sending. Reload to review the latest content and recorded results.',
          )
        const record = previous.data()
        if (
          record &&
          (locked.has(record.status) ||
            record.requestId === requestId ||
            record.attempts >= maximumAttempts)
        )
          return { claimed: false, ...publicRecord(record, now()) }
        if (
          profile.data()?.seasonalEmailSubscribed !== true ||
          profile.data()?.email !== recipient.email
        )
          return {
            claimed: false,
            status: 'skipped',
            message: 'Subscription or account email changed. Reload the subscriber list.',
            attempts: record?.attempts || 0,
          }
        if ((quota.data()?.attempts || 0) >= dailyLimit)
          return {
            claimed: false,
            status: 'limited',
            message:
              'The site daily limit of 100 email attempts has been reached. Try tomorrow (Melbourne time).',
            attempts: record?.attempts || 0,
          }
        const attempts = (record?.attempts || 0) + 1
        const history = [...(record?.history || [])]
        if (record)
          history.push({
            provider: record.provider || 'sendgrid',
            status: record.status,
            message: record.message || '',
            providerId: record.providerId || null,
            startedAt: record.startedAt,
            attempts: record.attempts,
          })
        tx.set(ref, {
          uid,
          email: recipient.email,
          adminUid,
          requestId,
          digest,
          subject: guide.subject,
          draftVersion: guide.draftVersion,
          attempts,
          provider: 'gmail',
          history: history.slice(-2),
          status: 'processing',
          message: 'Sending is in progress. Do not start another attempt.',
          startedAt: Timestamp.fromDate(now()),
          updatedAt: FieldValue.serverTimestamp(),
        })
        tx.set(quotaRef, { attempts: FieldValue.increment(1) }, { merge: true })
        tx.set(
          db.doc(`seasonalMailIssues/${issueId}`),
          { subject: guide.subject, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
        return { claimed: true, attempts }
      })
      if (!claim.claimed) {
        results.push({
          uid,
          status: claim.status,
          message: claim.message,
          attempts: claim.attempts,
          provider: claim.provider || 'gmail',
        })
        continue
      }
      let outcome
      try {
        await requireAdmin(request)
        const current = await eligible(uid)
        outcome =
          !current || current.email !== recipient.email
            ? {
                status: 'skipped',
                message:
                  'Subscription or account changed before sending. No provider request was made.',
              }
            : await sendMail(mailPayload({ sender, email: current.email, guide, text, pdf }))
      } catch {
        // A provider may have accepted before an exception. Preserve the claim, never guess that retrying is safe.
        outcome = {
          status: 'unknown',
          message:
            'The attempt could not be confirmed. Check the sending mailbox Sent folder before taking further action; resending is blocked.',
        }
      }
      outcome.provider = 'gmail'
      await ref.update({ ...outcome, updatedAt: FieldValue.serverTimestamp() })
      results.push({ uid, ...publicRecord({ ...outcome, attempts: claim.attempts }, now()) })
    }
    return { issueId, results }
  }
  return { preview, saveDraft, send }
}
