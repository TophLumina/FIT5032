<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PhotoCredit from '@/components/PhotoCredit.vue'

const route = useRoute()
const router = useRouter()

const plants = ref([])
const loading = ref(true)
const loadError = ref('')
const searchTerm = ref('')
const sortBy = ref('best')

const filters = reactive({
  space: [],
  sunlight: [],
  difficulty: [],
  biodiversity: [],
})

const filterGroups = [
  {
    key: 'space',
    name: 'Space',
    values: [
      { value: 'balcony', label: 'Balcony' },
      { value: 'courtyard', label: 'Courtyard' },
      { value: 'school', label: 'School garden' },
    ],
  },
  {
    key: 'sunlight',
    name: 'Sunlight',
    values: [
      { value: 'full-sun', label: 'Full sun' },
      { value: 'part-shade', label: 'Part shade' },
      { value: 'shade', label: 'Shade' },
    ],
  },
  {
    key: 'difficulty',
    name: 'Difficulty',
    values: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
    ],
  },
  {
    key: 'biodiversity',
    name: 'Biodiversity benefit',
    values: [
      { value: 'bees', label: 'Bees' },
      { value: 'birds', label: 'Birds' },
      { value: 'butterflies', label: 'Butterflies' },
    ],
  },
]

const valueLabels = Object.fromEntries(
  filterGroups.flatMap((group) => group.values.map((option) => [option.value, option.label])),
)

const filteredPlants = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  return plants.value.filter((plant) => {
    const searchableText = [
      plant.commonName,
      plant.scientificName,
      plant.status,
      plant.difficulty,
      ...plant.spaces,
      ...plant.sunlight,
      ...plant.biodiversity,
    ]
      .join(' ')
      .toLowerCase()

    const matchesSearch = !term || searchableText.includes(term)
    const matchesSpace =
      filters.space.length === 0 || filters.space.some((value) => plant.spaces.includes(value))
    const matchesSunlight =
      filters.sunlight.length === 0 ||
      filters.sunlight.some((value) => plant.sunlight.includes(value))
    const matchesDifficulty =
      filters.difficulty.length === 0 || filters.difficulty.includes(plant.difficulty)
    const matchesBiodiversity =
      filters.biodiversity.length === 0 ||
      filters.biodiversity.some((value) => plant.biodiversity.includes(value))

    return (
      matchesSearch && matchesSpace && matchesSunlight && matchesDifficulty && matchesBiodiversity
    )
  })
})

const sortedPlants = computed(() => {
  const results = [...filteredPlants.value]

  if (sortBy.value === 'name-asc') {
    return results.sort((a, b) => a.commonName.localeCompare(b.commonName))
  }

  if (sortBy.value === 'name-desc') {
    return results.sort((a, b) => b.commonName.localeCompare(a.commonName))
  }

  return results.sort((a, b) => Number(b.featured) - Number(a.featured))
})

const activeChoices = computed(() => {
  const choices = Object.values(filters)
    .flat()
    .map((value) => valueLabels[value] ?? formatLabel(value))

  if (searchTerm.value.trim()) choices.unshift(`“${searchTerm.value.trim()}”`)
  return choices.join(' · ')
})

watch(
  () => route.query,
  () => syncFromRoute(),
  { deep: true, immediate: true },
)

onMounted(loadPlants)

