<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CommentSection from '@/components/CommentSection.vue'
import PhotoCredit from '@/components/PhotoCredit.vue'
import { getGuide } from '@/services/content'

const route = useRoute()
const guide = ref(null)
const loading = ref(true)
const error = ref('')
watch(
  () => route.params.slug,
  async (slug, _previous, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    loading.value = true
    error.value = ''
    guide.value = null
    try {
      const result = await getGuide(slug)
      if (!active) return
      if (!result) throw new Error('Guide not found.')
      guide.value = result
      document.title = `${result.title} | What Can I Plant?`
    } catch {
      if (active) error.value = 'This guide could not be loaded. Please try again.'
    } finally {
      if (active) loading.value = false
    }
  },
  { immediate: true },
)

function printPage() {
  window.print()
}
</script>

<template>
  <div class="container-xxl py-5">
    <p v-if="loading" role="status">Loading guide…</p>
    <p v-else-if="error" class="alert alert-warning" role="alert">{{ error }}</p>
    <template v-else-if="guide">
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item">
            <RouterLink :to="{ name: 'guides' }">Gardening Guides</RouterLink>
          </li>
          <li class="breadcrumb-item">{{ guide.category }}</li>
          <li class="breadcrumb-item active" aria-current="page">{{ guide.title }}</li>
        </ol>
      </nav>
      <header
        class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4"
      >
        <div>
          <p class="small fw-bold text-success text-uppercase mb-1">{{ guide.eyebrow }}</p>
          <h1 class="display-4 fw-bold">{{ guide.title }}</h1>
          <p class="lead mb-0">{{ guide.description }}</p>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <span v-for="tag in guide.tags" :key="tag" class="badge rounded-pill text-bg-success">{{
            tag
          }}</span>
        </div>
      </header>

      <div class="row g-4 mb-4">
        <section class="col-lg-5">
          <div class="card h-100">
            <div class="card-body p-4">
              <p class="small fw-bold text-success text-uppercase">Guide hero</p>
              <div class="ratio ratio-4x3 overflow-hidden rounded">
                <img
                  :src="guide.image.src"
                  :alt="guide.image.alt"
                  class="h-100 w-100 object-fit-cover"
                />
              </div>
              <PhotoCredit :credit="guide.image.credit" />
            </div>
          </div>
        </section>
        <section class="col-lg-7">
          <div class="card h-100">
            <div class="card-body p-4">
              <p class="small fw-bold text-success text-uppercase">Materials list</p>
              <h2>What you’ll need</h2>
              <div class="row g-2 mb-3">
                <div v-for="material in guide.materials" :key="material" class="col-md-6">
                  <div class="border rounded p-3">□ {{ material }}</div>
                </div>
              </div>
              <small>{{ guide.beforeStart }}</small>
            </div>
          </div>
        </section>
      </div>

      <div class="row g-4">
        <section class="col-lg-8">
          <div class="card h-100">
            <div class="card-body p-4">
              <p class="small fw-bold text-success text-uppercase">Numbered steps</p>
              <h2>Step by step</h2>
              <ol class="list-group list-group-flush list-unstyled">
                <li
                  v-for="(step, index) in guide.steps"
                  :key="step.title"
                  class="list-group-item px-0 py-3 d-flex gap-3"
                >
                  <span class="badge text-bg-success fs-6 align-self-start p-3"
                    >0{{ index + 1 }}</span
                  ><span
                    ><strong class="d-block">{{ step.title }}</strong
                    ><small>{{ step.description }}</small></span
                  >
                </li>
              </ol>
            </div>
          </div>
        </section>
        <aside class="col-lg-4 d-flex flex-column gap-4">
          <section class="card">
            <div class="card-body">
              <p class="small fw-bold text-success text-uppercase">Recommended plants</p>
              <h2 class="h4">Recommended plants</h2>
              <ul class="list-group list-group-flush mb-3">
                <li
                  v-for="plant in guide.recommendedPlants"
                  :key="plant.slug"
                  class="list-group-item px-0"
                >
                  <RouterLink :to="{ name: 'plant-detail', params: { slug: plant.slug } }">{{
                    plant.label
                  }}</RouterLink>
                </li>
              </ul>
              <RouterLink
                class="btn btn-outline-primary w-100"
                :to="{ name: 'plants', query: { benefit: 'pollinators' } }"
                >Compare plants</RouterLink
              >
            </div>
          </section>
          <section class="alert alert-success mb-0">
            <p class="small fw-bold text-success-emphasis text-uppercase">Learning prompt</p>
            <h2 class="h4">{{ guide.learningTitle }}</h2>
            <p>
              {{ guide.learningPrompt }}
            </p>
            <button class="btn btn-outline-success no-print" type="button" @click="printPage">
              Print activity sheet
            </button>
          </section>
        </aside>
      </div>

      <RouterLink class="btn btn-outline-primary mt-4" :to="{ name: 'guides' }"
        >Browse all guides</RouterLink
      >

      <CommentSection :key="guide.slug" content-type="guide" :content-slug="guide.slug" />
    </template>
  </div>
</template>
