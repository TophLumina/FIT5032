<script setup>
defineProps({
  credit: { type: Object, required: true },
})
</script>

<template>
  <small class="d-block position-relative z-2 text-body-secondary mt-2">
    Photo:
    <a :href="credit.sourceUrl" target="_blank" rel="noopener noreferrer">
      {{ credit.author }}
    </a>
    ·
    <a :href="credit.licenseUrl" target="_blank" rel="noopener noreferrer">
      {{ credit.license }}
    </a>
  </small>
</template>
