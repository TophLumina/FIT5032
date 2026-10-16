<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ActivityChart from '@/components/ActivityChart.vue'
import InteractiveTable from '@/components/InteractiveTable.vue'
import { usePlants } from '@/composables/usePlants'
import { isAdmin } from '@/services/auth'
import { getDashboardData } from '@/services/dashboard'
import { analyticsRange, shiftDay } from '@/utils/analytics'
import { siteDay, siteTimezone } from '@/utils/siteDate'

const { plants, loading: catalogLoading, error: catalogError, loadPlants } = usePlants()
const from = ref(shiftDay(siteDay(), -6))
const to = ref(siteDay())
const appliedRange = ref(null)
const data = ref(null)
const loading = ref(false)
const error = ref('')
const updatedAt = ref(null)
const showVisits = ref(true)
const showComments = ref(true)
const showLogins = ref(true)
const showLoginUsers = ref(true)
const metric = ref('comments')
const role = ref('All')
const subscription = ref('All')
const selectedDay = ref('')
const selectedPlant = ref('')
const detailPanel = ref(null)
let requestId = 0,
  controller
const dashboard = computed(() => data.value)
const users = computed(
  () =>
    dashboard.value?.users.filter(
      (user) =>
        (role.value === 'All' || user.role === role.value) &&
        (subscription.value === 'All' ||
          (user.seasonalEmailSubscribed === true) === (subscription.value === 'Subscribed')),
    ) ?? [],
)
const series = computed(() => [
  ...(showVisits.value ? [{ key: 'visits', label: 'Recorded visits', color: '#24563f' }] : []),
  ...(showComments.value ? [{ key: 'comments', label: 'Current comments', color: '#244a96' }] : []),
  ...(showLogins.value ? [{ key: 'logins', label: 'Recorded sign-ins', color: '#91421c' }] : []),
  ...(showLoginUsers.value
    ? [{ key: 'loginUsers', label: 'Daily signed-in users', color: '#703c86' }]
    : []),
])
const plantRows = computed(() =>
  [...(dashboard.value?.plantStats ?? [])].sort(
    (a, b) => (b[metric.value] ?? -1) - (a[metric.value] ?? -1) || a.name.localeCompare(b.name),
  ),
)
const chartPlants = computed(() => plantRows.value.slice(0, 10))
const plantMaximum = computed(() =>
  metric.value === 'average' ? 5 : Math.max(1, ...chartPlants.value.map((plant) => plant.comments)),
)
const details = computed(
  () =>
    dashboard.value?.comments.filter(
      (comment) =>
        (!selectedDay.value || comment.day === selectedDay.value) &&
        (!selectedPlant.value || comment.contentKey === `plant:${selectedPlant.value}`),
    ) ?? [],
)
const daySummary = computed(() =>
  dashboard.value?.trend.find((day) => day.day === selectedDay.value),
)
const plantName = computed(
  () => plants.value.find((plant) => plant.slug === selectedPlant.value)?.commonName,
)
const average = (value) => (value === null ? 'Unrated' : `${value.toFixed(2)} / 5`)
const userColumns = [
  { key: 'email', label: 'Email' },
  { key: 'displayName', label: 'Display name' },
  { key: 'role', label: 'Role' },
  {
    key: 'seasonalEmailSubscribed',
    label: 'Seasonal emails',
    format: (value) => (value === true ? 'Subscribed' : 'Not subscribed'),
  },
  { key: 'commentCount', label: 'Current comments' },
  {
    key: 'lastLoginAt',
    label: 'Last sign-in',
    format: (value) => (value ? formatTime(value) : 'Not recorded'),
  },
]
const dailyColumns = [
  { key: 'day', label: 'Date' },
  { key: 'visits', label: 'Recorded visits' },
  { key: 'comments', label: 'Current comments' },
  { key: 'logins', label: 'Recorded sign-ins' },
  { key: 'loginUsers', label: 'Daily signed-in users' },
]
const plantColumns = [
  { key: 'name', label: 'Plant' },
  { key: 'comments', label: 'Comments' },
  { key: 'ratings', label: 'Ratings' },
  { key: 'average', label: 'Average rating', format: average },
]
const commentColumns = [
  { key: 'day', label: 'Date' },
  { key: 'content', label: 'Discussion' },
  { key: 'author', label: 'Author' },
  {
    key: 'rating',
    label: 'Rating',
    format: (value) => (value === null ? 'Unrated' : `${value} / 5`),
  },
  { key: 'message', label: 'Comment' },
]
function formatTime(value) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: siteTimezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function refresh() {
  const id = ++requestId
  controller?.abort()
  controller = new AbortController()
  data.value = null
  appliedRange.value = null
  updatedAt.value = null
  error.value = ''
  loading.value = false
  selectedDay.value = ''
  selectedPlant.value = ''
  if (!isAdmin.value) return
  try {
    const range = analyticsRange(from.value, to.value)
    loading.value = true
    const result = await getDashboardData(range.from, range.to, controller.signal)
    if (id !== requestId || !isAdmin.value) return
    data.value = result
    appliedRange.value = range
    updatedAt.value = new Date()
  } catch (cause) {
    if (id === requestId && isAdmin.value)
      error.value = cause.code
        ? 'Dashboard could not be loaded. Check your connection and administrator access, then retry.'
        : cause.message
  } finally {
    if (id === requestId) loading.value = false
  }
}
function preset(days) {
  to.value = siteDay()
  from.value = shiftDay(to.value, 1 - days)
  refresh()
}
async function selectDay(day) {
  selectedDay.value = day
  selectedPlant.value = ''
  await nextTick()
  detailPanel.value?.focus()
}
async function selectPlant(slug) {
  selectedPlant.value = slug
  selectedDay.value = ''
  await nextTick()
  detailPanel.value?.focus()
}
async function clearSelection() {
  selectedDay.value = ''
  selectedPlant.value = ''
  await nextTick()
  detailPanel.value?.focus()
}
watch(isAdmin, refresh, { immediate: true })
onBeforeUnmount(() => {
  requestId++
  controller?.abort()
  data.value = null
})
</script>

