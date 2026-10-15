// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../worker/index.js'
import plants from '../public/data/plants.json'
import { densityCells, parseMapQuery } from '../shared/mapQuery.js'

afterEach(() => vi.unstubAllGlobals())
const exactMatch = {
  usageKey: 7296375,
  scientificName: 'Viola hederacea Labill.',
  canonicalName: 'Viola hederacea',
  matchType: 'EXACT',
  kingdom: 'Plantae',
  rank: 'SPECIES',
}
const record = {
  key: 12345,
  decimalLatitude: -37.81,
  decimalLongitude: 144.97,
  species: 'Viola hederacea',
  year: 2024,
  eventDate: '2024-04-05T10:00:00',
  occurrenceStatus: 'PRESENT',
  datasetName: 'Example public observations',
  datasetKey: '50c9509d-22c7-4a22-a47d-8c48425ef4a7',
  license: 'http://creativecommons.org/licenses/by/4.0/legalcode',
  coordinateUncertaintyInMeters: 50,
  basisOfRecord: 'HUMAN_OBSERVATION',
}
const request = (path) => worker.fetch(new Request('https://example.test' + path))
function provider(...bodies) {
  const mock = vi.fn()
  bodies.forEach((body) => mock.mockResolvedValueOnce(Response.json(body)))
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('Melbourne observation API', () => {
  it('makes bounded real-data queries, exposes provenance and explicitly marks a capped subset', async () => {
    const mock = provider(exactMatch, { count: 350, results: [record] })
    const response = await request(
      '/api/v1/map/occurrences?plant=native-violet&yearFrom=2020&yearTo=2025',
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.meta).toMatchObject({
      total: 350,
      returned: 1,
      limit: 300,
      truncated: true,
      yearFrom: 2020,
      yearTo: 2025,
      taxonKey: 7296375,
    })
    expect(body.data[0]).toMatchObject({
      id: '12345',
      uncertaintyMetres: 50,
      license: 'CC BY 4.0',
      url: 'https://www.gbif.org/occurrence/12345',
    })
    expect(body.data[0].datasetUrl).toContain('/dataset/')
    expect(body.data[0]).not.toHaveProperty('recordedBy')
    const query = new URL(mock.mock.calls[1][0]).searchParams
    expect(query.get('country')).toBe('AU')
    expect(query.get('hasGeospatialIssue')).toBe('false')
    expect(query.get('occurrenceStatus')).toBe('PRESENT')
    expect(query.get('limit')).toBe('300')
    expect(query.get('decimalLongitude')).toBe('144.75,145.35')
    expect(response.headers.get('cache-control')).toBe('public, max-age=900')
    expect(mock.mock.calls[1][1].cf.cacheTtlByStatus['400-599']).toBe(0)
  })

  it('excludes unusable/out-of-area/absent records and repeated IDs without inventing observations', async () => {
    provider(exactMatch, {
      count: 6,
      results: [
        record,
        record,
        { ...record, key: 2, decimalLatitude: -33 },
        { ...record, key: 3, year: 1700 },
        { ...record, key: 4, occurrenceStatus: 'ABSENT' },
        { ...record, key: 5, decimalLongitude: null },
      ],
    })
    const body = await (await request('/api/v1/map/occurrences?plant=native-violet')).json()
    expect(body.data).toHaveLength(1)
    expect(body.meta).toMatchObject({ total: 6, returned: 1, excluded: 5, truncated: false })
  })

  it.each([
    'plant=unknown',
    'plant=native-violet&bbox=1,2,3,4',
    'plant=native-violet&bbox=144.9,,145,-37.8',
    'plant=native-violet&bbox=145,-37.8,144,-38',
    'plant=native-violet&bbox=NaN,-38,145,-37.8',
    'plant=native-violet&yearFrom=2025&yearTo=2020',
    'plant=native-violet&yearFrom=1700',
    'plant=native-violet&yearTo=9999',
    'plant=native-violet&url=https://example.test',
    'plant=native-violet&plant=coastal-rosemary',
  ])('rejects invalid filters before calling any provider: %s', async (query) => {
    const mock = provider()
    const response = await request('/api/v1/map/occurrences?' + query)
    expect(response.status).toBe(400)
    expect(mock).not.toHaveBeenCalled()
  })

  it('rejects fuzzy/higher-taxon matches instead of searching the wrong species', async () => {
    const mock = provider({ ...exactMatch, matchType: 'HIGHERRANK', rank: 'GENUS' })
    expect((await request('/api/v1/map/occurrences?plant=native-violet')).status).toBe(422)
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('uses the accepted taxon key for an exact synonym match', async () => {
    const mock = provider({ ...exactMatch, acceptedUsageKey: 9876 }, { count: 0, results: [] })
    const response = await request('/api/v1/map/occurrences?plant=native-violet')
    expect(response.status).toBe(200)
    expect(new URL(mock.mock.calls[1][0]).searchParams.get('taxonKey')).toBe('9876')
    expect((await response.json()).data).toEqual([])
  })

  it('reports provider outages and invalid responses without caching errors', async () => {
    const mock = vi.fn().mockRejectedValue(new Error('network unavailable'))
    vi.stubGlobal('fetch', mock)
    const response = await request('/api/v1/map/occurrences?plant=native-violet')
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    provider(exactMatch, { count: 4, results: 'invalid' })
    expect((await request('/api/v1/map/occurrences?plant=native-violet')).status).toBe(503)
  })
})

describe('place search and density aggregation', () => {
  it('restricts places to the Melbourne study area and preserves attribution', async () => {
    const mock = provider({
      results: [
        {
          id: 1,
          name: 'Fitzroy',
          latitude: -37.79839,
          longitude: 144.97833,
          country_code: 'AU',
          admin1: 'Victoria',
        },
        { id: 2, name: 'Fitzroy', latitude: -34.43333, longitude: 150.41667, country_code: 'AU' },
      ],
    })
    const response = await request('/api/v1/map/places?q=Fitzroy')
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Fitzroy')
    expect(body.attribution.provider).toBe('Open-Meteo / GeoNames')
    expect(new URL(mock.mock.calls[0][0]).searchParams.get('countryCode')).toBe('AU')
    expect(new URL(mock.mock.calls[0][0]).searchParams.get('name')).toBe('Fitzroy, Victoria')
  })

  it('returns honest empty place results and rejects short/duplicate queries', async () => {
    provider({})
    expect((await (await request('/api/v1/map/places?q=unknown')).json()).data).toEqual([])
    const mock = provider()
    expect((await request('/api/v1/map/places?q=x')).status).toBe(400)
    expect((await request('/api/v1/map/places?q=Fitzroy&q=Carlton')).status).toBe(400)
    expect(mock).not.toHaveBeenCalled()
  })

  it('aggregates each loaded record once into a fixed cell, including southern latitudes', () => {
    const cells = densityCells([
      { longitude: 144.9701, latitude: -37.8101 },
      { longitude: 144.9702, latitude: -37.8102 },
      { longitude: 145.1, latitude: -37.9 },
    ])
    expect(cells).toHaveLength(2)
    expect(cells.reduce((total, cell) => total + cell.count, 0)).toBe(3)
    expect(cells.find((cell) => cell.count === 2).bounds[1]).toBeLessThan(-37.8101)
    expect(densityCells([])).toEqual([])
  })

  it('shares the frontend/backend validation contract', () => {
    const query = parseMapQuery(
      new URLSearchParams('plant=coastal-rosemary&yearFrom=2020&yearTo=2025'),
      plants,
    )
    expect(query.plant.scientificName).toBe('Westringia fruticosa')
    expect(query.yearFrom).toBe(2020)
  })
})
