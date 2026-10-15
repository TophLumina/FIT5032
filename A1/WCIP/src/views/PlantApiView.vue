<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { plantApiOrigin } from '@/services/plantApi'
import { plantColumns, plantFilters, plantSorts } from '../../shared/plantQuery.js'

const q = ref('')
const space = ref('balcony')
const result = ref(null)
const loading = ref(false)
const error = ref('')
const requestedUrl = ref('')
const exampleUrl = computed(() => {
  const params = new URLSearchParams({ sort: 'name-asc', limit: '10' })
  if (q.value.trim()) params.set('q', q.value.trim())
  if (space.value) params.set('space', space.value)
  return `${plantApiOrigin}/api/v1/plants?${params}`
})
async function tryQuery() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  result.value = null
  requestedUrl.value = exampleUrl.value
  try {
    const response = await fetch(requestedUrl.value, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`The API returned HTTP ${response.status}.`)
    result.value = await response.json()
  } catch (cause) {
    error.value = `Could not load the API response. ${cause.message} Check your connection and try again.`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container-xxl py-5 api-reference">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><RouterLink :to="{ name: 'home' }">Home</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Plant API</li>
      </ol>
    </nav>
    <header class="mb-4">
      <p class="small fw-bold text-success text-uppercase mb-1">Developers</p>
      <h1 class="display-5 fw-bold">Plant Query API</h1>
      <p class="lead">Bring WCIP's Melbourne gardening catalogue into your own application.</p>
      <p>
        Public, read-only REST routes provide the same plant data and query rules used by our
        <RouterLink :to="{ name: 'plants' }">Plant Finder</RouterLink>. No account or API key is
        required.
      </p>
      <a :href="`${plantApiOrigin}/api/v1/openapi.json`" class="btn btn-outline-primary"
        >OpenAPI 3.0 specification (JSON)</a
      >
    </header>

    <section class="mb-5" aria-labelledby="routes-heading">
      <h2 id="routes-heading" class="h3">Endpoints</h2>
      <p>
        Base URL: <code>{{ plantApiOrigin }}</code>
      </p>
      <h3 class="h5"><code>GET /api/v1/plants</code></h3>
      <p>
        Search, filter, sort and paginate the catalogue. Returns <code>data</code> (an array) and
        <code>meta</code>: <code>total</code>, <code>page</code>, <code>limit</code>,
        <code>totalPages</code>, <code>hasNext</code> and <code>hasPrevious</code>.
      </p>
      <pre
        class="p-3 bg-light border rounded"
        tabindex="0"
        aria-label="List request example"
      ><code>curl "{{ plantApiOrigin }}/api/v1/plants?space=balcony&amp;sunlight=part-shade&amp;sort=name-asc&amp;limit=10"</code></pre>
      <h3 class="h5"><code>GET /api/v1/plants/{slug}</code></h3>
      <p>
        Return one plant under <code>data</code>, including its planting conditions, image credits
        and website URL. Use the <code>slug</code> from a list response. Query parameters are not
        accepted.
      </p>
      <pre
        class="p-3 bg-light border rounded"
        tabindex="0"
        aria-label="Detail request example"
      ><code>curl "{{ plantApiOrigin }}/api/v1/plants/native-violet"</code></pre>
      <a :href="`${plantApiOrigin}/api/v1/plants/native-violet`"
        >View the Native Violet JSON response</a
      >
    </section>

    <section class="mb-5" aria-labelledby="parameters-heading">
      <h2 id="parameters-heading" class="h3">List query parameters</h2>
      <dl class="row">
        <dt class="col-md-3"><code>q</code></dt>
        <dd class="col-md-9">
          Search all eight plant columns. Case-insensitive substring matching, up to 100 characters.
          Hyphens and spaces match each other.
        </dd>
        <template v-for="filter in plantFilters" :key="filter.key">
          <dt class="col-md-3">
            <code>{{ filter.key }}</code>
          </dt>
          <dd class="col-md-9">
            {{ filter.name }}: <code>{{ filter.values.join(', ') }}</code
            >.
          </dd>
        </template>
        <dt class="col-md-3"><code>column.{field}</code></dt>
        <dd class="col-md-9">
          Search one column's displayed labels (up to 100 characters). For example,
          <code>column.water=low</code> or <code>column.scientificName=viola</code>.
        </dd>
        <dt class="col-md-3"><code>sort</code></dt>
        <dd class="col-md-9">
          Default <code>best</code>: featured plants first, then catalogue order. Use
          <code>name-asc</code>, <code>name-desc</code>, or any column field with
          <code>-asc</code>/<code>-desc</code>. Ties use the stable plant ID.
        </dd>
        <dt class="col-md-3"><code>page</code> / <code>limit</code></dt>
        <dd class="col-md-9">
          Page starts at 1 (maximum 100,000). Limit defaults to 10 (1–100). An empty or beyond-last
          page returns HTTP 200 with an empty array. Zero matches means <code>totalPages: 0</code>.
        </dd>
      </dl>
      <p>
        Combine condition values with commas or repeated parameters, such as
        <code>space=balcony,courtyard</code>. Values within a group use OR; different groups and
        column searches use AND. <code>benefit=pollinators</code> expands to bees or butterflies.
      </p>
      <p>
        The full encoded query is limited to 2,048 characters. Unknown parameters, invalid values,
        and repeated scalar parameters return HTTP 400. Condition parameters may repeat.
      </p>
      <details>
        <summary>All supported sort values</summary>
        <p class="mt-2">
          <code>{{ plantSorts.join(', ') }}</code>
        </p>
      </details>
    </section>

    <section class="mb-5" aria-labelledby="fields-heading">
      <h2 id="fields-heading" class="h3">Plant fields</h2>
      <dl class="row">
        <template v-for="column in plantColumns" :key="column.key">
          <dt class="col-md-3">
            <code>{{ column.key }}</code>
          </dt>
          <dd class="col-md-9">
            {{ column.label
            }}<span v-if="['spaces', 'sunlight', 'biodiversity'].includes(column.key)">
              — array of strings</span
            ><span v-else> — string</span>.
          </dd>
        </template>
        <dt class="col-md-3"><code>id</code> / <code>slug</code></dt>
        <dd class="col-md-9">Stable numeric catalogue ID and URL identifier.</dd>
        <dt class="col-md-3"><code>featured</code></dt>
        <dd class="col-md-9">Boolean used in the best-match order.</dd>
        <dt class="col-md-3"><code>image</code> / <code>imageAlt</code></dt>
        <dd class="col-md-9">Absolute image URL and alternative text.</dd>
        <dt class="col-md-3"><code>imageCredit</code></dt>
        <dd class="col-md-9">
          Object containing <code>author</code>, <code>license</code>, <code>licenseUrl</code> and
          <code>sourceUrl</code>. Respect each image's licence when reusing it.
        </dd>
        <dt class="col-md-3"><code>url</code></dt>
        <dd class="col-md-9">Absolute link to the WCIP plant detail page.</dd>
      </dl>
      <p>
        This is a curated gardening catalogue, not a map of plant occurrences or a live nursery
        inventory. All current plants are classified as native; water values are <code>low</code>,
        <code>moderate</code> or <code>regular</code>. Image-source credits are not botanical
        evidence.
      </p>
    </section>

    <section class="card mb-5" aria-labelledby="try-heading">
      <div class="card-body p-4">
        <h2 id="try-heading" class="h3">Try a live query</h2>
        <form class="row g-3 align-items-end" @submit.prevent="tryQuery">
          <div class="col-md-6">
            <label for="api-search" class="form-label">Search plants</label>
            <input
              id="api-search"
              v-model="q"
              class="form-control"
              type="search"
              maxlength="100"
              placeholder="For example, violet"
            />
          </div>
          <div class="col-md-4">
            <label for="api-space" class="form-label">Space</label>
            <select id="api-space" v-model="space" class="form-select">
              <option value="">Any space</option>
              <option value="balcony">Balcony</option>
              <option value="courtyard">Courtyard</option>
              <option value="school">School garden</option>
            </select>
          </div>
          <div class="col-md-2">
            <button type="submit" class="btn btn-primary w-100" :disabled="loading">
              {{ loading ? 'Loading…' : 'Run query' }}
            </button>
          </div>
        </form>
        <p class="small text-break mt-3">
          Request: <code>{{ exampleUrl }}</code>
        </p>
        <p v-if="error" class="alert alert-warning" role="alert">{{ error }}</p>
        <p v-if="loading" role="status">Requesting the public API…</p>
        <template v-if="result">
          <p role="status">
            {{ result.meta.total }} matching plants; {{ result.data.length }} returned on this page.
          </p>
          <p class="small text-break">
            Response for <code>{{ requestedUrl }}</code>
          </p>
          <pre
            class="api-response p-3 bg-light border rounded"
            tabindex="0"
            aria-label="Live API JSON response"
          ><code>{{ JSON.stringify(result, null, 2) }}</code></pre>
        </template>
      </div>
    </section>

    <section class="mb-5" aria-labelledby="map-api-heading">
      <h2 id="map-api-heading" class="h3">Melbourne observation APIs</h2>
      <p>
        The <RouterLink :to="{ name: 'plant-map' }">Plant Map</RouterLink> uses two additional
        public routes:
      </p>
      <ul>
        <li>
          <code>GET /api/v1/map/places?q=Fitzroy</code> — search place names in Melbourne and
          surrounds through Open-Meteo / GeoNames; 2–80 characters, up to 10 results, cached for one
          day.
        </li>
        <li>
          <code
            >GET /api/v1/map/occurrences?plant=native-violet&amp;yearFrom=2020&amp;yearTo=2025</code
          >
          — real GBIF records for a catalogue plant, cached for 15 minutes.
        </li>
      </ul>
      <p>
        Observation queries accept <code>bbox=west,south,east,north</code> within
        <code>144.3,-38.5,145.8,-37.3</code>. The default rectangle is
        <code>144.75,-38,145.35,-37.55</code>. Years run from 1800 to the current year; defaults are
        2000 to the current year. Invalid or repeated parameters return 400. An unresolved plant
        taxon returns 422; unavailable data providers return 503.
      </p>
      <p>
        At most 300 records are returned. <code>meta.total</code> is the GBIF match count;
        <code>returned</code>, <code>truncated</code> and <code>excluded</code> describe the loaded
        subset. Records include coordinates, dates, datasets, licences, uncertainty and links to the
        original sources. A limited, non-random subset must not be presented as a complete
        distribution or population count. Retain GBIF/dataset and Open-Meteo/GeoNames attribution.
        Full schemas are in the OpenAPI specification.
      </p>
    </section>

    <section aria-labelledby="usage-heading">
      <h2 id="usage-heading" class="h3">Errors, caching and reuse</h2>
      <p>
        HTTP 400 indicates an invalid query; 404 an unknown plant or route; 405 a write method such
        as POST; 500 a server error. Errors use
        <code>{ "error": { "code": "INVALID_QUERY", "message": "…" } }</code>. GET, HEAD and OPTIONS
        are supported. CORS allows public browser requests without credentials.
      </p>
      <p>
        Successful responses may be cached for five minutes. Cloudflare account quotas apply and
        service is best effort. Cache responses in your application, request only needed pages and
        back off on failures.
      </p>
      <p>
        The website and Worker are built from <code>public/data/plants.json</code> and a shared
        query module. The website filters its loaded catalogue locally; this API runs those queries
        on the server. The Plant Finder CSV includes all matching rows in the current order,
        including column searches, with UTF-8 encoding and spreadsheet formula protection. User
        accounts and administrator statistics are excluded from this API.
      </p>
    </section>
  </div>
</template>

<style scoped>
.api-reference {
  max-width: 72rem;
}
.api-response {
  max-height: 28rem;
}
code {
  overflow-wrap: anywhere;
}
</style>
