<script setup>
import { computed } from 'vue'
import imageManifest from '@/generated/responsive-images.json'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, required: true },
  sizes: { type: String, required: true },
  loading: { type: String, default: 'lazy' },
})

const image = computed(() => imageManifest[props.src])
const srcset = computed(() =>
  image.value?.variants.map((variant) => `${assetUrl(variant.src)} ${variant.width}w`).join(', '),
)

function assetUrl(src) {
  return src.startsWith('/') && !src.startsWith('//')
    ? `${import.meta.env.BASE_URL}${src.slice(1)}`
    : src
}
</script>

<template>
  <picture class="d-block h-100 w-100">
    <source v-if="srcset" type="image/webp" :srcset="srcset" :sizes="sizes" />
    <img
      v-bind="$attrs"
      :src="assetUrl(src)"
      :alt="alt"
      :width="image?.width"
      :height="image?.height"
      :loading="loading"
      decoding="async"
    />
  </picture>
</template>
