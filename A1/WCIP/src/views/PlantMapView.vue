<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import PlantObservationMap from '@/components/PlantObservationMap.vue'
import InteractiveTable from '@/components/InteractiveTable.vue'
import { usePlants } from '@/composables/usePlants'
import { getMapOccurrences, searchMapPlaces } from '@/services/map'
import { formatLabel } from '@/utils/plantLabels'
import {
  clipBounds,
  densityCells,
  initialBounds,
  mapYear,
  parseMapQuery,
} from '../../shared/mapQuery.js'

const route = useRoute()
const { plants, loading: catalogLoading, error: catalogError, loadPlants } = usePlants()
const plantSlug = ref('native-violet')
const yearFrom = ref(2000)
const yearTo = ref(mapYear())
const viewportBounds = ref([...initialBounds])
const targetBounds = ref([...initialBounds])
const result = ref(null)
const loading = ref(false)
const error = ref('')
const mode = ref('points')
const selectedId = ref('')
const detailPanel = ref(null)
const placeQuery = ref('')
const places = ref([])
const placeLoading = ref(false)
const placeError = ref('')
const placeSearched = ref(false)
const selectedPlace = ref(null)
let recordController,
  placeController,
  recordRequest = 0,
  placeRequest = 0
const sortedPlants = computed(() =>
  [...plants.value].sort((a, b) => a.commonName.localeCompare(b.commonName)),
)
const records = computed(() => result.value?.data ?? [])
const selected = computed(() => records.value.find((record) => record.id === selectedId.value))
const cells = computed(() =>
  densityCells(records.value).map((cell) => ({
    id: cell.key,
    count: cell.count,
    latitude: Number(((cell.bounds[1] + cell.bounds[3]) / 2).toFixed(4)),
    longitude: Number(((cell.bounds[0] + cell.bounds[2]) / 2).toFixed(4)),
  })),
)
const densityColumns = [
  { key: 'count', label: 'Records' },
  { key: 'latitude', label: 'Cell latitude' },
  { key: 'longitude', label: 'Cell longitude' },
]
let returnFocus
const recordColumns = [
  { key: 'eventDate', label: 'Date' },
  { key: 'locality', label: 'Locality' },
  { key: 'dataset', label: 'Dataset' },
  {
    key: 'basisOfRecord',
    label: 'Record type',
    format: (value) => formatLabel(value.toLowerCase().replaceAll('_', '-')),
  },
  { key: 'id', label: 'Record' },
]

async function loadRecords(bounds = viewportBounds.value) {
  const id = ++recordRequest
  recordController?.abort()
  recordController = new AbortController()
  const controller = recordController
  error.value = ''
  selectedId.value = ''
  result.value = null
  loading.value = false
  try {
    const choices = parseMapQuery(
      new URLSearchParams({
        plant: plantSlug.value,
        bbox: bounds.join(','),
        yearFrom: String(yearFrom.value),
        yearTo: String(yearTo.value),
      }),
      plants.value,
    )
    loading.value = true
    const response = await getMapOccurrences(
      { ...choices, plant: choices.plant.slug },
      AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
    )
    if (id === recordRequest) {
      result.value = response
      // Keep the loading state until the map has received and drawn the new records.
      await nextTick()
    }
  } catch (cause) {
    if (id === recordRequest && !controller.signal.aborted)
      error.value =
        cause.name === 'TimeoutError' ? 'The map query timed out. Please try again.' : cause.message
  } finally {
    if (id === recordRequest) loading.value = false
  }
}

async function findPlace() {
  const id = ++placeRequest
  placeController?.abort()
  placeController = new AbortController()
  const controller = placeController
  places.value = []
  placeError.value = ''
  placeSearched.value = false
  placeLoading.value = false
  if (placeQuery.value.trim().length < 2) {
    placeError.value = 'Enter at least two characters.'
    return
  }
  placeLoading.value = true
  try {
    const response = await searchMapPlaces(
      placeQuery.value.trim(),
      AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    )
    if (id === placeRequest) {
      places.value = response.data
      placeSearched.value = true
    }
  } catch {
    if (id === placeRequest && !controller.signal.aborted)
      placeError.value = 'Place search is unavailable. Try again, or move the map to your area.'
  } finally {
    if (id === placeRequest) placeLoading.value = false
  }
}

