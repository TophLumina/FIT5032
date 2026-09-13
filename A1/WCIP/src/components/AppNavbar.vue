<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { adminRoleReady, authErrorMessage, authReady, isAdmin, logout, user } from '@/services/auth'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const searchTerm = ref('')
const signingOut = ref(false)
const signOutError = ref('')

watch([isAdmin, adminRoleReady], ([value, ready]) => {
  if (ready && !value && route.meta.requiresAdmin) router.replace({ name: 'account' })
})

async function handleSignOut() {
  signingOut.value = true
  signOutError.value = ''
  try {
    await logout()
    if (route.meta.requiresAuth) await router.replace({ name: 'login' })
  } catch (error) {
    signOutError.value = authErrorMessage(error)
  } finally {
    signingOut.value = false
  }
}

watch(user, (value) => {
  if (!value && authReady.value && route.meta.requiresAuth) {
    router.replace({ name: 'login', query: { redirect: route.fullPath } })
  }
})

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
          <div v-if="authReady" class="d-flex align-items-center gap-2 ms-xl-3">
            <template v-if="user">
              <span v-if="isAdmin" class="badge text-bg-warning">admin</span>
              <RouterLink v-if="isAdmin" class="btn btn-outline-primary" :to="{ name: 'status' }"
                >Status</RouterLink
              >
              <RouterLink class="btn btn-outline-primary" :to="{ name: 'account' }"
                >My account</RouterLink
              >
              <button
                class="btn btn-primary"
                type="button"
                :disabled="signingOut"
                @click="handleSignOut"
              >
                {{ signingOut ? 'Signing out…' : 'Sign out' }}
              </button>
            </template>
            <RouterLink v-else class="btn btn-primary" :to="{ name: 'login' }">Sign in</RouterLink>
          </div>
          <p v-if="signOutError" class="text-danger small ms-xl-3 mb-0" role="alert">
            {{ signOutError }}
          </p>
        </div>
      </div>
    </nav>
  </header>
</template>
