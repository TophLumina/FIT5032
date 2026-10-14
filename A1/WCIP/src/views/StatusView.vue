<script setup>
import { ref, watch } from 'vue'
import InteractiveTable from '@/components/InteractiveTable.vue'
import { isAdmin } from '@/services/auth'
import { getSiteStatus } from '@/services/status'
import { siteDay, siteTimezone } from '@/utils/siteDate'

const selectedDay = ref(siteDay())
const status = ref(null)
const loading = ref(false)
const error = ref('')
const updatedAt = ref(null)
let requestId = 0

const userColumns = [
  { key: 'email', label: 'Email' },
  { key: 'displayName', label: 'Display name' },
  { key: 'commentCount', label: 'Comments' },
]

async function refresh() {
  const id = ++requestId
  status.value = null
  error.value = ''
  loading.value = false
  updatedAt.value = null
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
          <InteractiveTable
            id="admin-users"
            caption="Registered users and their comment counts"
            :rows="status.users"
            :columns="userColumns"
            row-key="uid"
            initial-sort="commentCount"
            initial-direction="desc"
          />
          <p v-if="updatedAt" class="small text-body-secondary mb-0">
            Updated {{ formatTime(updatedAt) }}. Refresh to load the latest figures.
          </p>
        </div>
      </div>
    </template>
  </section>
</template>