function choosePlace(place) {
  selectedPlace.value = place
  const bounds = clipBounds([
    place.longitude - 0.045,
    place.latitude - 0.035,
    place.longitude + 0.045,
    place.latitude + 0.035,
  ])
  targetBounds.value = bounds
  viewportBounds.value = bounds
  loadRecords(bounds)
}

function resetArea() {
  selectedPlace.value = null
  targetBounds.value = [...initialBounds]
  viewportBounds.value = [...initialBounds]
  loadRecords(initialBounds)
}

async function showRecord(id) {
  returnFocus = document.activeElement
  selectedId.value = id
  mode.value = 'points'
  await nextTick()
  detailPanel.value?.focus({ preventScroll: false })
}

async function closeRecord() {
  selectedId.value = ''
  await nextTick()
  if (returnFocus?.isConnected) returnFocus.focus()
}

watch(
  [() => route.query.plant, () => plants.value.length],
  () => {
    if (!plants.value.length) return
    const slug = typeof route.query.plant === 'string' ? route.query.plant : 'native-violet'
    if (!plants.value.some((plant) => plant.slug === slug)) {
      recordController?.abort()
      recordRequest++
      loading.value = false
      result.value = null
      error.value = 'This plant link is not in our catalogue. Choose a plant and search this area.'
      return
    }
    plantSlug.value = slug
    loadRecords(initialBounds)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  recordRequest++
  placeRequest++
  recordController?.abort()
  placeController?.abort()
})
</script>