<template>
  <section
    v-if="isAdmin"
    class="container-xxl py-5 admin-dashboard"
    aria-labelledby="dashboard-title"
  >
    <header class="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <p class="eyebrow small fw-bold text-uppercase mb-1">Administration</p>
        <h1 id="dashboard-title" class="display-5 fw-bold">Community dashboard</h1>
        <p class="text-body-secondary mb-0">
          Understand participation and explore the plants people discuss.
        </p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <RouterLink to="/admin/email" class="btn btn-primary">Seasonal emails</RouterLink>
        <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="refresh">
          {{ loading ? 'Loading…' : 'Refresh data' }}
        </button>
      </div>
    </header>

    <form class="card card-body mb-4" @submit.prevent="refresh">
      <div class="d-flex flex-wrap align-items-end gap-3">
        <div>
          <label for="analytics-from" class="form-label">From date</label
          ><input
            id="analytics-from"
            v-model="from"
            type="date"
            class="form-control"
            :max="siteDay()"
            required
          />
        </div>
        <div>
          <label for="analytics-to" class="form-label">To date</label
          ><input
            id="analytics-to"
            v-model="to"
            type="date"
            class="form-control"
            :max="siteDay()"
            required
          />
        </div>
        <button type="submit" class="btn btn-primary">Apply dates</button>
        <div class="d-flex flex-wrap gap-2" role="group" aria-label="Quick date ranges">
          <button
            v-for="days in [7, 30, 90]"
            :key="days"
            type="button"
            class="btn btn-outline-primary"
            @click="preset(days)"
          >
            Last {{ days }} days
          </button>
        </div>
      </div>
      <p class="small text-body-secondary mb-0 mt-2">
        Inclusive dates in Melbourne time, up to 90 days. Dates apply to activity and plant
        feedback; the user directory and all-time totals cover all current data.
      </p>
    </form>
    <p v-if="loading" role="status">Loading dashboard from Firestore…</p>
    <p v-if="error" class="alert alert-warning" role="alert">{{ error }}</p>
    <p v-if="catalogLoading" role="status">Loading plant labels…</p>
    <p v-if="catalogError" role="alert" class="alert alert-warning">
      {{ catalogError }}
      <button class="btn btn-outline-primary btn-sm" @click="loadPlants">Retry plant labels</button>
    </p>

    <template v-if="dashboard">
      <p class="small" role="status">
        Showing {{ appliedRange.from }} to {{ appliedRange.to }} · Updated
        {{ formatTime(updatedAt) }}
      </p>
      <div class="row g-3 mb-4">
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100">
            <div class="card-body p-4">
              <h2 class="h6">Registered profiles</h2>
              <p class="display-5 fw-bold mb-1" data-stat="users">
                {{ dashboard.users.length.toLocaleString() }}
              </p>
              <p class="small text-body-secondary mb-0">Current site directory</p>
            </div>
          </div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100">
            <div class="card-body p-4">
              <h2 class="h6">Visits in date range</h2>
              <p class="display-5 fw-bold mb-1" data-stat="period-visits">
                {{ dashboard.periodVisits.toLocaleString() }}
              </p>
              <p class="small text-body-secondary mb-0">
                {{ dashboard.totalVisits.toLocaleString() }} recorded all time
              </p>
            </div>
          </div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100">
            <div class="card-body p-4">
              <h2 class="h6">Comments in date range</h2>
              <p class="display-5 fw-bold mb-1" data-stat="period-comments">
                {{ dashboard.periodComments.toLocaleString() }}
              </p>
              <p class="small text-body-secondary mb-0">
                {{ dashboard.currentComments }} current comments all time
              </p>
            </div>
          </div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100">
            <div class="card-body p-4">
              <h2 class="h6">Plant rating in date range</h2>
              <p class="h2 fw-bold mb-2" data-stat="rating">
                {{ average(dashboard.averageRating) }}
              </p>
              <p class="small text-body-secondary mb-0">
                {{ dashboard.periodRatings }} rated comments
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="card card-body mb-4">
        <h2 class="h6">Sign-ins in date range</h2>
        <p class="h2 mb-2" data-stat="period-logins">
          {{ dashboard.periodLogins.toLocaleString() }}
        </p>
        <p class="small text-body-secondary mb-0">
          Each recorded authentication session counts once. Daily signed-in users count each account
          once per Melbourne day; they are not the number of unique visitors.
          <span v-if="dashboard.loginTrackingStartedAt"
            >Recording started {{ formatTime(dashboard.loginTrackingStartedAt) }}.</span
          >
          Earlier sign-ins are not reconstructed. Restoring an existing session does not add a new
          sign-in.
        </p>
      </div>

      <section class="card mb-4" aria-labelledby="activity-heading">
        <div class="card-body p-3 p-md-4">
          <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
            <div>
              <h2 id="activity-heading" class="h3">Activity over time</h2>
              <p class="text-body-secondary mb-0">
                Visits, current comments and recorded sign-ins by Melbourne date.
              </p>
            </div>
            <fieldset class="d-flex flex-wrap gap-3">
              <legend class="visually-hidden">Visible chart series</legend>
              <label
                ><input
                  v-model="showVisits"
                  type="checkbox"
                  :disabled="showVisits && series.length === 1"
                  class="form-check-input me-1"
                />
                <span class="series-dot visits" aria-hidden="true"></span> Recorded visits</label
              >
              <label
                ><input
                  v-model="showComments"
                  type="checkbox"
                  :disabled="showComments && series.length === 1"
                  class="form-check-input me-1"
                />
                <span class="series-dot comments" aria-hidden="true"></span> Current comments</label
              >
              <label
                ><input
                  v-model="showLogins"
                  type="checkbox"
                  :disabled="showLogins && series.length === 1"
                  class="form-check-input me-1"
                />
                <span class="series-dot logins" aria-hidden="true"></span> Recorded sign-ins</label
              >
              <label
                ><input
                  v-model="showLoginUsers"
                  type="checkbox"
                  :disabled="showLoginUsers && series.length === 1"
                  class="form-check-input me-1"
                />
                <span class="series-dot login-users" aria-hidden="true"></span> Daily signed-in
                users</label
              >
            </fieldset>
          </div>
          <ActivityChart
            :rows="dashboard.trend"
            :series="series"
            :selected-day="selectedDay"
            @select="selectDay"
          />
          <details class="mt-3">
            <summary class="fw-semibold mb-3">Daily data table</summary>
            <InteractiveTable
              id="daily-activity"
              caption="Daily visits, comments and sign-in activity"
              :rows="dashboard.trend"
              :columns="dailyColumns"
              row-key="day"
              initial-sort="day"
            >
              <template #cell-day="{ row }"
                ><button class="btn btn-link p-0" @click="selectDay(row.day)">
                  {{ row.day }}
                </button></template
              >
            </InteractiveTable>
          </details>
          <p class="small text-body-secondary mt-3 mb-0">
            A visit is an app open or reload, not a unique person. Navigation within the app adds no
            visit. Blocked requests and offline visits are not counted. Recent activity may take a
            few seconds to appear; use Refresh data to update the report.
            <span v-if="dashboard.trackingStartedAt">
              Recording started {{ formatTime(dashboard.trackingStartedAt) }}.</span
            >
            Comments are current records, grouped by creation date; edits affect ratings and deleted
            comments disappear.
            <span v-if="dashboard.undatedComments">
              {{ dashboard.undatedComments }} undated comments are excluded from date-based
              reports.</span
            >
          </p>
        </div>
      </section>

      <section class="card mb-4" aria-labelledby="plants-heading">
        <div class="card-body p-3 p-md-4">
          <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
            <div>
              <h2 id="plants-heading" class="h3">Plant feedback</h2>
              <p class="text-body-secondary mb-0">
                Top 10 catalogue plants in the selected dates. Select a bar to read the feedback.
              </p>
            </div>
            <div>
              <label for="plant-metric" class="form-label">Rank plants by</label
              ><select id="plant-metric" v-model="metric" class="form-select">
                <option value="comments">Comment count</option>
                <option value="average">Average rating</option>
              </select>
            </div>
          </div>
          <p v-if="!dashboard.periodRatings && metric === 'average'" role="status">
            No rated plant comments in this date range.
          </p>
          <div
            class="plant-bars"
            role="group"
            :aria-label="
              metric === 'average' ? 'Plant average rating chart' : 'Plant comment count chart'
            "
          >
            <button
              v-for="plant in chartPlants"
              :key="plant.slug"
              class="plant-bar"
              :aria-pressed="selectedPlant === plant.slug"
              @click="selectPlant(plant.slug)"
              :aria-label="`${plant.name}: ${metric === 'average' ? average(plant.average) : plant.comments + ' comments'}, ${plant.ratings} ratings. View feedback`"
            >
              <span class="bar-label">{{ plant.name }}</span
              ><span class="bar-track" aria-hidden="true"
                ><span
                  class="bar-fill"
                  :style="{ width: `${((plant[metric] ?? 0) / plantMaximum) * 100}%` }"
                ></span
              ></span>
              <span class="bar-value"
                >{{ metric === 'average' ? average(plant.average) : plant.comments
                }}<small v-if="metric === 'average'" class="d-block"
                  >{{ plant.ratings }} ratings</small
                ></span
              >
            </button>
          </div>
          <p class="small text-body-secondary mt-3">
            An average uses only ratings from 1 to 5; unrated comments are excluded. Read the rating
            count alongside each average. These are community opinions, not plant suitability
            scores.
          </p>
          <details>
            <summary class="fw-semibold mb-3">All plants as a data table</summary>
            <InteractiveTable
              id="plant-feedback"
              caption="Plant feedback in the selected dates"
              :rows="plantRows"
              :columns="plantColumns"
              row-key="slug"
              :initial-sort="metric"
              initial-direction="desc"
            >
              <template #cell-name="{ row }"
                ><button class="btn btn-link p-0 text-start" @click="selectPlant(row.slug)">
                  {{ row.name }}
                </button></template
              >
            </InteractiveTable>
          </details>
        </div>
      </section>

      <section
        ref="detailPanel"
        tabindex="-1"
        class="card mb-4 feedback-details"
        aria-labelledby="feedback-heading"
      >
        <div class="card-body p-3 p-md-4">
          <div class="d-flex flex-wrap justify-content-between gap-3">
            <h2 id="feedback-heading" class="h3">
              {{
                selectedDay
                  ? 'Day details: ' + selectedDay
                  : selectedPlant
                    ? 'Feedback: ' + plantName
                    : 'Comment details'
              }}
            </h2>
            <button
              v-if="selectedDay || selectedPlant"
              class="btn btn-outline-primary btn-sm"
              @click="clearSelection"
            >
              Clear chart selection
            </button>
          </div>
          <p v-if="daySummary" role="status">
            {{ daySummary.visits }} recorded visits · {{ daySummary.comments }} current comments on
            this day.
          </p>
          <p v-else role="status">
            {{ details.length }} current comments in the selected dates{{
              selectedPlant ? ' for this plant' : ''
            }}.
          </p>
          <InteractiveTable
            :key="`${selectedDay}:${selectedPlant}:${appliedRange.from}:${appliedRange.to}`"
            id="feedback-details"
            caption="Comments matching the chart selection"
            :rows="details"
            :columns="commentColumns"
            initial-sort="day"
            initial-direction="desc"
          >
            <template #cell-content="{ row }"
              ><RouterLink :to="row.url">{{ row.content }}</RouterLink></template
            >
          </InteractiveTable>
        </div>
      </section>

      <section class="card" aria-labelledby="users-heading">
        <div class="card-body p-3 p-md-4">
          <h2 id="users-heading" class="h3">Users and roles</h2>
          <p class="text-body-secondary">
            Profiles synchronized by the server when people sign in to this site. This is not the
            full Firebase Authentication account list. Role totals cover these profiles; guests have
            no profile.
          </p>
          <div class="row g-3 mb-3" role="group" aria-label="Filter users by role">
            <div v-for="entry in dashboard.roleCounts" :key="entry.role" class="col-sm-6">
              <button
                class="role-card w-100 p-3 rounded text-start"
                :aria-pressed="role === entry.role"
                @click="role = role === entry.role ? 'All' : entry.role"
              >
                <span class="d-flex justify-content-between gap-2"
                  ><strong>{{ entry.role }}</strong
                  ><span>{{ entry.count }} / {{ dashboard.users.length }}</span></span
                >
                <span class="bar-track d-block mt-2" aria-hidden="true"
                  ><span
                    class="bar-fill"
                    :style="{
                      width: `${(entry.count / Math.max(1, dashboard.users.length)) * 100}%`,
                    }"
                  ></span
                ></span>
              </button>
            </div>
          </div>
          <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
            <p class="mb-0" role="status">
              {{ role === 'All' ? 'All roles' : role }} · {{ users.length }} profiles
            </p>
            <button class="btn btn-outline-primary btn-sm" @click="role = 'All'">
              Show all roles
            </button>
          </div>
          <div class="mb-3">
            <label for="admin-email-subscription" class="form-label"
              >Seasonal email subscription</label
            >
            <select id="admin-email-subscription" v-model="subscription" class="form-select">
              <option>All</option>
              <option>Subscribed</option>
              <option>Not subscribed</option>
            </select>
            <p class="small text-body-secondary mt-2 mb-0">
              Users manage their own subscription in My account. Only opted-in site users may
              receive seasonal planting emails. Refresh to retrieve the latest preferences.
            </p>
          </div>
          <InteractiveTable
            :key="role + subscription"
            id="admin-users"
            caption="Registered users, roles and current comment counts"
            :rows="users"
            :columns="userColumns"
            row-key="uid"
            initial-sort="commentCount"
            initial-direction="desc"
          />
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.admin-dashboard {
  color: #243b30;
}
.eyebrow,
.admin-dashboard a,
.admin-dashboard .btn-link {
  color: #24563f;
}
.alert-warning {
  color: #513b12;
  background: #fff4d6;
  border-color: #ddc58d;
}
.series-dot {
  width: 0.8rem;
  height: 0.8rem;
  display: inline-block;
}
.visits {
  background: #24563f;
  border-radius: 50%;
}
.comments {
  background: #244a96;
}
.logins {
  background: #91421c;
  border-radius: 50%;
}
.login-users {
  background: #703c86;
}
.plant-bars {
  display: grid;
  gap: 0.45rem;
}
.plant-bar {
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) minmax(2rem, 1fr) minmax(4rem, 6rem);
  align-items: center;
  gap: 1rem;
  border: 1px solid transparent;
  background: #f6f9f6;
  color: #243b30;
  padding: 0.55rem 0.75rem;
  border-radius: 0.3rem;
  text-align: left;
}
.plant-bar:hover,
.plant-bar[aria-pressed='true'],
.role-card[aria-pressed='true'] {
  border-color: #24563f;
  background: #e7f0e8;
}
.bar-track {
  height: 0.8rem;
  background: #dce7df;
  border-radius: 0.2rem;
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  background: #356548;
}
.bar-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.role-card {
  border: 1px solid #c7d5cb;
  background: #f6f9f6;
  color: #243b30;
}
.feedback-details:focus,
.plant-bar:focus-visible,
.role-card:focus-visible {
  outline: 3px solid #244a96;
  outline-offset: 3px;
}
.feedback-details {
  scroll-margin-top: 8rem;
}
@media (max-width: 575px) {
  .plant-bar {
    grid-template-columns: minmax(6rem, 1fr) minmax(2rem, 1fr) 4.5rem;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
}
</style>
