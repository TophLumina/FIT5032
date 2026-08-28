<script setup>
import { RouterView } from 'vue-router'
import AppFooter from '@/components/AppFooter.vue'
import AppNavbar from '@/components/AppNavbar.vue'
</script>

<template>
  <a class="skip-link btn btn-dark" href="#main-content">Skip to main content</a>
  <AppNavbar />
  <main id="main-content">
    <RouterView />
  </main>
  <AppFooter />
</template>
