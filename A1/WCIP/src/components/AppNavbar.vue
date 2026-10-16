<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { adminRoleReady, authErrorMessage, authReady, isAdmin, logout, user } from '@/services/auth'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const navigationToggle = ref(null)
const accountOpen = ref(false)
const accountContainer = ref(null)
const accountToggle = ref(null)
const searchTerm = ref('')
const signingOut = ref(false)
const signOutError = ref('')

function closeNavigation() {
  mobileOpen.value = false
  accountOpen.value = false
}

function toggleNavigation() {
  mobileOpen.value = !mobileOpen.value
  accountOpen.value = false
}

function dismissAccount(event) {
  if (!accountContainer.value?.contains(event.target)) accountOpen.value = false
}

function handleEscape(event) {
  if (accountOpen.value) {
    accountOpen.value = false
    accountToggle.value?.focus()
  } else if (mobileOpen.value) {
    mobileOpen.value = false
    navigationToggle.value?.focus()
  } else return
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  document.addEventListener('pointerdown', dismissAccount)
  document.addEventListener('focusin', dismissAccount)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissAccount)
  document.removeEventListener('focusin', dismissAccount)
})

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
  accountOpen.value = false
  if (!value && authReady.value && route.meta.requiresAuth) {
    router.replace({ name: 'login', query: { redirect: route.fullPath } })
  }
})

const navItems = [
  { label: 'Plants', to: { name: 'plants' }, section: '/plants' },
  { label: 'Plant Map', to: { name: 'plant-map' }, section: '/map' },
  { label: 'Guides', to: { name: 'guides' }, section: '/guides' },
  { label: 'AI Assistant', to: { name: 'garden-assistant' }, section: '/assistant' },
  { label: 'About', to: { name: 'about' }, section: '/about' },
]

watch(() => route.fullPath, closeNavigation)

function submitSearch() {
  const query = searchTerm.value.trim()
  closeNavigation()
  router.push({ name: 'plants', query: query ? { q: query } : {} })
}
</script>

<template>
  <header class="site-header sticky-top" @keydown.esc="handleEscape">
    <nav
      class="navbar navbar-expand-xl bg-white border-bottom shadow-sm"
      aria-label="Primary navigation"
    >
      <div class="container-xxl header-inner">
        <RouterLink
          class="navbar-brand d-flex align-items-center gap-2 fw-bold"
          :to="{ name: 'home' }"
          @click="closeNavigation"
        >
          <span class="brand-mark" aria-hidden="true">W</span>
          <span>WHAT CAN I PLANT?</span>
        </RouterLink>

        <button
          ref="navigationToggle"
          class="navbar-toggler"
          type="button"
          :aria-expanded="mobileOpen"
          aria-controls="primary-navigation"
          aria-label="Toggle navigation"
          @click="toggleNavigation"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div id="primary-navigation" class="collapse navbar-collapse" :class="{ show: mobileOpen }">
          <ul class="navbar-nav primary-links">
            <li v-for="item in navItems" :key="item.label" class="nav-item">
              <RouterLink
                class="nav-link text-nowrap"
                :class="{ active: route.path.startsWith(item.section) }"
                :aria-current="route.path.startsWith(item.section) ? 'page' : undefined"
                :to="item.to"
                @click="closeNavigation"
              >
                {{ item.label }}
              </RouterLink>
            </li>
          </ul>

          <form class="site-search" role="search" @submit.prevent="submitSearch">
            <label class="visually-hidden" for="site-search">Search plants</label>
            <input
              id="site-search"
              v-model="searchTerm"
              class="form-control"
              type="search"
              placeholder="Search plants…"
            />
            <button class="search-submit" type="submit" aria-label="Search plants">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </button>
          </form>
          <div v-if="authReady" class="account-actions">
            <div v-if="user" ref="accountContainer" class="account-container">
              <button
                ref="accountToggle"
                class="btn account-toggle"
                :class="{ 'account-active': route.meta.requiresAuth }"
                type="button"
                :aria-expanded="accountOpen"
                aria-controls="account-navigation"
                :aria-label="isAdmin ? 'My account, administrator' : undefined"
                @click="accountOpen = !accountOpen"
              >
                <span v-if="isAdmin" class="account-badge" aria-hidden="true">Admin</span>
                <span>My account</span>
                <svg
                  class="account-chevron"
                  :class="{ 'is-open': accountOpen }"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  aria-hidden="true"
                >
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </button>
              <div v-show="accountOpen" id="account-navigation" class="account-panel">
                <ul class="list-unstyled mb-0">
                  <li>
                    <RouterLink
                      class="account-link"
                      :to="{ name: 'account' }"
                      :aria-current="route.name === 'account' ? 'page' : undefined"
                      @click="closeNavigation"
                    >
                      My account
                    </RouterLink>
                  </li>
                  <li v-if="isAdmin">
                    <RouterLink
                      class="account-link"
                      :to="{ name: 'status' }"
                      :aria-current="route.name === 'status' ? 'page' : undefined"
                      @click="closeNavigation"
                    >
                      Admin dashboard
                    </RouterLink>
                  </li>
                  <li class="account-signout">
                    <button
                      class="account-link"
                      type="button"
                      :disabled="signingOut"
                      @click="handleSignOut"
                    >
                      {{ signingOut ? 'Signing out…' : 'Sign out' }}
                    </button>
                  </li>
                </ul>
                <p v-if="signOutError" class="text-danger small px-3 pt-2 mb-0" role="alert">
                  {{ signOutError }}
                </p>
              </div>
            </div>
            <RouterLink v-else class="btn btn-primary" :to="{ name: 'login' }">Sign in</RouterLink>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.navbar {
  padding-block: 0;
}

