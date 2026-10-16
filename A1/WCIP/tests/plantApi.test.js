// @vitest-environment node
import { describe, expect, it } from 'vitest'
import plants from '../public/data/plants.json'
import worker from '../worker/index.js'
import { parsePlantQuery, queryPlants } from '../shared/plantQuery.js'
import { plantingListCsv } from '../shared/plantCsv.js'

const request = (path = '/api/v1/plants', options) =>
  worker.fetch(new Request(`https://example.test${path}`, options))

describe('retired public plant API', () => {
  it.each(['/api/v1/plants', '/api/v1/plants/native-violet', '/api/v1/openapi.json'])(
    'returns 410 for %s without exposing a catalogue or specification',
    async (path) => {
      for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
        const response = await request(path, { method })
        expect(response.status).toBe(410)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        if (method !== 'HEAD') expect((await response.json()).error.code).toBe('API_RETIRED')
      }
    },
  )
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
