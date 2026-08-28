<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="site-footer border-top bg-light py-4 mt-5">
    <div class="container-xxl d-flex flex-column flex-lg-row justify-content-between gap-3">
      <p class="mb-0"><strong>WHAT CAN I PLANT?</strong> · Melbourne urban gardening NFP</p>
      <nav class="d-flex flex-wrap gap-3" aria-label="Footer navigation">
        <RouterLink :to="{ name: 'plants' }">Plants</RouterLink>
        <RouterLink :to="{ name: 'guides' }">Guides</RouterLink>
        <RouterLink :to="{ name: 'about' }">About</RouterLink>
      </nav>
    </div>
  </footer>
</template>
