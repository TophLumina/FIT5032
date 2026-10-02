<script setup>
import { computed, ref, watch } from 'vue'
import { isAdmin } from '@/services/auth'
import { getSiteStatus } from '@/services/status'
import { siteDay, siteTimezone } from '@/utils/siteDate'

const selectedDay = ref(siteDay())
const search = ref('')
const sortOrder = ref('most')
const status = ref(null)
const loading = ref(false)
const error = ref('')
const updatedAt = ref(null)
let requestId = 0

const users = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (status.value?.users ?? [])
    .filter((user) => user.email.toLowerCase().includes(term))
    .sort(
      (a, b) =>
        (sortOrder.value === 'most'
          ? b.commentCount - a.commentCount
          : a.commentCount - b.commentCount) ||
        a.email.localeCompare(b.email) ||
        a.uid.localeCompare(b.uid),
    )
})

async function refresh() {
  const id = ++requestId
  status.value = null
  error.value = ''
  if (!isAdmin.value) return
  loading.value = true
  try {
    const result = await getSiteStatus(selectedDay.value)
    if (id !== requestId || !isAdmin.value) return
    status.value = result
    updatedAt.value = new Date()
  } catch {
    if (id === requestId && isAdmin.value)
      error.value = 'Site status could not be loaded. Please try again.'
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch([selectedDay, isAdmin], refresh, { immediate: true })

function formatTime(value) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: siteTimezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}
</script>

<template>
  <section v-if="isAdmin" class="container-xxl py-5" aria-labelledby="status-title">
    <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <p class="small fw-bold text-success text-uppercase mb-1">Administration</p>
        <h1 id="status-title" class="display-5 fw-bold">Site status</h1>
        <p class="text-body-secondary mb-0">Recorded visits and community participation.</p>
      </div>
      <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="refresh">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
    </header>

    <div class="mb-4" style="max-width: 20rem">
      <label for="status-day" class="form-label">Visit date (Melbourne time)</label>
      <input
        id="status-day"
        v-model="selectedDay"
        class="form-control"
        type="date"
        :max="siteDay()"
        required
      />
    </div>
    <p v-if="loading" role="status">Loading site status…</p>
    <p v-if="error" class="alert alert-warning" role="alert">{{ error }}</p>
    <template v-if="status">
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body p-4">
              <h2 class="h5">
                {{ selectedDay === siteDay() ? "Today's visits" : 'Visits on ' + selectedDay }}
              </h2>
              <p class="display-4 fw-bold mb-0" data-stat="daily-visits">
                {{ status.dailyVisits.toLocaleString() }}
              </p>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-body p-4">
              <h2 class="h5">Total visits</h2>
              <p class="display-4 fw-bold mb-0" data-stat="total-visits">
                {{ status.totalVisits.toLocaleString() }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <p class="small text-body-secondary mb-4">
        One visit is recorded when the site opens or reloads; moving between pages does not add a
        visit.
        <span v-if="status.trackingStartedAt"
          >Recording started {{ formatTime(status.trackingStartedAt) }}.</span
        >
      </p>

      <div class="card">
        <div class="card-body p-4">
          <h2 class="h3">User comments</h2>
          <p class="text-body-secondary">
            {{ status.users.length }} users · {{ status.commentCount }} current comments
          </p>
          <div class="row g-3 mb-4">
            <div class="col-md-8">
              <label for="status-email" class="form-label">Search by user email</label>
              <input
                id="status-email"
                v-model="search"
                class="form-control"
                type="search"
                placeholder="Enter an email or part of one"
                autocomplete="off"
              />
            </div>
            <div class="col-md-4">
              <label for="status-sort" class="form-label">Sort by comment count</label>
              <select id="status-sort" v-model="sortOrder" class="form-select">
                <option value="most">Most comments first</option>
                <option value="fewest">Fewest comments first</option>
              </select>
            </div>
          </div>
          <p class="small text-body-secondary" role="status">{{ users.length }} users shown</p>
          <div class="table-responsive">
            <table class="table table-hover align-middle">
              <caption class="visually-hidden">
                Registered users and their current comment counts, including users with no comments.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Display name</th>
                  <th
                    scope="col"
                    class="text-end"
                    :aria-sort="sortOrder === 'most' ? 'descending' : 'ascending'"
                  >
                    Comments
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.uid">
                  <td class="text-break">{{ user.email || 'No email' }}</td>
                  <td>{{ user.displayName }}</td>
                  <td class="text-end">{{ user.commentCount }}</td>
                </tr>
                <tr v-if="users.length === 0">
                  <td colspan="3" class="text-body-secondary py-4">No users match this email.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="updatedAt" class="small text-body-secondary mb-0">
            Updated {{ formatTime(updatedAt) }}. Refresh to load the latest figures.
          </p>
        </div>
      </div>
    </template>
  </section>
</template>
