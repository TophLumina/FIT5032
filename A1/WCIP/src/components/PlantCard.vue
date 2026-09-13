<script setup>
import { RouterLink } from 'vue-router'
import PhotoCredit from './PhotoCredit.vue'
import { formatLabel, joinLabels } from '@/utils/plantLabels'

defineProps({
  plant: { type: Object, required: true },
  compact: Boolean,
})
</script>

<template>
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
      <span v-if="!compact" class="badge text-bg-success mb-2">
        {{ formatLabel(plant.status) }} · {{ formatLabel(plant.difficulty) }}
      </span>
      <h3 class="h5" :class="{ 'mt-2': compact }">
        <RouterLink
          class="stretched-link text-decoration-none"
          :to="{ name: 'plant-detail', params: { slug: plant.slug } }"
        >
          {{ plant.commonName }}
        </RouterLink>
      </h3>
      <template v-if="compact">
        <small class="d-block text-body-secondary mb-2">
          {{ joinLabels(plant.sunlight) }} · {{ formatLabel(plant.difficulty) }}
        </small>
        <span class="badge text-bg-light border">{{ joinLabels(plant.biodiversity) }}</span>
      </template>
      <template v-else>
        <em class="small text-body-secondary">{{ plant.scientificName }}</em>
        <p class="small border-top pt-3 mt-3 mb-2">
          {{ joinLabels(plant.sunlight) }} · {{ formatLabel(plant.water) }} water
        </p>
        <p class="small text-body-secondary mb-2">{{ joinLabels(plant.spaces) }}</p>
      </template>
    </div>
  </article>
</template>
