import { HttpsError } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { analyticsRange } from './shared/range.js'
import { siteDay } from './shared/siteDate.js'
import { asDate, buildReport, keyFor } from './reporting.js'
import { signedIn } from './identity.js'
function input(request, keys = []) {
  if (
    !request.data ||
    typeof request.data !== 'object' ||
    Array.isArray(request.data) ||
    Object.keys(request.data).some((key) => !keys.includes(key))
  )
    throw new HttpsError('invalid-argument', 'Unexpected request fields.')
}

export function createBackend({ db, auth, plants, now = () => new Date() }) {
  async function requireAdmin(request) {
    const uid = signedIn(request)
    if ((await db.doc(`admins/${uid}`).get()).data()?.role !== 'admin')
      throw new HttpsError('permission-denied', 'Administrator access is required.')
    return uid
  }
  async function syncUserActivity(request) {
    const uid = signedIn(request)
    input(request)
    const authTime = request.auth.token.auth_time
    const instant = now()
    if (!Number.isInteger(authTime) || authTime <= 0 || authTime * 1000 > instant.getTime() + 60000)
      throw new HttpsError('unauthenticated', 'A valid authentication time is required.')
    const authenticatedAt = Timestamp.fromMillis(authTime * 1000)
    const day = siteDay(authenticatedAt.toDate())
    const profileRef = db.doc(`users/${uid}`)
    const configRef = db.doc('status/config')
    const eventRef = db.doc(`loginEvents/${keyFor(`${uid}:${authTime}`)}`)
    const dayUserRef = db.doc(`loginDays/${day}/users/${keyFor(uid)}`)
    return db.runTransaction(async (tx) => {
      const [profile, config, event, dayUser] = await tx.getAll(
        profileRef,
        configRef,
        eventRef,
        dayUserRef,
      )
      // Fetch canonical account data on each transaction attempt; never trust client profile fields.
      const account = await auth.getUser(uid)
      if (
        account.disabled ||
        !account.email ||
        authTime < Math.floor(Date.parse(account.tokensValidAfterTime || 0) / 1000)
      )
        throw new HttpsError('unauthenticated', 'Your account session is no longer valid.')
      const loginStart = config.data()?.loginTrackingStartedAt ?? Timestamp.fromDate(instant)
      if (!config.data()?.loginTrackingStartedAt)
        tx.set(configRef, { loginTrackingStartedAt: loginStart }, { merge: true })
      const lastLoginAt = new Date(
        Math.max(
          authTime * 1000,
          Date.parse(account.metadata.lastSignInTime) || 0,
          asDate(profile.data()?.lastLoginAt)?.getTime() || 0,
        ),
      )
      const canonical = {
        email: account.email,
        displayName: (account.displayName || '').trim().slice(0, 30),
        lastLoginAt: Timestamp.fromDate(lastLoginAt),
        // Consent is opt-in and belongs to the email address the user subscribed with.
        seasonalEmailSubscribed:
          profile.data()?.email === account.email &&
          profile.data()?.seasonalEmailSubscribed === true,
      }
      if (
        !profile.exists ||
        profile.data().email !== canonical.email ||
        profile.data().displayName !== canonical.displayName ||
        profile.data().seasonalEmailSubscribed !== canonical.seasonalEmailSubscribed ||
        asDate(profile.data().lastLoginAt)?.getTime() !== lastLoginAt.getTime()
      ) {
        tx.set(
          profileRef,
          {
            ...canonical,
            ...(profile.data()?.seasonalEmailSubscribed === true &&
            !canonical.seasonalEmailSubscribed
              ? { seasonalEmailUpdatedAt: FieldValue.serverTimestamp() }
              : {}),
            createdAt: Timestamp.fromDate(new Date(account.metadata.creationTime)),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      }
      const recordLogin = !event.exists && authTime >= Math.floor(loginStart.toMillis() / 1000)
      if (recordLogin) {
        tx.create(eventRef, { uid, authenticatedAt, recordedAt: FieldValue.serverTimestamp() })
        if (!dayUser.exists) tx.create(dayUserRef, { uid })
        tx.set(
          db.doc(`analyticsDays/${day}`),
          {
            logins: FieldValue.increment(1),
            loginUsers: FieldValue.increment(dayUser.exists ? 0 : 1),
          },
          { merge: true },
        )
      }
      return { synced: true, loginRecorded: recordLogin }
    })
  }
  async function emailPreferences(request) {
    const uid = signedIn(request)
    input(request, ['subscribed'])
    const updating = Object.hasOwn(request.data, 'subscribed')
    if (updating && typeof request.data.subscribed !== 'boolean')
      throw new HttpsError('invalid-argument', 'Subscription must be true or false.')
    return db.runTransaction(async (tx) => {
      const profileRef = db.doc(`users/${uid}`)
      const profile = (await tx.get(profileRef)).data()
      const account = await auth.getUser(uid)
      const authTime = request.auth.token.auth_time
      if (
        account.disabled ||
        !account.email ||
        !Number.isInteger(authTime) ||
        authTime * 1000 > now().getTime() + 60000 ||
        authTime < Math.floor(Date.parse(account.tokensValidAfterTime || 0) / 1000)
      )
        throw new HttpsError('unauthenticated', 'Your account session is no longer valid.')
      if (!profile || profile.email !== account.email)
        throw new HttpsError('failed-precondition', 'Sign in again to synchronize your account.')
      const subscribed = profile.seasonalEmailSubscribed === true
      let updatedAt = asDate(profile.seasonalEmailUpdatedAt)?.toISOString() ?? null
      if (updating && profile.seasonalEmailSubscribed !== request.data.subscribed) {
        const timestamp = Timestamp.fromDate(now())
        tx.update(profileRef, {
          seasonalEmailSubscribed: request.data.subscribed,
          seasonalEmailUpdatedAt: timestamp,
        })
        updatedAt = timestamp.toDate().toISOString()
      }
      return {
        subscribed: updating ? request.data.subscribed : subscribed,
        email: account.email,
        updatedAt,
      }
    })
  }
  async function bounded(query, maximum, label) {
    const result = await query.limit(maximum + 1).get()
    if (result.size > maximum)
      throw new HttpsError(
        'resource-exhausted',
        `${label} exceed the report detail limit. Choose a smaller date range or use a paginated report.`,
      )
    return result.docs
  }
  async function getDashboard(request) {
    await requireAdmin(request)
    input(request, ['from', 'to'])
    let range
    try {
      range = analyticsRange(request.data.from, request.data.to, siteDay(now()))
    } catch (error) {
      throw new HttpsError('invalid-argument', error.message)
    }
    const config = await db.doc('status/config').get()
    if (!config.data()?.analyticsReady)
      throw new HttpsError(
        'failed-precondition',
        'Statistics are being prepared. Please retry shortly.',
      )
    const [total, daily, profiles, roles, comments] = await Promise.all([
      db.doc('analyticsTotals/current').get(),
      db.getAll(...range.days.map((day) => db.doc(`analyticsDays/${day}`))),
      bounded(db.collection('users'), 2000, 'User profiles'),
      bounded(db.collection('admins'), 2000, 'Administrator roles'),
      bounded(
        db
          .collection('analyticsComments')
          .where('day', '>=', range.from)
          .where('day', '<=', range.to),
        5000,
        'Comments in this date range',
      ),
    ])
    const userStats = profiles.length
      ? await db.getAll(
          ...profiles.map((profile) => db.doc(`analyticsUserStats/${keyFor(profile.id)}`)),
        )
      : []
    await requireAdmin(request)
    return buildReport({
      range,
      days: new Map(daily.map((entry) => [entry.id, entry.data()])),
      totals: total.data() ?? {},
      profiles: profiles.map((entry) => ({ ...entry.data(), uid: entry.id })),
      roles: roles.map((entry) => ({ ...entry.data(), uid: entry.id })),
      userStats: new Map(profiles.map((entry, i) => [entry.id, userStats[i].data()])),
      comments: comments.map((entry) => entry.data()),
      config: config.data(),
      plants,
    })
  }
  return { syncUserActivity, getDashboard, emailPreferences }
}
