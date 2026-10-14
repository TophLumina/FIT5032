// @vitest-environment node
import { describe, expect, it } from 'vitest'
import plants from '../public/data/plants.json'
import worker from '../worker/index.js'
import { parsePlantQuery, queryPlants, plantColumns } from '../shared/plantQuery.js'
import { selectRows } from '../shared/tableQuery.js'
import { plantingListCsv } from '../shared/plantCsv.js'

const request = (path = '/api/v1/plants', options) =>
  worker.fetch(new Request(`https://example.test${path}`, options))

describe('public plant API', () => {
  it('paginates ten records by default and exposes the full catalogue across pages', async () => {
    const seen = []
    for (let page = 1; page <= 3; page++) {
      const response = await request(`/api/v1/plants?page=${page}`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.meta).toMatchObject({
        total: 24,
        limit: 10,
        totalPages: 3,
        page,
        hasNext: page < 3,
      })
      expect(body.data.length).toBe(page < 3 ? 10 : 4)
      seen.push(...body.data.map((plant) => plant.slug))
    }
    expect(new Set(seen).size).toBe(24)
  })

  it('shares combined filtering and ordering with the comparison table and CSV', async () => {
    const conditions = { space: ['balcony'], sunlight: ['part-shade'], q: 'native', sort: 'best' }
    const filters = { water: 'moderate' }
    const displayed = selectRows(queryPlants(plants, conditions), plantColumns, {
      filters,
      sort: 'commonName',
      direction: 'desc',
    })
    const response = await request(
      '/api/v1/plants?space=balcony&sunlight=part-shade&q=native&column.water=moderate&sort=name-desc&limit=100',
    )
    const body = await response.json()
    expect(displayed.length).toBeGreaterThan(0)
    expect(body.data.map((plant) => plant.id)).toEqual(displayed.map((plant) => plant.id))
    const csvNames = plantingListCsv(displayed)
      .split('\r\n')
      .slice(1, -1)
      .map((line) => line.split(',')[0].slice(1, -1))
    expect(csvNames).toEqual(body.data.map((plant) => plant.commonName))
  })

  it.each(plantColumns.map(({ key }) => key))(
    'uses identical %s ascending and descending sorting in the table and API',
    async (key) => {
      for (const direction of ['asc', 'desc']) {
        const table = selectRows(queryPlants(plants, { sort: 'best' }), plantColumns, {
          sort: key,
          direction,
        })
        const body = await (
          await request(`/api/v1/plants?sort=${key}-${direction}&limit=100`)
        ).json()
        expect(body.data.map((plant) => plant.id)).toEqual(table.map((plant) => plant.id))
      }
    },
  )

  it('supports repeated condition values, pollinators alias and case-insensitive column search', async () => {
    const body = await (
      await request(
        '/api/v1/plants?space=balcony&space=courtyard&benefit=pollinators&column.scientificName=VIOLA',
      )
    ).json()
    expect(body.data.map((plant) => plant.slug)).toEqual(['native-violet', 'purple-coral-pea'])
  })

  it('returns an empty array for no matches and out-of-range pages', async () => {
    const empty = await (await request('/api/v1/plants?q=does-not-exist')).json()
    expect(empty).toMatchObject({ data: [], meta: { total: 0, totalPages: 0, hasNext: false } })
    expect((await (await request('/api/v1/plants?page=99')).json()).data).toEqual([])
  })

  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=1e2',
    'page=100001',
    'limit=101',
    'limit=',
    'sort=bad',
    'space=garage',
    'q=a&q=b',
    'unknown=1',
    'column.password=x',
    'q=' + 'x'.repeat(101),
    'q=' + 'x'.repeat(2049),
  ])('rejects malformed query %s', async (query) => {
    const response = await request(`/api/v1/plants?${query}`)
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_QUERY')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns details with absolute links and credits, no private fields', async () => {
    const response = await request('/api/v1/plants/native-violet')
    const { data } = await response.json()
    expect(data.scientificName).toBe('Viola hederacea')
    expect(data.imageCredit.sourceUrl).toMatch(/^https:/)
    expect(data.image).toMatch(/^https:\/\/wcip-fit5032-e0aef.web.app\//)
    expect(data).not.toHaveProperty('email')
    expect(data).not.toHaveProperty('users')
    expect(response.headers.get('Cache-Control')).toContain('max-age=300')
  })

  it('handles missing routes, invalid detail queries, HEAD, CORS, and rejected writes', async () => {
    expect((await request('/api/v1/plants/unknown')).status).toBe(404)
    expect((await request('/unknown')).status).toBe(404)
    expect((await request('/api/v1/plants/native-violet?q=x')).status).toBe(400)
    const head = await request('/api/v1/plants', { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    const options = await request('/api/v1/plants', {
      method: 'OPTIONS',
      headers: { Origin: 'https://third-party.test' },
    })
    expect(options.status).toBe(204)
    expect(options.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(options.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS')
    const post = await request('/api/v1/plants', { method: 'POST' })
    expect(post.status).toBe(405)
    expect(post.headers.get('Allow')).toContain('GET')
  })

  it('publishes a discoverable OpenAPI contract', async () => {
    const spec = await (await request('/api/v1/openapi.json')).json()
    expect(spec.openapi).toBe('3.0.3')
    expect(Object.keys(spec.paths)).toHaveLength(2)
    expect(spec.servers[0].url).toBe('https://example.test')
    expect(spec.components.schemas.Plant.properties.imageCredit).toBeDefined()
  })
})

describe('planting-list CSV', () => {
  it('exports all matching rows, not just the visible page, without mutating the catalogue', () => {
    const originalIds = plants.map((plant) => plant.id)
    const results = queryPlants(plants, parsePlantQuery(new URLSearchParams('sort=name-desc')))
    expect(plantingListCsv(results).split('\r\n')).toHaveLength(26)
    expect(plants.map((plant) => plant.id)).toEqual(originalIds)
  })

  it('preserves Unicode, commas, quotes and newlines, with an Excel UTF-8 BOM', () => {
    const csv = plantingListCsv([{ ...plants[0], commonName: '墨尔本, "Violet"\nGarden' }])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"墨尔本, ""Violet""\nGarden"')
    expect(csv).toContain('"Image licence"')
  })

  it.each(['=1+1', '+SUM(1)', '-1+2', '@SUM(A1)', '  =1', '\t=1', '\nhello'])(
    'neutralises spreadsheet formulas: %s',
    (value) => {
      const csv = plantingListCsv([{ ...plants[0], commonName: value }])
      expect(csv).toContain(`"'${value}"`)
    },
  )
})
