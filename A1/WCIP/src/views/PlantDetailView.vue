<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CommentSection from '@/components/CommentSection.vue'
import PhotoCredit from '@/components/PhotoCredit.vue'

const route = useRoute()
const plant = ref(null)
const loading = ref(true)
const loadError = ref('')

const tags = computed(() => {
  if (!plant.value) return []

  return [
    `${formatLabel(plant.value.status)} plant`,
    formatLabel(plant.value.difficulty),
    ...plant.value.biodiversity.map(formatLabel),
  ]
})

const facts = computed(() => {
  if (!plant.value) return []

  return [
    ['Sunlight', joinLabels(plant.value.sunlight)],
    ['Water', formatLabel(plant.value.water)],
    ['Difficulty', formatLabel(plant.value.difficulty)],
    ['Spaces', joinLabels(plant.value.spaces)],
  ]
})

const summary = computed(() => {
  if (!plant.value) return ''

  return `${plant.value.commonName} is a ${formatLabel(plant.value.status).toLowerCase()} plant suited to ${joinLabels(plant.value.spaces).toLowerCase()} settings with ${joinLabels(plant.value.sunlight).toLowerCase()}.`
})

const suitabilityText = computed(() => {
  if (!plant.value) return ''

  return [
    `Spaces: ${joinLabels(plant.value.spaces)}`,
    `Light: ${joinLabels(plant.value.sunlight)}`,
    `${formatLabel(plant.value.difficulty)} care`,
  ].join(' · ')
})

const growSteps = computed(() => {
  if (!plant.value) return []

  return [
    [
      'Choose a position',
      `Select a ${joinLabels(plant.value.spaces).toLowerCase()} location with ${joinLabels(plant.value.sunlight).toLowerCase()}.`,
    ],
    [
      'Prepare the planting area',
      'Use a free-draining native potting mix or well-prepared garden soil.',
    ],
    [
      'Set a watering routine',
      `Start with a ${formatLabel(plant.value.water).toLowerCase()}-water routine and adjust for weather and container size.`,
    ],
    [
      'Observe garden visitors',
      `Watch for ${joinLabels(plant.value.biodiversity).toLowerCase()} and record seasonal changes.`,
    ],
  ]
})

const biodiversityText = computed(() => {
  if (!plant.value) return ''
  return `This plant can contribute food or shelter for ${joinLabels(plant.value.biodiversity).toLowerCase()} in an urban garden.`
})

watch(
  () => route.params.slug,
  () => loadPlant(),
  { immediate: true },
)

