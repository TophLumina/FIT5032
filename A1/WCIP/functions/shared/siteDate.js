export const siteTimezone = 'Australia/Melbourne'
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: siteTimezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function parts(date) {
  return Object.fromEntries(
    dateParts
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
}

export function siteDay(date = new Date()) {
  const { year, month, day } = parts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Resolve each midnight separately so daylight-saving days can have 23 or 25 hours.
function localMidnight(wallTime) {
  let instant = wallTime
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = parts(new Date(instant))
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant
    instant = wallTime - offset
  }
  return new Date(instant)
}

export function siteDayRange(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose a valid date.')
  const [year, month, date] = day.split('-').map(Number)
  const wallTime = Date.UTC(year, month - 1, date)
  if (new Date(wallTime).toISOString().slice(0, 10) !== day) throw new Error('Choose a valid date.')
  return { start: localMidnight(wallTime), end: localMidnight(wallTime + 86400000) }
}
