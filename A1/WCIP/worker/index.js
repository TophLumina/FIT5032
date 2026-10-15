import plants from '../public/data/plants.json'
import { paginatePlants, parsePlantQuery, QueryError } from '../shared/plantQuery.js'
import { siteOrigin } from '../shared/plantCsv.js'
import { openApiDocument } from './openapi.js'
import { findOccurrences, findPlaces, MapServiceError } from './map.js'

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
}

function publicPlant(plant) {
  // Explicit allowlist; private user information must never enter this API.
  const {
    id,
    slug,
    commonName,
    scientificName,
    imageAlt,
    imageCredit,
    status,
    difficulty,
    spaces,
    sunlight,
    water,
    biodiversity,
    featured,
  } = plant
  return {
    id,
    slug,
    commonName,
    scientificName,
    status,
    difficulty,
    spaces,
    sunlight,
    water,
    biodiversity,
    featured,
    imageAlt,
    imageCredit,
    image: new URL(plant.image, siteOrigin).href,
    url: `${siteOrigin}/plants/${slug}`,
  }
}

export default {
  async fetch(request) {
    const response = (body, status = 200, extra = {}) =>
      new Response(request.method === 'HEAD' || status === 204 ? null : JSON.stringify(body), {
        status,
        headers: {
          ...headers,
          'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
          ...extra,
        },
      })
    const error = (status, code, message, extra) =>
      response({ error: { code, message } }, status, extra)
    if (request.method === 'OPTIONS') return response(null, 204)
    if (!['GET', 'HEAD'].includes(request.method))
      return error(405, 'METHOD_NOT_ALLOWED', 'This API is read-only.', {
        Allow: 'GET, HEAD, OPTIONS',
      })
    const url = new URL(request.url)
    try {
      if (url.pathname === '/api/v1/map/places')
        return response(await findPlaces(url.searchParams), 200, {
          'Cache-Control': 'public, max-age=86400',
        })
      if (url.pathname === '/api/v1/map/occurrences')
        return response(await findOccurrences(url.searchParams, plants), 200, {
          'Cache-Control': 'public, max-age=900',
        })
      if (url.pathname === '/api/v1/openapi.json') return response(openApiDocument(url.origin))
      if (url.pathname === '/api/v1/plants') {
        const choices = parsePlantQuery(url.searchParams)
        const result = paginatePlants(plants, choices)
        return response({ ...result, data: result.data.map(publicPlant) })
      }
      const match = url.pathname.match(/^\/api\/v1\/plants\/([a-z0-9-]+)$/)
      if (match) {
        if (url.search) throw new QueryError('The detail route does not accept query parameters.')
        const plant = plants.find((plant) => plant.slug === match[1])
        return plant
          ? response({ data: publicPlant(plant) })
          : error(404, 'PLANT_NOT_FOUND', 'No plant has this slug.')
      }
      return error(404, 'NOT_FOUND', 'Unknown route. See /api/v1/openapi.json.')
    } catch (cause) {
      if (cause instanceof MapServiceError)
        return error(cause.status, 'MAP_DATA_UNAVAILABLE', cause.message)
      if (cause instanceof QueryError) return error(400, 'INVALID_QUERY', cause.message)
      return error(500, 'INTERNAL_ERROR', 'The request could not be processed.')
    }
  },
}
