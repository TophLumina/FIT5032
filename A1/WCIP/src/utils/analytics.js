import { siteDay, siteDayRange } from './siteDate'

export function shiftDay(day, offset) {
  siteDayRange(day)
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function analyticsRange(from, to, today = siteDay()) {
  siteDayRange(from)
  siteDayRange(to)
  if (from > to) throw new Error('Start date must not be after end date.')
  if (to > today) throw new Error('End date must not be in the future.')
  const length = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
  if (length > 90) throw new Error('Choose a range of up to 90 days.')
  return { from, to, days: Array.from({ length }, (_, i) => shiftDay(from, i)) }
}

export function asDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null
  return date && Number.isFinite(date.getTime()) ? date : null
}

export function buildAnalytics(source, plants, range) {
  const names = new Map(plants.map((plant) => [plant.slug, plant.commonName]))
  const comments = source.comments.flatMap((comment) => {
    const match = /^discussions\/(plant|guide):([a-z0-9-]+)\/comments\/[^/]+$/.exec(comment.path)
    if (!match) return []
    const [, type, slug] = match
    const date = asDate(comment.createdAt)
    const rating =
      type === 'plant' &&
      Number.isInteger(comment.rating) &&
      comment.rating >= 1 &&
      comment.rating <= 5
        ? comment.rating
        : null
    return [
      {
        id: comment.path,
        uid: comment.authorUid || '',
        author: comment.author || 'Gardener',
        message: comment.message || '',
        day: date ? siteDay(date) : '',
        createdAt: date,
        rating,
        type,
        slug,
        contentKey: `${type}:${slug}`,
        content: names.get(slug) || slug.replaceAll('-', ' '),
        url: `/${type === 'plant' ? 'plants' : 'guides'}/${slug}`,
      },
    ]
  })
  const periodComments = comments.filter(
    (comment) => comment.day >= range.from && comment.day <= range.to,
  )
  const adminIds = new Set(
    source.roles.filter((role) => role.role === 'admin').map((role) => role.uid),
  )
  const userCounts = new Map()
  for (const comment of comments)
    userCounts.set(comment.uid, (userCounts.get(comment.uid) || 0) + 1)
  const users = source.profiles.map((profile) => ({
    uid: profile.uid,
    email: profile.email || '',
    displayName: profile.displayName || 'Gardener',
    role: adminIds.has(profile.uid) ? 'Administrator' : 'Gardener',
    commentCount: userCounts.get(profile.uid) || 0,
  }))
  const roleCounts = ['Administrator', 'Gardener'].map((role) => ({
    role,
    count: users.filter((user) => user.role === role).length,
  }))
  const trend = range.days.map((day) => ({
    day,
    visits: source.visits.find((entry) => entry.day === day)?.count ?? 0,
    comments: periodComments.filter((comment) => comment.day === day).length,
  }))
  const plantStats = plants.map((plant) => {
    const entries = periodComments.filter((comment) => comment.contentKey === `plant:${plant.slug}`)
    const ratings = entries.filter((comment) => comment.rating !== null)
    return {
      slug: plant.slug,
      name: plant.commonName,
      comments: entries.length,
      ratings: ratings.length,
      average: ratings.length
        ? ratings.reduce((sum, comment) => sum + comment.rating, 0) / ratings.length
        : null,
    }
  })
  const ratings = periodComments.filter((comment) => comment.rating !== null)
  return {
    users,
    roleCounts,
    comments: periodComments,
    plantStats,
    trend,
    totalVisits: source.totalVisits,
    periodVisits: trend.reduce((sum, day) => sum + day.visits, 0),
    currentComments: comments.length,
    undatedComments: comments.filter((comment) => !comment.day).length,
    periodRatings: ratings.length,
    averageRating: ratings.length
      ? ratings.reduce((sum, comment) => sum + comment.rating, 0) / ratings.length
      : null,
    trackingStartedAt: asDate(source.trackingStartedAt),
  }
}