<template>
  <div class="container-xxl py-5 plant-map-page">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><RouterLink :to="{ name: 'home' }">Home</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Plant Map</li>
      </ol>
    </nav>
    <header class="mb-4">
      <p class="small fw-bold text-success text-uppercase mb-1">Explore Melbourne</p>
      <h1 class="display-5 fw-bold">Plants around Melbourne</h1>
      <p class="lead">Explore where plants in our catalogue have been recorded.</p>
      <p class="text-body-secondary">
        Find a suburb or place, then explore observations by plant, year and map area.
      </p>
    </header>

    <p v-if="catalogLoading" role="status">Loading the plant catalogue…</p>
    <div v-if="catalogError" class="alert alert-warning" role="alert">
      {{ catalogError }}
      <button class="btn btn-outline-primary ms-2" @click="loadPlants">Try again</button>
    </div>
    <div class="row g-4 align-items-start">
      <aside class="col-xl-3">
        <section class="card mb-3" aria-labelledby="place-heading">
          <div class="card-body">
            <h2 id="place-heading" class="h5">Find an area</h2>
            <form @submit.prevent="findPlace">
              <label for="map-place" class="form-label">Suburb or place name</label>
              <input
                id="map-place"
                v-model="placeQuery"
                type="search"
                class="form-control"
                placeholder="For example, Fitzroy"
                minlength="2"
                maxlength="80"
                required
              />
              <button class="btn btn-outline-primary w-100 mt-2" :disabled="placeLoading">
                {{ placeLoading ? 'Finding places…' : 'Find places' }}
              </button>
            </form>
            <p v-if="placeError" role="alert" class="text-danger mt-2 mb-0">{{ placeError }}</p>
            <p v-if="placeSearched && !places.length" class="small mt-2 mb-0" role="status">
              No matching places in Melbourne and surrounds. Try a nearby suburb.
            </p>
            <ul v-if="places.length" class="list-unstyled mt-3 mb-0" aria-label="Matching places">
              <li v-for="place in places" :key="place.id" class="mb-2">
                <button
                  type="button"
                  class="btn btn-outline-primary text-start w-100"
                  @click="choosePlace(place)"
                >
                  {{ place.name }} <small class="d-block">{{ place.region }}</small>
                </button>
              </li>
            </ul>
            <p class="small text-body-secondary mt-3 mb-0">
              Places: <a href="https://open-meteo.com/en/docs/geocoding-api">Open-Meteo</a> /
              <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0).
            </p>
          </div>
        </section>

        <section class="card" aria-labelledby="map-filters-heading">
          <div class="card-body">
            <h2 id="map-filters-heading" class="h5">Observation filters</h2>
            <form @submit.prevent="loadRecords()">
              <label for="map-plant" class="form-label">Plant</label>
              <select
                id="map-plant"
                v-model="plantSlug"
                class="form-select"
                :disabled="catalogLoading || !!catalogError"
              >
                <option v-for="plant in sortedPlants" :key="plant.slug" :value="plant.slug">
                  {{ plant.commonName }}
                </option>
              </select>
              <div class="row g-2 my-2">
                <div class="col-6">
                  <label for="map-from" class="form-label">From year</label
                  ><input
                    id="map-from"
                    v-model="yearFrom"
                    class="form-control"
                    type="number"
                    min="1800"
                    :max="mapYear()"
                    required
                  />
                </div>
                <div class="col-6">
                  <label for="map-to" class="form-label">To year</label
                  ><input
                    id="map-to"
                    v-model="yearTo"
                    class="form-control"
                    type="number"
                    min="1800"
                    :max="mapYear()"
                    required
                  />
                </div>
              </div>
              <button
                class="btn btn-primary w-100 mt-2"
                :disabled="catalogLoading || !!catalogError || loading"
              >
                {{ loading ? 'Loading observations…' : 'Search this area' }}
              </button>
            </form>
            <button
              class="btn btn-outline-primary w-100 mt-2"
              type="button"
              :disabled="catalogLoading || !!catalogError || loading"
              @click="resetArea"
            >
              Reset Melbourne area
            </button>
            <p class="small text-body-secondary mt-3 mb-0">
              Queries cover the current map area within Melbourne and surrounds. Apply filters with
              “Search this area”.
            </p>
          </div>
        </section>
      </aside>

      <section class="col-xl-9" aria-labelledby="map-results-heading">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <h2 id="map-results-heading" class="h4 mb-0">
            {{ result ? result.meta.commonName + ' observations' : 'Observation map' }}
          </h2>
          <div class="btn-group" role="group" aria-label="Map display">
            <button
              type="button"
              class="btn btn-outline-primary"
              :class="{ active: mode === 'points' }"
              :aria-pressed="mode === 'points'"
              @click="mode = 'points'"
            >
              Observation points
            </button>
            <button
              type="button"
              class="btn btn-outline-primary"
              :class="{ active: mode === 'density' }"
              :aria-pressed="mode === 'density'"
              @click="mode = 'density'"
            >
              Record density
            </button>
          </div>
        </div>
        <p v-if="selectedPlace" class="small" role="status">
          Area centred near {{ selectedPlace.name }}. The blue ring marks the searched place.
        </p>
        <div v-if="error" class="alert alert-warning" role="alert">
          {{ error }}
          <button type="button" class="btn btn-outline-primary ms-2" @click="loadRecords()">
            Try again
          </button>
        </div>
        <p v-if="result" role="status" class="mb-2">
          <strong>{{ result.meta.returned }}</strong> records loaded out of
          <strong>{{ result.meta.total.toLocaleString() }}</strong> matching GBIF records ·
          {{ result.meta.yearFrom }}–{{ result.meta.yearTo }}.
        </p>
        <p v-if="result?.meta.truncated" class="alert alert-info small">
          Showing up to {{ result.meta.limit }} records from the first GBIF result page. This is a
          limited, non-random subset. Narrow the area or years to explore more detail.
        </p>
        <p v-if="result && !records.length" class="alert alert-info" role="status">
          No usable records match this query. Try a wider area, a longer year range or another
          plant. Missing records do not mean the plant is absent.
        </p>
        <PlantObservationMap
          :records="records"
          :loading="catalogLoading || loading"
          :loading-label="
            catalogLoading ? 'Preparing the plant map…' : 'Loading plant observations…'
          "
          :mode="mode"
          :target-bounds="targetBounds"
          :selected-id="selectedId"
          :place="selectedPlace"
          :queried-bounds="result?.meta.bounds"
          @bounds-change="viewportBounds = $event"
          @select="showRecord"
        />
        <div
          v-if="mode === 'density'"
          class="d-flex flex-wrap align-items-center gap-3 small mt-3"
          aria-label="Density legend"
        >
          <strong>Loaded records per ~1 km cell:</strong>
          <span
            v-for="item in [
              { label: '1', color: '#f1c879' },
              { label: '2–4', color: '#d67b43' },
              { label: '5–9', color: '#bc3754' },
              { label: '10+', color: '#7a183e' },
            ]"
            :key="item.label"
            ><span
              class="density-swatch"
              :style="{ backgroundColor: item.color }"
              aria-hidden="true"
            ></span>
            {{ item.label }}</span
          >
        </div>
        <details v-if="mode === 'density' && result" class="mt-3">
          <summary>Density data as a table ({{ cells.length }} occupied cells)</summary>
          <p class="small mt-2">
            Cell centres and counts for the same approximately 1 km grid shown on the map. Counts
            cover loaded records only.
          </p>
          <InteractiveTable
            id="map-density"
            caption="Loaded observation density cells"
            :rows="cells"
            :columns="densityColumns"
            initial-sort="count"
            initial-direction="desc"
          />
        </details>
        <p class="small text-body-secondary mt-3">
          Density counts the loaded observation records, not living plants or their abundance.
          Locations may be approximate, historical, cultivated or duplicated. Check the source
          before planning a visit; records do not imply public access.
        </p>
        <p v-if="result" class="small">
          GBIF name match: <em>{{ result.meta.acceptedName }}</em
          >.
          <a :href="result.meta.sourceUrl" target="_blank" rel="noopener noreferrer"
            >View source query on GBIF (JSON, new tab)</a
          >.
        </p>
      </section>
    </div>

    <section
      v-if="selected"
      ref="detailPanel"
      class="card mt-4 record-detail"
      tabindex="-1"
      aria-labelledby="record-heading"
    >
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-2">
          <h2 id="record-heading" class="h4">Observation details</h2>
          <button class="btn btn-outline-primary btn-sm" type="button" @click="closeRecord">
            Close details
          </button>
        </div>
        <p>
          <strong>{{ selected.scientificName }}</strong> · {{ selected.eventDate }} ·
          {{ selected.locality }}
        </p>
        <dl class="row mb-2">
          <dt class="col-sm-3">Source dataset</dt>
          <dd class="col-sm-9">
            <a
              v-if="selected.datasetUrl"
              :href="selected.datasetUrl"
              target="_blank"
              rel="noopener noreferrer"
              >{{ selected.dataset }} (opens a new tab)</a
            ><span v-else>{{ selected.dataset }}</span>
          </dd>
          <dt class="col-sm-3">Coordinates</dt>
          <dd class="col-sm-9">
            {{ selected.latitude.toFixed(5) }}, {{ selected.longitude.toFixed(5) }} (as published)
          </dd>
          <dt class="col-sm-3">Coordinate uncertainty</dt>
          <dd class="col-sm-9">
            {{
              selected.uncertaintyMetres === null
                ? 'Not supplied'
                : selected.uncertaintyMetres.toLocaleString() + ' metres'
            }}
          </dd>
          <dt class="col-sm-3">Licence</dt>
          <dd class="col-sm-9">
            {{ selected.license }} — see source for attribution and reuse terms.
          </dd>
        </dl>
        <p v-if="selected.generalized" class="small">
          The source flags generalized or withheld information. Do not treat this point as an exact
          plant location.
        </p>
        <a :href="selected.url" target="_blank" rel="noopener noreferrer" class="btn btn-primary"
          >Open source record on GBIF (new tab)</a
        >
      </div>
    </section>

    <section v-if="result" class="mt-5" aria-labelledby="record-list-heading">
      <h2 id="record-list-heading" class="h3">Observation records</h2>
      <p>
        The same {{ records.length }} loaded records as the map, with searchable columns and 10 rows
        per page. Select a record for its details and source.
      </p>
      <p v-if="result.meta.excluded" class="small">
        {{ result.meta.excluded }} returned records were excluded because their location/year was
        unusable or their GBIF ID was repeated.
      </p>
      <InteractiveTable
        id="map-records"
        caption="Loaded plant observations"
        :rows="records"
        :columns="recordColumns"
        initial-sort="eventDate"
        initial-direction="desc"
      >
        <template #cell-id="{ row }"
          ><button
            type="button"
            class="btn btn-outline-primary btn-sm"
            :aria-label="`View observation ${row.id}`"
            @click="showRecord(row.id)"
          >
            View record {{ row.id }}
          </button></template
        >
      </InteractiveTable>
    </section>
    <p class="small text-body-secondary mt-4">
      Observations: <a href="https://www.gbif.org/">GBIF and contributing datasets</a>. Each record
      retains its own licence and source. Map background: ©
      <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.
      <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a>.
    </p>
  </div>
</template>

<style scoped>
.plant-map-page .text-success {
  color: #24563f !important;
}
.plant-map-page .alert-info {
  color: #163f56;
  background-color: #e8f3fa;
  border-color: #b7d7eb;
}
.plant-map-page .alert-warning {
  color: #513b12;
  background-color: #fff4d6;
  border-color: #ddc58d;
}
.plant-map-page a:not(.btn) {
  color: #24563f;
}
.density-swatch {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 1px solid #653d36;
  vertical-align: middle;
}
.record-detail:focus {
  outline: 3px solid #244a96;
  outline-offset: 3px;
}
</style>
