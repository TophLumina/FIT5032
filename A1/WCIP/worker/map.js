import { checkParameters, insideBounds, parseMapQuery, recordLimit } from '../shared/mapQuery.js'
import { QueryError } from '../shared/plantQuery.js'

export class MapServiceError extends Error {
  constructor(message, status = 503) {
    super(message)
    this.status = status
  }
}

async function upstreamJson(url, ttl) {
  let response
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'WCIP/1.0 (+https://wcip-fit5032-e0aef.web.app/about)',
      },
      signal: AbortSignal.timeout(12000),
      cf: { cacheTtlByStatus: { '200-299': ttl, '400-599': 0 }, cacheEverything: true },
    })
  } catch {
    throw new MapServiceError('The map data provider is temporarily unavailable. Please try again.')
  }
  if (!response.ok)
    throw new MapServiceError(
      'The map data provider could not complete the request. Please try again.',
    )
  try {
    return await response.json()
  } catch {
    throw new MapServiceError('The map data provider returned an unreadable response.')
  }
}

export async function findPlaces(params) {
  checkParameters(params, ['q'])
  const q = (params.get('q') ?? '').trim()
  if (q.length < 2 || q.length > 80)
    throw new QueryError('Place search must contain 2–80 characters.')
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  // Restrict upstream matching before the result limit, then apply the study rectangle.
  url.search = new URLSearchParams({
    name: `${q.split(',')[0].trim()}, Victoria`,
    countryCode: 'AU',
    count: '100',
    language: 'en',
    format: 'json',
  })
  const result = await upstreamJson(url, 86400)
  if (result.results !== undefined && !Array.isArray(result.results))
    throw new MapServiceError('The place search returned an invalid response.')
  return {
    data: (result.results ?? [])
      .filter(
        (place) => place.country_code === 'AU' && insideBounds(place.longitude, place.latitude),
      )
      .slice(0, 10)
      .map((place) => ({
        id: place.id,
        name: place.name,
        region: [place.admin2, place.admin1].filter(Boolean).join(', '),
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    attribution: {
      provider: 'Open-Meteo / GeoNames',
      url: 'https://open-meteo.com/en/docs/geocoding-api',
      license: 'CC BY 4.0',
    },
  }
}

export async function findOccurrences(params, plants) {
  const { plant, bounds, yearFrom, yearTo } = parseMapQuery(params, plants)
  const matchUrl = new URL('https://api.gbif.org/v1/species/match')
  matchUrl.search = new URLSearchParams({
    name: plant.scientificName,
    kingdom: 'Plantae',
    strict: 'true',
  })
  const match = await upstreamJson(matchUrl, 604800)
  const taxonKey = match.acceptedUsageKey || match.usageKey
  if (
    match.matchType !== 'EXACT' ||
    match.kingdom !== 'Plantae' ||
    !['SPECIES', 'SUBSPECIES', 'VARIETY'].includes(match.rank) ||
    !Number.isSafeInteger(taxonKey)
  )
    throw new MapServiceError(
      'GBIF could not resolve this plant to an exact species. Try another plant.',
      422,
    )
  const query = new URLSearchParams({
    taxonKey: String(taxonKey),
    country: 'AU',
    hasCoordinate: 'true',
    hasGeospatialIssue: 'false',
    occurrenceStatus: 'PRESENT',
    decimalLongitude: `${bounds[0]},${bounds[2]}`,
    decimalLatitude: `${bounds[1]},${bounds[3]}`,
    year: `${yearFrom},${yearTo}`,
    limit: String(recordLimit),
    offset: '0',
  })
  const result = await upstreamJson(`https://api.gbif.org/v1/occurrence/search?${query}`, 900)
  if (!Array.isArray(result.results) || !Number.isSafeInteger(result.count) || result.count < 0)
    throw new MapServiceError('GBIF returned an invalid occurrence response.')
  const seen = new Set()
  const records = result.results
    .filter((record) => {
      if (
        !Number.isSafeInteger(record.key) ||
        seen.has(record.key) ||
        !insideBounds(record.decimalLongitude, record.decimalLatitude, bounds) ||
        !Number.isInteger(record.year) ||
        record.year < yearFrom ||
        record.year > yearTo ||
        record.occurrenceStatus === 'ABSENT'
      )
        return false
      seen.add(record.key)
      return true
    })
    .map((record) => ({
      id: String(record.key),
      scientificName: record.species || record.scientificName || plant.scientificName,
      latitude: record.decimalLatitude,
      longitude: record.decimalLongitude,
      year: record.year,
      eventDate: record.eventDate?.slice(0, 10) || String(record.year),
      locality: record.locality || record.municipality || 'Locality not supplied',
      basisOfRecord: record.basisOfRecord || 'Not supplied',
      dataset: record.datasetName || 'GBIF dataset',
      datasetUrl: /^[a-f0-9-]{36}$/i.test(record.datasetKey ?? '')
        ? `https://www.gbif.org/dataset/${record.datasetKey}`
        : null,
      license: record.license?.includes('/by-nc/')
        ? 'CC BY-NC 4.0'
        : record.license?.includes('/by/')
          ? 'CC BY 4.0'
          : record.license?.includes('/zero/')
            ? 'CC0 1.0'
            : 'See source record',
      uncertaintyMetres: Number.isFinite(record.coordinateUncertaintyInMeters)
        ? record.coordinateUncertaintyInMeters
        : null,
      generalized: Boolean(record.dataGeneralizations || record.informationWithheld),
      url: `https://www.gbif.org/occurrence/${record.key}`,
    }))
  return {
    data: records,
    meta: {
      total: result.count,
      returned: records.length,
      limit: recordLimit,
      truncated: result.count > result.results.length,
      excluded: result.results.length - records.length,
      bounds,
      yearFrom,
      yearTo,
      plant: plant.slug,
      commonName: plant.commonName,
      taxonKey,
      matchedName: match.canonicalName || match.scientificName,
      acceptedName: match.acceptedScientificName || match.scientificName,
      fetchedAt: new Date().toISOString(),
      sourceUrl: `https://api.gbif.org/v1/occurrence/search?${query}`,
    },
    attribution: {
      provider: 'GBIF and contributing datasets',
      url: 'https://www.gbif.org',
      note: 'Record licences vary; see each source record. Observations may be duplicated, approximate, cultivated or historical. Density shows loaded records, not plant abundance.',
    },
  }
}
