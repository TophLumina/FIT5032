<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PlantCard from '@/components/PlantCard.vue'
import { usePlants } from '@/composables/usePlants'
import { formatLabel } from '@/utils/plantLabels'

const route = useRoute()
const router = useRouter()
const { plants, loading, error: loadError, loadPlants } = usePlants()
const pageSize = 9

const filterGroups = [
  {
    key: 'space',
    field: 'spaces',
    name: 'Space',
    values: [
      { value: 'balcony', label: 'Balcony' },
      { value: 'courtyard', label: 'Courtyard' },
      { value: 'school', label: 'School garden' },
    ],
  },
  {
    key: 'sunlight',
    field: 'sunlight',
    name: 'Sunlight',
    values: [
      { value: 'full-sun', label: 'Full sun' },
      { value: 'part-shade', label: 'Part shade' },
      { value: 'shade', label: 'Shade' },
    ],
  },
  {
    key: 'experience',
    field: 'difficulty',
    name: 'Difficulty',
    values: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
    ],
  },
  {
    key: 'benefit',
    field: 'biodiversity',
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

function readChoices(query = {}) {
  const choices = {
    q: String(query.q ?? '').trim(),
    sort: ['best', 'name-asc', 'name-desc'].includes(query.sort) ? query.sort : 'best',
  }
  for (const { key } of filterGroups) {
    const values = [query[key]]
      .flat()
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
    choices[key] = [
      ...new Set(
        values.flatMap((value) =>
          key === 'benefit' && value === 'pollinators' ? ['bees', 'butterflies'] : [value],
        ),
      ),
    ]
  }
  return choices
}

// The URL owns applied choices. Form edits take effect only when submitted.
const applied = computed(() => readChoices(route.query))
const draft = ref({})
watch(
  applied,
  (choices) => {
    draft.value = structuredClone(choices)
  },
  { immediate: true },
)

const sortedPlants = computed(() => {
  const term = applied.value.q.toLowerCase()
  const results = plants.value.filter((plant) => {
    const text = [
      plant.commonName,
      plant.scientificName,
      plant.status,
      ...filterGroups.flatMap(({ field }) => plant[field]),
    ]
      .join(' ')
      .toLowerCase()
    return (
      (!term || text.includes(term)) &&
      filterGroups.every(
        ({ key, field }) =>
          !applied.value[key].length ||
          applied.value[key].some((value) => [plant[field]].flat().includes(value)),
      )
    )
  })
  if (applied.value.sort === 'name-asc')
    return results.sort((a, b) => a.commonName.localeCompare(b.commonName))
  if (applied.value.sort === 'name-desc')
    return results.sort((a, b) => b.commonName.localeCompare(a.commonName))
  return results.sort((a, b) => Number(b.featured) - Number(a.featured))
})

const pageCount = computed(() => Math.max(1, Math.ceil(sortedPlants.value.length / pageSize)))
const currentPage = computed(() => {
  const page = Number(route.query.page)
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, pageCount.value) : 1
})
const firstResult = computed(() => (currentPage.value - 1) * pageSize)
const paginatedPlants = computed(() =>
  sortedPlants.value.slice(firstResult.value, firstResult.value + pageSize),
)
const activeChoices = computed(() => {
  const choices = filterGroups
    .flatMap(({ key }) => applied.value[key])
    .map((value) => valueLabels[value] ?? formatLabel(value))
  if (applied.value.q) choices.unshift(`“${applied.value.q}”`)
  return choices.join(' · ')
})

watch(
  [currentPage, loading, loadError, () => route.query.page],
  () => {
    if (route.name !== 'plants' || loading.value || loadError.value) return
    const page = currentPage.value > 1 ? String(currentPage.value) : undefined
    if (route.query.page !== page)
      router.replace({ name: 'plants', query: { ...route.query, page } })
  },
  { immediate: true },
)

function queryFor(choices, page = 1) {
  const query = {}
  if (choices.q.trim()) query.q = choices.q.trim()
  if (choices.sort !== 'best') query.sort = choices.sort
  for (const { key } of filterGroups) {
    if (choices[key].length) query[key] = choices[key].join(',')
  }
  if (page > 1) query.page = String(page)
  return query
}

function applyFilters() {
  router.push({ name: 'plants', query: queryFor(draft.value) })
}

function goToPage(page) {
  if (page >= 1 && page <= pageCount.value)
    router.push({ name: 'plants', query: queryFor(applied.value, page) })
}

function reset() {
  draft.value = readChoices()
  router.push({ name: 'plants' })
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
      <p class="text-body-secondary">
        Choose your conditions, then select Search or Apply filters.
      </p>
    </header>

    <form class="row g-2 mb-4" role="search" @submit.prevent="applyFilters">
      <div class="col-lg">
        <label class="visually-hidden" for="plant-search">Search by plant name</label>
        <input
          id="plant-search"
          v-model="draft.q"
          class="form-control form-control-lg"
          type="search"
          placeholder="Search by common or scientific name…"
        />
      </div>
      <div class="col-md-4 col-lg-3">
        <label class="visually-hidden" for="plant-sort">Sort results</label>
        <select id="plant-sort" v-model="draft.sort" class="form-select form-select-lg">
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
                  v-model="draft[group.key]"
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

        <template v-else>
          <p class="small text-body-secondary" role="status">
            Showing {{ firstResult + 1 }}–{{ firstResult + paginatedPlants.length }} of
            {{ sortedPlants.length }} plants · Page {{ currentPage }} of {{ pageCount }}
          </p>
          <div class="row g-3">
            <div v-for="plant in paginatedPlants" :key="plant.id" class="col-md-6 col-xl-4">
              <PlantCard :plant="plant" />
            </div>
          </div>
          <nav v-if="pageCount > 1" class="mt-4" aria-label="Plant results pages">
            <ul class="pagination flex-wrap justify-content-center mb-0">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <button
                  class="page-link"
                  type="button"
                  :disabled="currentPage === 1"
                  @click="goToPage(currentPage - 1)"
                >
                  Previous
                </button>
              </li>
              <li
                v-for="number in pageCount"
                :key="number"
                class="page-item"
                :class="{ active: number === currentPage }"
              >
                <button
                  class="page-link"
                  type="button"
                  :aria-label="`Page ${number}`"
                  :aria-current="number === currentPage ? 'page' : undefined"
                  @click="goToPage(number)"
                >
                  {{ number }}
                </button>
              </li>
              <li class="page-item" :class="{ disabled: currentPage === pageCount }">
                <button
                  class="page-link"
                  type="button"
                  :disabled="currentPage === pageCount"
                  @click="goToPage(currentPage + 1)"
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </template>
      </section>
    </div>
  </div>
</template>
