<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { clipBounds, densityCells, initialBounds, mapExtent } from '../../shared/mapQuery.js'

const props = defineProps({
  records: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  loadingLabel: { type: String, default: 'Loading plant observations…' },
  mode: { type: String, default: 'points' },
  targetBounds: { type: Array, default: () => initialBounds },
  selectedId: { type: String, default: '' },
  place: { type: Object, default: null },
  queriedBounds: { type: Array, default: null },
})
const emit = defineEmits(['bounds-change', 'select'])
const element = ref(null)
const tileError = ref(false)
let map, dataLayer, placeLayer, observer
const toLeafletBounds = (bbox) => [
  [bbox[1], bbox[0]],
  [bbox[3], bbox[2]],
]
const colorFor = (count) =>
  count >= 10 ? '#7a183e' : count >= 5 ? '#bc3754' : count >= 2 ? '#d67b43' : '#f1c879'

function publishBounds() {
  const bounds = map.getBounds()
  emit(
    'bounds-change',
    clipBounds([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]),
  )
}

function redraw() {
  if (!map) return
  dataLayer.clearLayers()
  if (props.queriedBounds)
    L.rectangle(toLeafletBounds(props.queriedBounds), {
      color: '#3d4873',
      dashArray: '6 4',
      fill: false,
      weight: 2,
      interactive: false,
    }).addTo(dataLayer)
  if (props.mode === 'density') {
    for (const cell of densityCells(props.records)) {
      const text = document.createElement('span')
      text.textContent = `${cell.count} loaded observation records in this approximately 1 km cell`
      L.rectangle(toLeafletBounds(cell.bounds), {
        color: '#713229',
        weight: 1,
        fillColor: colorFor(cell.count),
        fillOpacity: 0.65,
      })
        .bindTooltip(text)
        .addTo(dataLayer)
    }
  } else {
    for (const record of props.records) {
      const selected = props.selectedId === record.id
      const text = document.createElement('span')
      text.textContent = `${record.scientificName} · ${record.eventDate}`
      L.circleMarker([record.latitude, record.longitude], {
        radius: selected ? 9 : 5,
        color: selected ? '#111827' : '#14543b',
        weight: selected ? 3 : 1,
        fillColor: selected ? '#f6c34a' : '#18865e',
        fillOpacity: 0.75,
      })
        .bindTooltip(text)
        .on('click', () => emit('select', record.id))
        .addTo(dataLayer)
    }
  }
}

function showPlace() {
  if (!map) return
  placeLayer.clearLayers()
  if (!props.place) return
  const text = document.createElement('span')
  text.textContent = props.place.name
  L.circleMarker([props.place.latitude, props.place.longitude], {
    color: '#244a96',
    weight: 3,
    radius: 9,
    fillOpacity: 0.15,
  })
    .bindTooltip(text, { permanent: true, direction: 'top' })
    .addTo(placeLayer)
}

onMounted(() => {
  map = L.map(element.value, {
    maxBounds: toLeafletBounds(mapExtent),
    maxBoundsViscosity: 1,
    minZoom: 8,
    maxZoom: 17,
    scrollWheelZoom: false,
    keyboard: true,
  })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    // Browser HTTP caching is retained. Only visible tiles are requested; no offline prefetch.
    updateWhenIdle: true,
  })
    .on('tileerror', () => {
      tileError.value = true
    })
    .addTo(map)
  dataLayer = L.layerGroup().addTo(map)
  placeLayer = L.layerGroup().addTo(map)
  map.on('moveend', publishBounds)
  map.fitBounds(toLeafletBounds(props.targetBounds), { animate: false })
  redraw()
  showPlace()
  observer = new ResizeObserver(() => map?.invalidateSize({ pan: false }))
  observer.observe(element.value)
})

watch(() => [props.records, props.mode, props.selectedId, props.queriedBounds], redraw)
watch(
  () => props.targetBounds,
  (bounds) => map?.fitBounds(toLeafletBounds(bounds), { animate: false }),
)
watch(() => props.place, showPlace)
watch(
  () => props.selectedId,
  (id) => {
    const record = props.records.find((record) => record.id === id)
    if (record && map && !map.getBounds().contains([record.latitude, record.longitude]))
      map.panTo([record.latitude, record.longitude], { animate: false })
  },
)
onBeforeUnmount(() => {
  observer?.disconnect()
  map?.remove()
  map = null
})
</script>

<template>
  <div>
    <div class="map-frame">
      <div
        ref="element"
        class="observation-map rounded border"
        role="region"
        aria-label="Melbourne plant observation map"
        aria-describedby="map-keyboard-help"
        :aria-busy="loading"
        tabindex="0"
      ></div>
      <div class="map-loading" role="status" aria-atomic="true">
        <div v-if="loading" class="map-loading-card">
          <span class="spinner-border map-loading-spinner" aria-hidden="true"></span>
          <p class="fw-bold mb-1">{{ loadingLabel }}</p>
          <p class="small mb-0">
            Fetching records and preparing the map. This may take a few seconds.
          </p>
        </div>
      </div>
    </div>
    <p v-if="tileError" class="alert alert-warning mt-2" role="alert">
      Some background map tiles could not load. Observation records and the list below are still
      available.
    </p>
    <p id="map-keyboard-help" class="small text-body-secondary mt-2 mb-0">
      Use the +/− controls to zoom. Focus the map and use arrow keys to pan, or drag it with a
      pointer. Select “Search this area” after moving. The dashed outline marks the last searched
      area. Every loaded observation is also available in the record list.
    </p>
  </div>
</template>

<style scoped>
.map-frame {
  position: relative;
  isolation: isolate;
}
.map-loading {
  position: absolute;
  inset: 3.5rem 1rem;
  z-index: 1;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.map-loading-card {
  width: min(100%, 22rem);
  padding: 1.5rem;
  border: 1px solid #a7b9ad;
  border-radius: 0.75rem;
  color: #234832;
  background: #fff;
  box-shadow: 0 0.5rem 1.5rem rgb(30 55 40 / 16%);
  text-align: center;
}
.map-loading-spinner {
  width: 2rem;
  height: 2rem;
  margin-bottom: 0.75rem;
}
.observation-map {
  height: clamp(22rem, 58vh, 38rem);
  width: 100%;
  z-index: 0;
  background: #e9eee8;
}
.observation-map:focus-visible {
  outline: 3px solid #244a96;
  outline-offset: 3px;
}
.observation-map :deep(.leaflet-control-attribution a) {
  color: #184d40;
}
@media (prefers-reduced-motion: reduce) {
  .map-loading-spinner {
    animation: none;
  }
  .observation-map :deep(*) {
    transition: none !important;
  }
}
</style>
