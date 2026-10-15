import { QueryError } from './plantQuery.js'

// Longitude/latitude rectangle for Melbourne and surrounds, not an administrative boundary.
export const mapExtent = [144.3, -38.5, 145.8, -37.3]
export const initialBounds = [144.75, -38.0, 145.35, -37.55]
export const recordLimit = 300
export const mapYear = () =>
  Number(
    new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric' }).format(
      new Date(),
    ),
  )

export function insideBounds(lon, lat, bounds = mapExtent) {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= bounds[0] &&
    lon <= bounds[2] &&
    lat >= bounds[1] &&
    lat <= bounds[3]
  )
}

export function clipBounds(bounds) {
  return [
    Math.max(bounds[0], mapExtent[0]),
    Math.max(bounds[1], mapExtent[1]),
    Math.min(bounds[2], mapExtent[2]),
    Math.min(bounds[3], mapExtent[3]),
  ].map((value) => Number(value.toFixed(5)))
}

export function checkParameters(params, allowed) {
  if (params.toString().length > 512)
    throw new QueryError('Map query must not exceed 512 characters.')
  for (const key of params.keys()) {
    if (!allowed.includes(key)) throw new QueryError(`Unknown parameter: ${key}`)
    if (params.getAll(key).length !== 1)
      throw new QueryError(`Parameter may only occur once: ${key}`)
  }
}

export function parseMapQuery(params, plants) {
  checkParameters(params, ['plant', 'bbox', 'yearFrom', 'yearTo'])
  const plant = plants.find((plant) => plant.slug === params.get('plant'))
  if (!plant) throw new QueryError('Choose a plant slug from /api/v1/plants.')
  const rawBounds = params.get('bbox')?.split(',')
  const bounds = rawBounds?.map(Number) ?? initialBounds
  if (
    bounds.length !== 4 ||
    rawBounds?.some((value) => !value.trim()) ||
    bounds.some((value) => !Number.isFinite(value)) ||
    bounds[0] >= bounds[2] ||
    bounds[1] >= bounds[3] ||
    !insideBounds(bounds[0], bounds[1]) ||
    !insideBounds(bounds[2], bounds[3])
  )
    throw new QueryError('bbox must be west,south,east,north within 144.3,-38.5,145.8,-37.3.')
  const year = (key, fallback) => {
    const raw = params.get(key) ?? String(fallback)
    const value = Number(raw)
    if (!/^\d{4}$/.test(raw) || value < 1800 || value > mapYear())
      throw new QueryError(`${key} must be a year from 1800 to ${mapYear()}.`)
    return value
  }
  const yearFrom = year('yearFrom', 2000)
  const yearTo = year('yearTo', mapYear())
  if (yearFrom > yearTo) throw new QueryError('Start year must not be later than end year.')
  return { plant, bounds: bounds.map((value) => Number(value.toFixed(5))), yearFrom, yearTo }
}

// Fixed approximately 1 km cells at Melbourne's latitude. Counts are for loaded records only.
export function densityCells(records) {
  const cells = new Map()
  for (const record of records) {
    const x = Math.floor(record.longitude / 0.0125)
    const y = Math.floor(record.latitude / 0.01)
    const key = `${x}:${y}`
    const cell = cells.get(key) ?? {
      key,
      count: 0,
      bounds: [x * 0.0125, y * 0.01, (x + 1) * 0.0125, (y + 1) * 0.01],
    }
    cell.count++
    cells.set(key, cell)
  }
  return [...cells.values()]
}
