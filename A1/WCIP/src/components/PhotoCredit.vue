<script setup>
import { safeExternalUrl } from '@/utils/safeUrl'

defineProps({
  credit: { type: Object, required: true },
})
</script>

<template>
  <small class="d-block position-relative z-2 text-body-secondary mt-2">
    Photo:
    <a :href="safeExternalUrl(credit.sourceUrl)" target="_blank" rel="noopener noreferrer">
      {{ credit.author }}
    </a>
    ·
    <a :href="safeExternalUrl(credit.licenseUrl)" target="_blank" rel="noopener noreferrer">
      {{ credit.license }}
    </a>
  </small>
</template>
