import { siteDay, siteDayRange } from './siteDate.js'

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
