import { plantApiOrigin } from './plantApi.js'

async function readMap(path, params, signal) {
  const response = await fetch(`${plantApiOrigin}/api/v1/map/${path}?${params}`, { signal })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Map data could not be loaded.')
  return body
}

export function searchMapPlaces(q, signal) {
  return readMap('places', new URLSearchParams({ q }), signal)
}

export function getMapOccurrences(choices, signal) {
  return readMap(
    'occurrences',
    new URLSearchParams({
      plant: choices.plant,
      bbox: choices.bounds.join(','),
      yearFrom: choices.yearFrom,
      yearTo: choices.yearTo,
    }),
    signal,
  )
}
