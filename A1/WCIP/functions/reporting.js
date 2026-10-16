import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { siteDay } from './shared/siteDate.js'

export const keyFor = (value) => createHash('sha256').update(value).digest('hex')
export function asDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null
  return date && Number.isFinite(date.getTime()) ? date : null
}
export const iso = (value) => asDate(value)?.toISOString() ?? null

export function contribution(path, data) {
  if (!data) return null
  if (/^visits\/[^/]+$/.test(path)) {
    const date = asDate(data.visitedAt)
    return { kind: 'visit', day: date ? siteDay(date) : '' }
  }
  const match = /^discussions\/(plant|guide):([a-z0-9-]+)\/comments\/[^/]+$/.exec(path)
  if (!match) return null
  const [, type, slug] = match
  const date = asDate(data.createdAt)
  return {
    kind: 'comment',
    type,
    slug,
    day: date ? siteDay(date) : '',
    uid: typeof data.authorUid === 'string' ? data.authorUid : '',
    rating:
      type === 'plant' && Number.isInteger(data.rating) && data.rating >= 1 && data.rating <= 5
        ? data.rating
        : null,
  }
}

// Read the current source inside the transaction, not the event's older snapshot.
// A per-source projection makes retries, out-of-order events and backfill idempotent.
export async function projectDocument(db, path) {
  if (
    !/^visits\/[^/]+$/.test(path) &&
    !/^discussions\/(plant|guide):[a-z0-9-]+\/comments\/[^/]+$/.test(path)
  )
    return
  const id = keyFor(path)
  const ledger = db.doc(`analyticsEntries/${id}`)
  await db.runTransaction(async (tx) => {
    const [source, previous] = await tx.getAll(db.doc(path), ledger)
    const before = previous.data()?.contribution ?? null
    const after = contribution(path, source.data())
    const version = source.updateTime
      ? `${source.updateTime.seconds}:${source.updateTime.nanoseconds}`
      : null
    if (previous.data()?.version === version && JSON.stringify(before) === JSON.stringify(after))
      return
    const deltas = new Map()
    function add(target, field, amount) {
      const fields = deltas.get(target) ?? {}
      fields[field] = (fields[field] ?? 0) + amount
      deltas.set(target, fields)
    }
    for (const [entry, sign] of [
      [before, -1],
      [after, 1],
    ]) {
      if (!entry) continue
      if (entry.kind === 'visit') {
        add('analyticsTotals/current', 'totalVisits', sign)
        if (entry.day) add(`analyticsDays/${entry.day}`, 'visits', sign)
        continue
      }
      add('analyticsTotals/current', 'currentComments', sign)
      if (!entry.day) add('analyticsTotals/current', 'undatedComments', sign)
      if (entry.uid) add(`analyticsUserStats/${keyFor(entry.uid)}`, 'commentCount', sign)
      if (!entry.day) continue
      const daily = `analyticsDays/${entry.day}`
      add(daily, 'comments', sign)
      if (entry.type === 'plant') {
        add(daily, `plants.${entry.slug}.comments`, sign)
        if (entry.rating !== null) {
          add(daily, 'ratings', sign)
          add(daily, 'ratingSum', sign * entry.rating)
          add(daily, `plants.${entry.slug}.ratings`, sign)
          add(daily, `plants.${entry.slug}.ratingSum`, sign * entry.rating)
        }
      }
    }
    for (const [target, fields] of deltas) {
      const patch = {}
      for (const [field, amount] of Object.entries(fields)) {
        if (!amount) continue
        const parts = field.split('.')
        let node = patch
        for (const part of parts.slice(0, -1)) node = node[part] ??= {}
        node[parts.at(-1)] = FieldValue.increment(amount)
      }
      if (Object.keys(patch).length) tx.set(db.doc(target), patch, { merge: true })
    }
    const detail = db.doc(`analyticsComments/${id}`)
    if (after?.kind === 'comment') {
      const data = source.data()
      tx.set(detail, {
        ...after,
        path,
        author: data.author || 'Gardener',
        message: data.message || '',
        createdAt: iso(data.createdAt),
      })
    } else if (before?.kind === 'comment') tx.delete(detail)
    if (after) tx.set(ledger, { path, version, contribution: after })
    else tx.delete(ledger)
  })
}

export function buildReport({
  range,
  days,
  totals,
  profiles,
  roles,
  userStats,
  comments,
  config,
  plants,
}) {
  const adminIds = new Set(roles.filter((role) => role.role === 'admin').map((role) => role.uid))
  const users = profiles.map((profile) => ({
    uid: profile.uid,
    email: profile.email || '',
    displayName: profile.displayName || 'Gardener',
    role: adminIds.has(profile.uid) ? 'Administrator' : 'Gardener',
    commentCount: userStats.get(profile.uid)?.commentCount ?? 0,
    lastLoginAt: iso(profile.lastLoginAt),
    seasonalEmailSubscribed: profile.seasonalEmailSubscribed === true,
  }))
  const trend = range.days.map((day) => ({
    day,
    visits: days.get(day)?.visits ?? 0,
    comments: days.get(day)?.comments ?? 0,
    logins: days.get(day)?.logins ?? 0,
    loginUsers: days.get(day)?.loginUsers ?? 0,
  }))
  const plantStats = plants.map(({ slug, commonName: name }) => {
    const stats = { slug, name, comments: 0, ratings: 0, ratingSum: 0 }
    for (const day of range.days) {
      const source = days.get(day)?.plants?.[slug]
      for (const key of ['comments', 'ratings', 'ratingSum']) stats[key] += source?.[key] ?? 0
    }
    return { ...stats, average: stats.ratings ? stats.ratingSum / stats.ratings : null }
  })
  const periodRatings = range.days.reduce((sum, day) => sum + (days.get(day)?.ratings ?? 0), 0)
  const ratingSum = range.days.reduce((sum, day) => sum + (days.get(day)?.ratingSum ?? 0), 0)
  const names = new Map(plants.map((plant) => [plant.slug, plant.commonName]))
  return {
    users,
    roleCounts: ['Administrator', 'Gardener'].map((role) => ({
      role,
      count: users.filter((user) => user.role === role).length,
    })),
    comments: comments.map((entry) => ({
      ...entry,
      id: entry.path,
      contentKey: `${entry.type}:${entry.slug}`,
      content: names.get(entry.slug) || entry.slug.replaceAll('-', ' '),
      url: `/${entry.type === 'plant' ? 'plants' : 'guides'}/${entry.slug}`,
    })),
    plantStats,
    trend,
    totalVisits: totals.totalVisits ?? 0,
    periodVisits: trend.reduce((sum, day) => sum + day.visits, 0),
    periodComments: trend.reduce((sum, day) => sum + day.comments, 0),
    periodLogins: trend.reduce((sum, day) => sum + day.logins, 0),
    currentComments: totals.currentComments ?? 0,
    undatedComments: totals.undatedComments ?? 0,
    periodRatings,
    averageRating: periodRatings ? ratingSum / periodRatings : null,
    trackingStartedAt: iso(config.trackingStartedAt),
    loginTrackingStartedAt: iso(config.loginTrackingStartedAt),
  }
}
