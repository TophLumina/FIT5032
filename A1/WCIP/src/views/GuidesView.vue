<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PhotoCredit from '@/components/PhotoCredit.vue'
import { getGuides } from '@/services/content'

const guides = ref([])
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try {
    guides.value = await getGuides()
  } catch {
    error.value = 'Guides could not be loaded. Please refresh to try again.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container-xxl py-5">
    <section class="hero-surface rounded-4 p-4 p-lg-5 mb-4">
      <p class="small fw-bold text-success text-uppercase">Gardening guides</p>
      <h1 class="display-4 fw-bold">Practical guides for growing well</h1>
      <p class="lead">Explore projects for your garden, home or classroom.</p>
    </section>
    <p v-if="loading" role="status">Loading guides…</p>
    <p v-else-if="error" class="alert alert-warning" role="alert">{{ error }}</p>
    <p v-else-if="!guides.length" class="text-body-secondary">No guides have been published yet.</p>
    <div v-else class="row g-4">
      <article v-for="guide in guides" :key="guide.slug" class="col-lg-6">
        <div class="card h-100">
          <div class="card-body p-4">
            <img
              :src="guide.image.src"
              :alt="guide.image.alt"
              class="w-100 rounded object-fit-cover"
              style="aspect-ratio: 4 / 3"
            />
            <PhotoCredit :credit="guide.image.credit" />
            <h2 class="h3 mt-3">{{ guide.title }}</h2>
            <p>{{ guide.cardDescription || guide.description }}</p>
            <RouterLink
              class="btn btn-primary"
              :to="{ name: 'guide-detail', params: { slug: guide.slug } }"
              >Open guide</RouterLink
            >
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