.header-inner {
  column-gap: 1.5rem;
  padding-block: 0.65rem;
}

.navbar-brand {
  flex-shrink: 0;
  margin-right: 0;
  font-size: 1rem;
  letter-spacing: -0.025em;
}

.navbar-toggler {
  min-width: 44px;
  min-height: 44px;
  padding: 0.25rem 0.5rem;
}

.nav-link {
  min-height: 44px;
  display: flex;
  align-items: center;
}

.site-search {
  position: relative;
  min-width: 0;
  margin-block: 1rem;
}

.site-search .form-control {
  min-height: 44px;
  padding-right: 3rem;
  background-color: #f5f8f6;
  border-color: #a7b9ad;
}

.search-submit {
  position: absolute;
  inset-block: 0;
  right: 0;
  width: 44px;
  border: 0;
  border-radius: var(--bs-border-radius);
  color: var(--wcip-green);
  background: transparent;
}

.search-submit:hover {
  background: var(--wcip-sage);
}

.account-actions {
  flex-shrink: 0;
  padding-block: 0.5rem;
}

.account-container {
  position: relative;
}

.account-toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-height: 44px;
  border: 1px solid #a7b9ad;
  color: var(--wcip-green);
  background: #fff;
  white-space: nowrap;
}

.account-toggle:hover,
.account-toggle[aria-expanded='true'],
.account-active {
  color: var(--wcip-green);
  border-color: var(--wcip-green);
  background: var(--wcip-sage);
}

.account-badge {
  position: absolute;
  top: -0.65rem;
  right: 0.7rem;
  padding: 0.12rem 0.4rem;
  border: 2px solid #fff;
  border-radius: 1rem;
  color: #fff;
  background: var(--wcip-green);
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.035em;
}

.account-chevron.is-open {
  transform: rotate(180deg);
}

.account-panel {
  min-width: 12rem;
  margin-top: 0.5rem;
  padding: 0.4rem;
  border: 1px solid #d3dfd7;
  border-radius: 0.6rem;
  background: #fff;
  box-shadow: 0 0.5rem 1.5rem rgb(30 55 40 / 12%);
}

.account-link {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 0.6rem 0.75rem;
  border: 0;
  border-radius: 0.3rem;
  color: #284c37;
  background: transparent;
  text-align: left;
  text-decoration: none;
}

.account-link:hover,
.account-link[aria-current='page'] {
  background: var(--wcip-sage);
}

.account-link:disabled {
  opacity: 0.65;
}

.account-signout {
  margin-top: 0.3rem;
  padding-top: 0.3rem;
  border-top: 1px solid #d3dfd7;
}

.search-submit:focus-visible,
.account-toggle:focus-visible,
.account-link:focus-visible {
  outline: 3px solid var(--wcip-green);
  outline-offset: 3px;
  box-shadow: none;
}

@media (min-width: 1200px) {
  .header-inner,
  .navbar-collapse {
    flex-wrap: nowrap;
  }

  .navbar-collapse {
    min-width: 0;
    gap: 1.25rem;
  }

  .primary-links {
    flex-shrink: 0;
    align-items: center;
    margin-left: auto;
  }

  .site-search {
    flex: 0 1 14rem;
    margin-block: 0;
  }

  .account-actions {
    padding-block: 0;
  }

  .account-panel {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 1;
  }
}

@media (max-width: 1199.98px) {
  .navbar-collapse.show {
    margin-top: 0.75rem;
    padding-block: 0.5rem;
    border-top: 1px solid #d3dfd7;
    max-height: calc(100dvh - 5.5rem);
  }

  .account-toggle {
    width: 100%;
  }

  .account-panel {
    box-shadow: none;
  }
}

@media (max-width: 374.98px) {
  .header-inner {
    column-gap: 0.5rem;
  }

  .navbar-brand {
    font-size: 0.85rem;
  }
}
</style>