async function loadPlant() {
  loading.value = true
  loadError.value = ''
  plant.value = null

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/plants.json`)
    if (!response.ok) throw new Error(`Plant data request failed with status ${response.status}.`)

    const data = await response.json()
    if (!Array.isArray(data)) throw new TypeError('Plant data must be an array.')

    const match = data.find((item) => item.slug === route.params.slug)
    if (!match) throw new Error('This plant could not be found in the plant data.')

    plant.value = match
    document.title = `${match.commonName} | What Can I Plant?`
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Plant data could not be loaded.'
  } finally {
    loading.value = false
  }
}

function formatLabel(value) {
  return String(value)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function joinLabels(values) {
  return values.map(formatLabel).join(' / ')
}
</script>

<template>
  <div class="container-xxl py-5">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><RouterLink :to="{ name: 'home' }">Home</RouterLink></li>
        <li class="breadcrumb-item">
          <RouterLink :to="{ name: 'plants' }">Plant Finder</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">
          {{ plant?.commonName ?? 'Plant details' }}
        </li>
      </ol>
    </nav>

    <div v-if="loading" class="d-flex align-items-center gap-3 py-5" role="status">
      <span class="spinner-border text-primary" aria-hidden="true"></span>
      <span>Loading plant details…</span>
    </div>

    <div v-else-if="loadError" class="alert alert-danger" role="alert">
      <h1 class="h3">Plant details unavailable</h1>
      <p>{{ loadError }}</p>
      <RouterLink class="btn btn-outline-danger" :to="{ name: 'plants' }">
        Return to Plant Finder
      </RouterLink>
    </div>

    <template v-else-if="plant">
      <div class="row g-4 mb-4">
        <section class="col-lg-5">
          <div class="card h-100">
            <div class="card-body p-4">
              <p class="small fw-bold text-success text-uppercase">Plant gallery</p>
              <div class="ratio ratio-4x3 overflow-hidden rounded">
                <img
                  :src="plant.image"
                  :alt="plant.imageAlt"
                  class="h-100 w-100 object-fit-cover"
                />
              </div>
              <PhotoCredit :credit="plant.imageCredit" />
            </div>
          </div>
        </section>

        <section class="col-lg-7">
          <div class="card h-100">
            <div class="card-body p-4 p-xl-5 d-flex flex-column align-items-start">
              <p class="small fw-bold text-success text-uppercase">Plant summary</p>
              <div class="d-flex flex-wrap gap-2">
                <span v-for="tag in tags" :key="tag" class="badge rounded-pill text-bg-success">
                  {{ tag }}
                </span>
              </div>
              <h1 class="display-4 fw-bold mt-4 mb-1">{{ plant.commonName }}</h1>
              <p class="fs-5 fst-italic">{{ plant.scientificName }}</p>
              <p class="lead">{{ summary }}</p>
              <div class="row g-2 w-100 my-3">
                <div v-for="fact in facts" :key="fact[0]" class="col-6 col-xl-3">
                  <div class="border rounded p-3 h-100">
                    <strong class="d-block small text-uppercase text-success">{{ fact[0] }}</strong>
                    <span class="small">{{ fact[1] }}</span>
                  </div>
                </div>
              </div>
              <a class="btn btn-primary ms-auto" href="#sources">Where to find it →</a>
            </div>
          </div>
        </section>
      </div>

      <section
        class="alert alert-success d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 p-4"
        role="region"
        aria-labelledby="suitability-title"
      >
        <div>
          <p class="small fw-bold text-success-emphasis text-uppercase mb-1">Plant data profile</p>
          <h2 id="suitability-title" class="h3">Is this plant right for me?</h2>
        </div>
        <p class="mb-0">{{ suitabilityText }}</p>
        <RouterLink class="btn btn-outline-success" :to="{ name: 'plants' }">
          Change my conditions
        </RouterLink>
      </section>

      <div class="row g-4">
        <section class="col-lg-8">
          <div class="card h-100">
            <div class="card-body p-4">
              <p class="small fw-bold text-success text-uppercase">Grow instructions</p>
              <h2>How to grow {{ plant.commonName }}</h2>
              <div class="row g-4">
                <div v-for="(step, index) in growSteps" :key="step[0]" class="col-md-6">
                  <div class="d-flex gap-3">
                    <span class="badge text-bg-success fs-6 align-self-start p-3">
                      {{ index + 1 }}
                    </span>
                    <span>
                      <strong class="d-block">{{ step[0] }}</strong>
                      <small>{{ step[1] }}</small>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="col-lg-4 d-flex flex-column gap-4">
          <section class="card">
            <div class="card-body">
              <p class="small fw-bold text-success text-uppercase">Biodiversity value</p>
              <h2 class="h4">Biodiversity value</h2>
              <p>{{ biodiversityText }}</p>
            </div>
          </section>
          <section id="sources" class="card">
            <div class="card-body">
              <p class="small fw-bold text-success text-uppercase">Plant sources</p>
              <h2 class="h4">Where to find it</h2>
              <p>
                Ask local native nurseries for <em>{{ plant.scientificName }}</em
                >. Availability may vary.
              </p>
              <RouterLink class="btn btn-outline-primary" :to="{ name: 'about' }">
                Contact us
              </RouterLink>
            </div>
          </section>
        </aside>
      </div>

      <section class="mt-5" aria-labelledby="related-guides">
        <h2 id="related-guides" class="h4">Related guides</h2>
        <div class="row g-3">
          <div
            v-for="item in [
              {
                title: 'Build a Pollinator Pot',
                detail: 'Family gardening · 25 min',
                to: { name: 'guide-detail' },
              },
              {
                title: 'Browse gardening guides',
                detail: 'Practical projects for small spaces',
                to: { name: 'guides' },
              },
              {
                title: 'Compare suitable plants',
                detail: 'Return to the filtered plant list',
                to: { name: 'plants' },
              },
            ]"
            :key="item.title"
            class="col-md-4"
          >
            <RouterLink class="card card-hover h-100 text-decoration-none" :to="item.to">
              <div class="card-body">
                <strong>{{ item.title }}</strong>
                <small class="d-block">{{ item.detail }}</small>
              </div>
            </RouterLink>
          </div>
        </div>
      </section>

      <CommentSection content-type="plant" :content-slug="plant.slug" />
    </template>
  </div>
</template>
