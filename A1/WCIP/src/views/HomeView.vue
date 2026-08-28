<script setup>
import { onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PhotoCredit from '@/components/PhotoCredit.vue'

const router = useRouter()
const choices = reactive({ space: '', sunlight: '', experience: 'beginner' })

const spaces = [
  { title: 'Balcony', detail: 'Container-friendly · wind aware', query: 'balcony' },
  { title: 'Courtyard', detail: 'Shade options · compact growth', query: 'courtyard' },
  { title: 'School Garden', detail: 'Durable · learning focused', query: 'school' },
]

const seasonalPlants = ref([])
const seasonalLoadError = ref('')
const seasonalSlugs = ['native-violet', 'coastal-rosemary', 'silver-banksia']

onMounted(loadSeasonalPlants)

async function loadSeasonalPlants() {
  seasonalLoadError.value = ''

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/plants.json`)
    if (!response.ok) throw new Error(`Plant data request failed with status ${response.status}.`)

    const data = await response.json()
    if (!Array.isArray(data)) throw new TypeError('Plant data must be an array.')

    seasonalPlants.value = seasonalSlugs
      .map((slug) => data.find((plant) => plant.slug === slug))
      .filter(Boolean)
  } catch {
    seasonalLoadError.value = 'Seasonal plant data could not be loaded.'
  }
}

function findPlants() {
  const query = Object.fromEntries(Object.entries(choices).filter(([, value]) => value))
  router.push({ name: 'plants', query })
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
    <section class="hero-surface card border-0 shadow-sm p-4 p-lg-5 mb-5">
      <div class="row align-items-center g-5">
        <div class="col-lg-6">
          <span class="badge rounded-pill text-bg-success mb-3">Melbourne · Beginner friendly</span>
          <h1 class="display-3 fw-bold">What can I plant?</h1>
          <p class="lead mb-0">Find practical plants for your space, sunlight and experience.</p>
        </div>

        <form class="col-lg-6" @submit.prevent="findPlants">
          <h2 class="h5 mb-3">Start with three quick choices</h2>
          <div class="row g-3">
            <div class="col-sm-6">
              <label class="visually-hidden" for="home-space">Space</label>
              <select id="home-space" v-model="choices.space" class="form-select">
                <option value="">Space: choose one</option>
                <option value="balcony">Balcony</option>
                <option value="courtyard">Courtyard</option>
                <option value="school">School garden</option>
              </select>
            </div>
            <div class="col-sm-6">
              <label class="visually-hidden" for="home-sunlight">Sunlight</label>
              <select id="home-sunlight" v-model="choices.sunlight" class="form-select">
                <option value="">Sunlight: choose one</option>
                <option value="full-sun">Full sun</option>
                <option value="part-shade">Part shade</option>
                <option value="shade">Shade</option>
              </select>
            </div>
            <div class="col-sm-6">
              <label class="visually-hidden" for="home-experience">Experience</label>
              <select id="home-experience" v-model="choices.experience" class="form-select">
                <option value="beginner">Experience: beginner</option>
                <option value="intermediate">Experience: intermediate</option>
              </select>
            </div>
            <div class="col-sm-6 d-grid">
              <button class="btn btn-primary" type="submit">Find plants →</button>
            </div>
          </div>
          <RouterLink class="d-inline-block mt-3" :to="{ name: 'plants' }"
            >Browse all plants</RouterLink
          >
        </form>
      </div>
    </section>

    <section class="mb-5" aria-labelledby="space-title">
      <p class="small fw-bold text-success text-uppercase mb-1">Choose a starting point</p>
      <h2 id="space-title" class="mb-4">Start with your space</h2>
      <div class="row g-3">
        <div v-for="space in spaces" :key="space.title" class="col-md-4">
          <RouterLink
            class="card card-hover h-100 text-decoration-none"
            :to="{ name: 'plants', query: { space: space.query } }"
          >
            <div class="card-body d-flex gap-3 align-items-center">
              <span class="badge text-bg-success p-3">Space</span>
              <span
                ><strong class="d-block fs-5">{{ space.title }}</strong
                ><small class="text-body-secondary">{{ space.detail }}</small
                ><span class="d-block mt-2">Explore →</span></span
              >
            </div>
          </RouterLink>
        </div>
      </div>
    </section>

    <div class="row g-4 mb-5">
      <section class="col-lg-8" aria-labelledby="seasonal-title">
        <div class="card h-100">
          <div class="card-body p-4">
            <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
              <div>
                <p class="small fw-bold text-success text-uppercase mb-1">Seasonal plants</p>
                <h2 id="seasonal-title">Seasonal plants for Melbourne</h2>
              </div>
              <small>Late winter / early spring picks</small>
            </div>
            <div v-if="seasonalLoadError" class="alert alert-warning" role="alert">
              {{ seasonalLoadError }}
            </div>
            <div class="row g-3">
              <div v-for="plant in seasonalPlants" :key="plant.id" class="col-md-4">
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
                    <strong class="d-block mt-2">
                      <RouterLink
                        class="stretched-link text-decoration-none"
                        :to="{ name: 'plant-detail', params: { slug: plant.slug } }"
                      >
                        {{ plant.commonName }}
                      </RouterLink>
                    </strong>
                    <small class="d-block text-body-secondary mb-2">
                      {{ plant.sunlight.map(formatLabel).join(' / ') }} ·
                      {{ formatLabel(plant.difficulty) }}
                    </small>
                    <span class="badge text-bg-light border">
                      {{ plant.biodiversity.map(formatLabel).join(' / ') }}
                    </span>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="col-lg-4" aria-labelledby="learn-title">
        <div class="card h-100">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase mb-1">Learning resources</p>
            <h2 id="learn-title">Learn by doing</h2>
            <div class="list-group">
              <RouterLink
                class="list-group-item list-group-item-action py-3"
                :to="{ name: 'guide-detail' }"
                ><strong>Build a Pollinator Pot</strong
                ><small class="d-block">25 min · Family friendly</small></RouterLink
              >
              <RouterLink
                class="list-group-item list-group-item-action py-3"
                :to="{ name: 'guides' }"
                ><strong>Starting a School Garden</strong
                ><small class="d-block">Teacher guide · Printable steps</small></RouterLink
              >
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
