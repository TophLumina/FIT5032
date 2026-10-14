import { plantColumns, plantFilters, plantSorts } from '../shared/plantQuery.js'

const string = { type: 'string' }
const strings = { type: 'array', items: string }
const plantSchema = {
  type: 'object',
  required: [
    'id',
    'slug',
    'commonName',
    'scientificName',
    'status',
    'difficulty',
    'spaces',
    'sunlight',
    'water',
    'biodiversity',
    'featured',
    'image',
    'imageAlt',
    'imageCredit',
    'url',
  ],
  properties: {
    id: { type: 'integer', description: 'Stable catalogue identifier.' },
    slug: { ...string, description: 'Stable URL identifier used by the detail route.' },
    commonName: string,
    scientificName: string,
    status: {
      ...string,
      description:
        'Catalogue origin classification; all current records are native. Not an invasive-species assessment.',
    },
    difficulty: { ...string, enum: ['beginner', 'intermediate'] },
    spaces: { ...strings, description: 'Suitable space types: balcony, courtyard, school.' },
    sunlight: { ...strings, description: 'Suitable light: full-sun, part-shade, shade.' },
    water: { ...string, description: 'Relative watering requirement in this curated catalogue.' },
    biodiversity: {
      ...strings,
      description: 'Wildlife groups supported: bees, birds, butterflies.',
    },
    featured: {
      type: 'boolean',
      description: 'Featured plants appear first in best-match ordering.',
    },
    image: { ...string, format: 'uri' },
    imageAlt: string,
    imageCredit: {
      type: 'object',
      properties: {
        author: string,
        license: string,
        licenseUrl: { ...string, format: 'uri' },
        sourceUrl: { ...string, format: 'uri' },
      },
    },
    url: { ...string, format: 'uri', description: 'Public WCIP plant detail page.' },
  },
}

export function openApiDocument(origin) {
  const json = (schema) => ({ 'application/json': { schema } })
  const error = {
    description: 'Request failed; error.code and error.message explain why.',
    content: json({
      type: 'object',
      properties: { error: { type: 'object', properties: { code: string, message: string } } },
    }),
  }
  const parameter = (name, schema, description) => ({
    name,
    in: 'query',
    required: false,
    schema,
    description,
  })
  return {
    openapi: '3.0.3',
    info: {
      title: 'WCIP Plant Query API',
      version: '1.0.0',
      description:
        'Read-only access to the curated WCIP Melbourne gardening catalogue. No API key. Public CORS without credentials. This is not plant occurrence or live stock data. Image credits describe image rights, not botanical evidence. Responses are cached for five minutes. Queries are limited to 2048 encoded characters; unknown parameters and duplicates of scalar parameters return 400. Empty or beyond-last pages return 200 with an empty data array. Cloudflare account quotas apply; there is no availability SLA. Site and API use the same catalogue and query module.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/v1/plants': {
        get: {
          summary: 'Search, filter, sort and paginate plants',
          description:
            'Filters combine with AND across groups, OR within a group. Search is case-insensitive substring matching; hyphens and spaces are equivalent. Column filters combine with AND and search the same displayed labels as the comparison table. The default best order places featured plants first and otherwise preserves catalogue order.',
          parameters: [
            parameter(
              'q',
              { ...string, maxLength: 100 },
              'Search across all eight comparison columns.',
            ),
            ...plantFilters.map(({ key, values }) =>
              parameter(
                key,
                string,
                `Comma-separated or repeated values: ${values.join(', ')}.${key === 'benefit' ? ' pollinators is an alias for bees,butterflies.' : ''}`,
              ),
            ),
            ...plantColumns.map(({ key, label }) =>
              parameter(
                `column.${key}`,
                { ...string, maxLength: 100 },
                `Substring search within ${label}; same labels as the website.`,
              ),
            ),
            parameter(
              'sort',
              { ...string, enum: plantSorts, default: 'best' },
              'Column ordering; name is an alias for commonName. Ties use the stable plant ID.',
            ),
            parameter(
              'page',
              { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
              'One-based page.',
            ),
            parameter(
              'limit',
              { type: 'integer', minimum: 1, maximum: 100, default: 10 },
              'Maximum records per page. Website tables always use 10.',
            ),
          ],
          responses: {
            200: {
              description: 'Matching plants and pagination metadata.',
              content: json({
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Plant' } },
                  meta: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                      totalPages: { type: 'integer' },
                      hasNext: { type: 'boolean' },
                      hasPrevious: { type: 'boolean' },
                    },
                  },
                },
              }),
            },
            400: error,
            405: error,
            500: error,
          },
        },
      },
      '/api/v1/plants/{slug}': {
        get: {
          summary: 'Get planting conditions and credits for one plant',
          parameters: [
            {
              name: 'slug',
              in: 'path',
              required: true,
              schema: { ...string, pattern: '^[a-z0-9-]+$' },
              example: 'native-violet',
            },
          ],
          responses: {
            200: {
              description: 'Plant detail.',
              content: json({
                type: 'object',
                properties: { data: { $ref: '#/components/schemas/Plant' } },
              }),
            },
            400: error,
            404: error,
            405: error,
            500: error,
          },
        },
      },
    },
    components: { schemas: { Plant: plantSchema } },
  }
}
