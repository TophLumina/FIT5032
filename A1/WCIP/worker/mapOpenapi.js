import { initialBounds, mapExtent, mapYear, recordLimit } from '../shared/mapQuery.js'

const string = { type: 'string' }
const json = (schema) => ({ 'application/json': { schema } })
const parameter = (name, schema, description, required = false) => ({
  name,
  in: 'query',
  required,
  schema,
  description,
})
const error = { description: 'JSON error.code and error.message; errors are not cached.' }

export const mapApiPaths = {
  '/api/v1/map/places': {
    get: {
      summary: 'Find places within Melbourne and surrounds',
      description:
        'User-submitted place/suburb search through Open-Meteo / GeoNames. Restricted to Victoria, Australia and the WCIP study rectangle. Up to 10 results. Cached for one day. Not street-address autocomplete. Retain Open-Meteo / GeoNames attribution (CC BY 4.0).',
      parameters: [
        parameter(
          'q',
          { ...string, minLength: 2, maxLength: 80 },
          'Suburb or place name, e.g. Fitzroy.',
          true,
        ),
      ],
      responses: {
        200: {
          description: 'Matching places; an empty array means no match in the study area.',
          content: json({
            type: 'object',
            properties: {
              data: {
                type: 'array',
                maxItems: 10,
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: string,
                    region: string,
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                  },
                },
              },
              attribution: { type: 'object' },
            },
          }),
        },
        400: error,
        503: error,
      },
    },
  },
  '/api/v1/map/occurrences': {
    get: {
      summary: 'Query real GBIF observations for a catalogue plant',
      description: `Returns at most ${recordLimit} records from the first GBIF result page, with the total matching count. This is a non-random subset, not a complete distribution or abundance estimate. Searches require coordinates, no GBIF geospatial issue, PRESENT status, Australia and an exact plant taxon match. Results can still be approximate, cultivated, historical or duplicated across sources. Cached for 15 minutes. Per-record licences and source links must be retained. Unknown/repeated parameters return 400; maximum encoded query length is 512 characters.`,
      parameters: [
        parameter('plant', string, 'Catalogue plant slug, e.g. native-violet.', true),
        parameter(
          'bbox',
          { ...string, default: initialBounds.join(',') },
          `west,south,east,north; restricted to ${mapExtent.join(',')} (a study rectangle, not an administrative boundary).`,
        ),
        parameter(
          'yearFrom',
          { type: 'integer', minimum: 1800, maximum: mapYear(), default: 2000 },
          'First year, inclusive.',
        ),
        parameter(
          'yearTo',
          { type: 'integer', minimum: 1800, maximum: mapYear() },
          'Last year, inclusive; defaults to the current Melbourne year. Must be at least yearFrom.',
        ),
      ],
      responses: {
        200: {
          description: 'Public occurrence records and bounded-query metadata.',
          content: json({
            type: 'object',
            properties: {
              data: {
                type: 'array',
                maxItems: recordLimit,
                items: {
                  type: 'object',
                  properties: {
                    id: string,
                    scientificName: string,
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    year: { type: 'integer' },
                    eventDate: string,
                    locality: string,
                    basisOfRecord: string,
                    dataset: string,
                    datasetUrl: { ...string, format: 'uri', nullable: true },
                    license: string,
                    uncertaintyMetres: { type: 'number', nullable: true },
                    generalized: { type: 'boolean' },
                    url: { ...string, format: 'uri' },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  total: {
                    type: 'integer',
                    description: 'All GBIF matches, before local record validation.',
                  },
                  returned: { type: 'integer' },
                  limit: { type: 'integer' },
                  truncated: { type: 'boolean' },
                  excluded: { type: 'integer' },
                  bounds: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
                  yearFrom: { type: 'integer' },
                  yearTo: { type: 'integer' },
                  plant: string,
                  commonName: string,
                  taxonKey: { type: 'integer' },
                  matchedName: string,
                  acceptedName: string,
                  fetchedAt: { ...string, format: 'date-time' },
                  sourceUrl: { ...string, format: 'uri' },
                },
              },
              attribution: { type: 'object' },
            },
          }),
        },
        400: error,
        422: { description: 'No safe exact species match in GBIF.' },
        503: error,
      },
    },
  },
}
