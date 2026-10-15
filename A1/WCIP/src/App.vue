<script setup>
import { RouterView } from 'vue-router'
import AppFooter from '@/components/AppFooter.vue'
import AppNavbar from '@/components/AppNavbar.vue'
const localEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true'
</script>

<template>
  <a class="skip-link btn btn-dark" href="#main-content">Skip to main content</a>
  <AppNavbar />
  <main id="main-content">
    <p v-if="localEmulators" class="bg-dark text-white text-center p-2 mb-0" role="status">
      Local emulator · synthetic test data
    </p>
    <RouterView />
  </main>
  <AppFooter />
</template>
