<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const searchTerm = ref('')

const navItems = [
  { label: 'Plants', to: { name: 'plants' }, section: '/plants' },
  { label: 'Guides', to: { name: 'guides' }, section: '/guides' },
  { label: 'About', to: { name: 'about' }, section: '/about' },
]

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)

function submitSearch() {
  const query = searchTerm.value.trim()
  router.push({ name: 'plants', query: query ? { q: query } : {} })
}
</script>

<template>
  <header class="site-header sticky-top">
    <nav
      class="navbar navbar-expand-xl bg-white border-bottom shadow-sm"
      aria-label="Primary navigation"
    >
      <div class="container-xxl py-2">
        <RouterLink
          class="navbar-brand d-flex align-items-center gap-2 fw-bold"
          :to="{ name: 'home' }"
        >
          <span class="brand-mark" aria-hidden="true">W</span>
          <span>WHAT CAN I PLANT?</span>
        </RouterLink>

        <button
          class="navbar-toggler"
          type="button"
          :aria-expanded="mobileOpen"
          aria-controls="primary-navigation"
          aria-label="Toggle navigation"
          @click="mobileOpen = !mobileOpen"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div id="primary-navigation" class="collapse navbar-collapse" :class="{ show: mobileOpen }">
          <ul class="navbar-nav ms-auto align-items-xl-center gap-xl-1">
            <li v-for="item in navItems" :key="item.label" class="nav-item">
              <RouterLink
                class="nav-link px-xl-2"
                :class="{ active: route.path.startsWith(item.section) }"
                :aria-current="route.path.startsWith(item.section) ? 'page' : undefined"
                :to="item.to"
              >
                {{ item.label }}
              </RouterLink>
            </li>
          </ul>

          <form
            class="d-flex gap-2 ms-xl-3 my-3 my-xl-0"
            role="search"
            @submit.prevent="submitSearch"
          >
            <label class="visually-hidden" for="site-search">Search plants</label>
            <input
              id="site-search"
              v-model="searchTerm"
              class="form-control"
              type="search"
              placeholder="Search plants…"
            />
            <button class="btn btn-outline-primary" type="submit">Search</button>
          </form>
        </div>
      </div>
    </nav>
  </header>
</template>