async function loadPlants() {
  loading.value = true
  loadError.value = ''

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/plants.json`)
    if (!response.ok) throw new Error(`Plant data request failed with status ${response.status}.`)

    const data = await response.json()
    if (!Array.isArray(data)) throw new TypeError('Plant data must be an array.')
    plants.value = data
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Plant data could not be loaded.'
  } finally {
    loading.value = false
  }
}

function parseQueryValues(value) {
  const values = Array.isArray(value) ? value : [value]
  return values.filter(Boolean).flatMap((item) => String(item).split(','))
}

function syncFromRoute() {
  searchTerm.value = String(route.query.q ?? '')
  sortBy.value = ['best', 'name-asc', 'name-desc'].includes(route.query.sort)
    ? route.query.sort
    : 'best'
  filters.space = parseQueryValues(route.query.space)
  filters.sunlight = parseQueryValues(route.query.sunlight)
  filters.difficulty = parseQueryValues(route.query.experience)

  const benefits = parseQueryValues(route.query.benefit)
  filters.biodiversity = benefits.includes('pollinators')
    ? [...new Set([...benefits.filter((value) => value !== 'pollinators'), 'bees', 'butterflies'])]
    : benefits
}

function applyFilters() {
  const query = {}
  if (searchTerm.value.trim()) query.q = searchTerm.value.trim()
  if (filters.space.length) query.space = filters.space.join(',')
  if (filters.sunlight.length) query.sunlight = filters.sunlight.join(',')
  if (filters.difficulty.length) query.experience = filters.difficulty.join(',')
  if (filters.biodiversity.length) query.benefit = filters.biodiversity.join(',')
  if (sortBy.value !== 'best') query.sort = sortBy.value
  router.push({ name: 'plants', query })
}

function reset() {
  searchTerm.value = ''
  sortBy.value = 'best'
  Object.keys(filters).forEach((key) => {
    filters[key] = []
  })
  router.push({ name: 'plants' })
}

function formatLabel(value) {
  return String(value)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
</script>

<template>
  <div class="container-xxl py-5">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><RouterLink :to="{ name: 'home' }">Home</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">Plant Finder</li>
      </ol>
    </nav>
    <header class="mb-4">
      <p class="small fw-bold text-success text-uppercase mb-1">Plant finder</p>
      <h1 class="display-4 fw-bold">Find plants for your space</h1>
      <p class="lead">Filter practical, responsible choices for Melbourne gardens.</p>
    </header>

    <form class="row g-2 mb-4" role="search" @submit.prevent="applyFilters">
      <div class="col-lg">
        <label class="visually-hidden" for="plant-search">Search by plant name</label>
        <input
          id="plant-search"
          v-model="searchTerm"
          class="form-control form-control-lg"
          type="search"
          placeholder="Search by common or scientific name…"
        />
      </div>
      <div class="col-md-4 col-lg-3">
        <label class="visually-hidden" for="plant-sort">Sort results</label>
        <select
          id="plant-sort"
          v-model="sortBy"
          class="form-select form-select-lg"
          @change="applyFilters"
        >
          <option value="best">Sort: Best match</option>
          <option value="name-asc">Name: A–Z</option>
          <option value="name-desc">Name: Z–A</option>
        </select>
      </div>
      <div class="col-6 col-md-auto d-grid">
        <button class="btn btn-primary" type="submit">Search</button>
      </div>
      <div class="col-6 col-md-auto d-grid">
        <button class="btn btn-outline-primary" type="button" @click="reset">Reset</button>
      </div>
    </form>

    <div class="row g-4 align-items-start">
      <aside class="col-lg-3">
        <div class="card sticky-lg-top sticky-filter">
          <div class="card-body">
            <p class="small fw-bold text-success text-uppercase mb-1">Plant filters</p>
            <h2 class="h4">Filters</h2>
            <fieldset v-for="group in filterGroups" :key="group.key" class="border-top pt-3 mt-3">
              <legend class="fs-6 fw-bold">{{ group.name }}</legend>
              <div v-for="option in group.values" :key="option.value" class="form-check">
                <input
                  :id="`${group.key}-${option.value}`"
                  v-model="filters[group.key]"
                  :value="option.value"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label" :for="`${group.key}-${option.value}`">
                  {{ option.label }}
                </label>
              </div>
            </fieldset>
            <button class="btn btn-primary w-100 mt-3" type="button" @click="applyFilters">
              Apply filters
            </button>
          </div>
        </div>
      </aside>

      <section class="col-lg-9" aria-labelledby="results-title" aria-live="polite">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
          <h2 id="results-title" class="h4 mb-0">
            {{ sortedPlants.length }}
            {{ sortedPlants.length === 1 ? 'plant matches' : 'plants match' }}
            your choices
          </h2>
          <span v-if="activeChoices" class="text-body-secondary">{{ activeChoices }}</span>
        </div>

        <div v-if="loading" class="d-flex align-items-center gap-3 py-5" role="status">
          <span class="spinner-border text-primary" aria-hidden="true"></span>
          <span>Loading plant data…</span>
        </div>

        <div v-else-if="loadError" class="alert alert-danger" role="alert">
          <h3 class="h5">Plant data could not be loaded</h3>
          <p>{{ loadError }}</p>
          <button class="btn btn-outline-danger" type="button" @click="loadPlants">
            Try again
          </button>
        </div>

        <div v-else-if="sortedPlants.length === 0" class="alert alert-info" role="status">
          No plants match these choices. Try removing a filter or resetting the search.
        </div>

        <div v-else class="row g-3">
          <div v-for="plant in sortedPlants" :key="plant.id" class="col-md-6 col-xl-4">
            <article class="card card-hover h-100">
              <div class="card-body">
                <div class="ratio ratio-4x3 overflow-hidden rounded">
                  <img
                    :src="plant.image"
                    :alt="plant.imageAlt"
                    class="h-100 w-100 object-fit-cover"
                    loading="lazy"
                  />
                </div>
                <PhotoCredit :credit="plant.imageCredit" />
                <span class="badge text-bg-success mb-2">
                  {{ formatLabel(plant.status) }} · {{ formatLabel(plant.difficulty) }}
                </span>
                <h3 class="h5">
                  <RouterLink
                    class="stretched-link text-decoration-none"
                    :to="{ name: 'plant-detail', params: { slug: plant.slug } }"
                  >
                    {{ plant.commonName }}
                  </RouterLink>
                </h3>
                <em class="small text-body-secondary">{{ plant.scientificName }}</em>
                <p class="small border-top pt-3 mt-3 mb-2">
                  {{ plant.sunlight.map(formatLabel).join(' / ') }} ·
                  {{ formatLabel(plant.water) }} water
                </p>
                <p class="small text-body-secondary mb-2">
                  {{ plant.spaces.map(formatLabel).join(' / ') }}
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
