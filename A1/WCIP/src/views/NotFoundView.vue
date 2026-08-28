<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div
    class="container py-5 text-center d-flex flex-column justify-content-center align-items-center"
    style="min-height: 65vh"
  >
    <p class="small fw-bold text-success text-uppercase mb-1">404</p>
    <h1 class="display-4 fw-bold">This page hasn’t grown yet.</h1>
    <p class="lead">Try returning home or browse the plant finder.</p>
    <div class="d-flex flex-wrap justify-content-center gap-2">
      <RouterLink class="btn btn-primary" :to="{ name: 'home' }">Return home</RouterLink
      ><RouterLink class="btn btn-outline-primary" :to="{ name: 'plants' }"
        >Browse plants</RouterLink
      >
    </div>
  </div>
</template>
