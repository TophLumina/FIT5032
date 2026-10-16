import plants from '../public/data/plants.json'
import { QueryError } from '../shared/plantQuery.js'
import { findOccurrences, findPlaces, MapServiceError } from './map.js'
import { handleAssistant } from './assistant.js'

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/assistant/')) return handleAssistant(request, env)
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
    if (
      url.pathname === '/api/v1/plants' ||
      url.pathname.startsWith('/api/v1/plants/') ||
      url.pathname === '/api/v1/openapi.json'
    )
      return error(
        410,
        'API_RETIRED',
        'The public plant API has been retired. Visit WCIP to browse plants and use the AI Garden Assistant.',
      )
    if (request.method === 'OPTIONS') return response(null, 204)
    if (!['GET', 'HEAD'].includes(request.method))
      return error(405, 'METHOD_NOT_ALLOWED', 'This API is read-only.', {
        Allow: 'GET, HEAD, OPTIONS',
      })
    try {
      if (url.pathname === '/api/v1/map/places')
        return response(await findPlaces(url.searchParams), 200, {
          'Cache-Control': 'public, max-age=86400',
        })
      if (url.pathname === '/api/v1/map/occurrences')
        return response(await findOccurrences(url.searchParams, plants), 200, {
          'Cache-Control': 'public, max-age=900',
        })
      return error(404, 'NOT_FOUND', 'Unknown route.')
    } catch (cause) {
      if (cause instanceof MapServiceError)
        return error(cause.status, 'MAP_DATA_UNAVAILABLE', cause.message)
      if (cause instanceof QueryError) return error(400, 'INVALID_QUERY', cause.message)
      return error(500, 'INTERNAL_ERROR', 'The request could not be processed.')
    }
  },
}
