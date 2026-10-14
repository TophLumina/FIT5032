import { selectRows } from './tableQuery.js'

export function label(value) {
  return String(value ?? '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
const labels = (values) => (values ?? []).map(label).join(' / ')

export const plantColumns = [
  { key: 'commonName', label: 'Common name' },
  { key: 'scientificName', label: 'Scientific name' },
  { key: 'status', label: 'Origin', format: label },
  { key: 'difficulty', label: 'Difficulty', format: label },
  { key: 'spaces', label: 'Spaces', format: labels },
  { key: 'sunlight', label: 'Sunlight', format: labels },
  { key: 'water', label: 'Water', format: label },
  { key: 'biodiversity', label: 'Wildlife benefits', format: labels },
]

export const plantFilters = [
  { key: 'space', field: 'spaces', name: 'Space', values: ['balcony', 'courtyard', 'school'] },
  {
    key: 'sunlight',
    field: 'sunlight',
    name: 'Sunlight',
    values: ['full-sun', 'part-shade', 'shade'],
  },
  {
    key: 'experience',
    field: 'difficulty',
    name: 'Difficulty',
    values: ['beginner', 'intermediate'],
  },
  {
    key: 'benefit',
    field: 'biodiversity',
    name: 'Biodiversity benefit',
    values: ['bees', 'birds', 'butterflies'],
  },
]

export const plantSorts = [
  'best',
  'name-asc',
  'name-desc',
  ...plantColumns.flatMap(({ key }) => [`${key}-asc`, `${key}-desc`]),
]

export function queryPlants(plants, choices = {}) {
  const matching = plants.filter((plant) =>
    plantFilters.every(
      ({ key, field }) =>
        !choices[key]?.length ||
        choices[key].some((value) => [plant[field]].flat().includes(value)),
    ),
  )
  const sort = choices.sort ?? 'best'
  const key = sort.slice(0, sort.lastIndexOf('-'))
  const result = selectRows(matching, plantColumns, {
    q: choices.q,
    filters: choices.columns,
    sort: key === 'name' ? 'commonName' : key,
    direction: sort.endsWith('-desc') ? 'desc' : 'asc',
  })
  return sort === 'best' ? result.sort((a, b) => Number(b.featured) - Number(a.featured)) : result
}

export class QueryError extends Error {}

// Strict API parsing: malformed queries fail visibly instead of returning misleading results.
export function parsePlantQuery(params) {
  if (params.toString().length > 2048)
    throw new QueryError('Query must not exceed 2048 characters.')
  const columnKeys = plantColumns.map(({ key }) => `column.${key}`)
  const allowed = new Set([
    'q',
    'sort',
    'page',
    'limit',
    ...plantFilters.map(({ key }) => key),
    ...columnKeys,
  ])
  for (const key of params.keys()) {
    if (!allowed.has(key)) throw new QueryError(`Unknown parameter: ${key}`)
    if (!plantFilters.some((filter) => filter.key === key) && params.getAll(key).length > 1)
      throw new QueryError(`Parameter may only occur once: ${key}`)
  }
  const text = (key) => {
    const value = (params.get(key) ?? '').trim()
    if (value.length > 100) throw new QueryError(`${key} must not exceed 100 characters.`)
    return value
  }
  const integer = (key, fallback, maximum) => {
    if (!params.has(key)) return fallback
    const raw = params.get(key)
    const value = Number(raw)
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(value) || value > maximum)
      throw new QueryError(`${key} must be an integer from 1 to ${maximum}.`)
    return value
  }
  const choices = { q: text('q'), sort: params.get('sort') ?? 'best', columns: {} }
  if (!plantSorts.includes(choices.sort))
    throw new QueryError('Unsupported sort. See /api/v1/openapi.json.')
  for (const filter of plantFilters) {
    const values = params
      .getAll(filter.key)
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
    const expanded = values.flatMap((value) =>
      filter.key === 'benefit' && value === 'pollinators' ? ['bees', 'butterflies'] : [value],
    )
    if (expanded.some((value) => !filter.values.includes(value)))
      throw new QueryError(`${filter.key} must contain: ${filter.values.join(', ')}.`)
    choices[filter.key] = [...new Set(expanded)]
  }
  for (const { key } of plantColumns) choices.columns[key] = text(`column.${key}`)
  return { ...choices, page: integer('page', 1, 100000), limit: integer('limit', 10, 100) }
}

export function paginatePlants(plants, choices) {
  const matching = queryPlants(plants, choices)
  const start = (choices.page - 1) * choices.limit
  return {
    data: matching.slice(start, start + choices.limit),
    meta: {
      total: matching.length,
      page: choices.page,
      limit: choices.limit,
      totalPages: Math.ceil(matching.length / choices.limit),
      hasNext: start + choices.limit < matching.length,
      hasPrevious: choices.page > 1 && matching.length > 0,
    },
  }
}
