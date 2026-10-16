<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import InteractiveTable from '@/components/InteractiveTable.vue'
import { isAdmin, user } from '@/services/auth'
import { previewSeasonalEmail, sendSeasonalEmail, downloadGuide } from '@/services/seasonalEmail'

const preview = ref(null)
const selected = ref([])
const reviewed = ref(false)
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const notice = ref('')
const results = ref([])
const mustReload = ref(false)
let generation = 0
const labels = {
  ready: 'Not sent',
  accepted: 'Accepted by SendGrid',
  rejected: 'Rejected',
  unknown: 'Needs review',
  processing: 'In progress',
  skipped: 'Skipped',
  limited: 'Daily limit reached',
}
const columns = [
  { key: 'select', label: 'Select', format: (value) => (value ? 'Selected' : 'Not selected') },
  { key: 'email', label: 'Email' },
  { key: 'displayName', label: 'Name' },
  { key: 'statusLabel', label: 'This month' },
]
const rows = computed(() =>
  (preview.value?.recipients || []).map((recipient) => ({
    ...recipient,
    select: selected.value.includes(recipient.uid),
    statusLabel: labels[recipient.status] || recipient.status,
  })),
)
const selectedUsers = computed(() => rows.value.filter((row) => row.select))
const canSend = computed(
  () =>
    isAdmin.value &&
    !loading.value &&
    !sending.value &&
    !mustReload.value &&
    reviewed.value &&
    selected.value.length > 0 &&
    selected.value.length <= preview.value?.maximumBatch,
)

function readableError(reason) {
  if (
    reason?.code?.startsWith('functions/') &&
    !['functions/internal', 'functions/unknown'].includes(reason.code)
  )
    return reason.message
  return 'The email service could not complete this request. Reload the preview to check recorded results before trying again.'
}
async function load() {
  const token = ++generation
  loading.value = true
  error.value = ''
  preview.value = null
  selected.value = []
  reviewed.value = false
  results.value = []
  notice.value = ''
  try {
    const response = await previewSeasonalEmail()
    if (token !== generation) return
    preview.value = response
    mustReload.value = false
  } catch (reason) {
    if (token === generation && reason.name !== 'AbortError') error.value = readableError(reason)
  } finally {
    if (token === generation) loading.value = false
  }
}
function toggle(uid, checked) {
  selected.value = checked
    ? [...selected.value, uid]
    : selected.value.filter((value) => value !== uid)
  reviewed.value = false
}
async function submit() {
  if (!canSend.value) return
  const token = generation
  sending.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await sendSeasonalEmail({
      issueId: preview.value.guide.issueId,
      digest: preview.value.digest,
      recipientUids: [...selected.value],
      requestId: crypto.randomUUID(),
    })
    if (token !== generation) return
    results.value = response.results.map((result) => ({
      ...result,
      email: rows.value.find((row) => row.uid === result.uid)?.email || 'Selected account',
    }))
    const accepted = results.value.filter((result) => result.status === 'accepted').length
    notice.value = `${accepted} of ${response.results.length} selected accounts have an accepted email for this month. See each result below.`
    mustReload.value = true
    selected.value = []
    reviewed.value = false
  } catch (reason) {
    if (token === generation && reason.name !== 'AbortError') {
      error.value = readableError(reason)
      mustReload.value = true
    }
  } finally {
    if (token === generation) sending.value = false
  }
}
watch(
  () => [isAdmin.value, user.value?.uid],
  ([admin]) => {
    generation++
    preview.value = null
    selected.value = []
    results.value = []
    error.value = ''
    notice.value = ''
    reviewed.value = false
    sending.value = false
    loading.value = false
    if (admin) load()
  },
  { immediate: true },
)
onBeforeUnmount(() => generation++)
</script>

<template>
  <section v-if="isAdmin" class="container-xxl py-5" aria-labelledby="seasonal-title">
    <RouterLink to="/admin" class="d-inline-block mb-3">Back to dashboard</RouterLink>
    <header class="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <p class="text-uppercase small fw-bold text-primary mb-1">Administration</p>
        <h1 id="seasonal-title" class="display-5 fw-bold">Seasonal planting emails</h1>
        <p class="text-body-secondary mb-0">
          Share Melbourne gardening ideas with subscribers, with a planting-guide PDF attached.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-outline-primary"
        :disabled="loading || sending"
        @click="load"
      >
        {{ loading ? 'Loading...' : 'Reload preview and subscribers' }}
      </button>
    </header>
    <p v-if="loading" role="status">
      Preparing this month's guide and checking subscribed accounts...
    </p>
    <p v-if="error" role="alert" class="alert alert-warning">{{ error }}</p>
    <p v-if="notice" role="status" class="alert alert-info">{{ notice }}</p>
    <section v-if="results.length" class="card card-body mb-4" aria-labelledby="mail-results-title">
      <h2 id="mail-results-title" class="h4">Sending results</h2>
      <ul class="mb-0 result-list">
        <li v-for="result in results" :key="result.uid" class="mb-2 text-break">
          <strong>{{ result.email }}: {{ labels[result.status] }}</strong
          ><br />{{ result.message }}
        </li>
      </ul>
    </section>
    <template v-if="preview">
      <div class="row g-4 mb-4">
        <section class="col-lg-7" aria-labelledby="mail-preview-title">
          <div class="card card-body h-100">
            <h2 id="mail-preview-title" class="h4">1. Review the email</h2>
            <dl class="mb-3">
              <dt>From</dt>
              <dd class="text-break">
                {{ preview.sender.name }} &lt;{{ preview.sender.email }}&gt;
              </dd>
              <dt>Reply to</dt>
              <dd class="text-break">{{ preview.sender.replyTo }}</dd>
              <dt>Subject</dt>
              <dd>{{ preview.guide.subject }}</dd>
            </dl>
            <details open>
              <summary class="fw-semibold mb-3">Email body</summary>
              <div class="email-body border rounded p-3">{{ preview.text }}</div>
            </details>
          </div>
        </section>
        <section class="col-lg-5" aria-labelledby="mail-attachment-title">
          <div class="card card-body h-100">
            <p class="small text-uppercase fw-bold text-primary">
              {{ preview.guide.season }} / {{ preview.guide.edition }}
            </p>
            <h2 id="mail-attachment-title" class="h4">A guide to keep</h2>
            <p>{{ preview.guide.introduction }}</p>
            <ul>
              <li v-for="task in preview.guide.tasks" :key="task" class="mb-2">{{ task }}</li>
            </ul>
            <p class="small text-break">Attachment: {{ preview.attachment.filename }}</p>
            <button
              type="button"
              class="btn btn-outline-primary align-self-start"
              @click="downloadGuide(preview.attachment)"
            >
              Download PDF to review
            </button>
            <p class="small text-body-secondary mt-3">
              The PDF contains the same recommendations shown here, with plant links and gardening
              references.
            </p>
          </div>
        </section>
      </div>
      <section
        class="card card-body mb-4"
        aria-labelledby="mail-recipients-title"
        :aria-busy="sending"
      >
        <h2 id="mail-recipients-title" class="h4">2. Choose subscribers</h2>
        <p>
          Choose up to {{ preview.maximumBatch }} accounts per send. Each email has one recipient,
          so subscribers cannot see one another's addresses. Subscription and account status are
          checked again immediately before sending.
        </p>
        <p class="small text-body-secondary">
          One accepted email per account per month. Rejected requests can be retried after reloading
          (up to three attempts). Uncertain results stay blocked for review in SendGrid Email
          Activity. Site limit: {{ preview.dailyLimit }} attempts per Melbourne day.
        </p>
        <p v-if="!rows.length" role="status">
          No eligible subscribers yet. Users can opt in under My account.
        </p>
        <InteractiveTable
          v-else
          id="mail-subscribers"
          caption="Subscribed WCIP accounts"
          :rows="rows"
          :columns="columns"
          row-key="uid"
          initial-sort="email"
        >
          <template #cell-select="{ row }">
            <input
              type="checkbox"
              class="form-check-input"
              :aria-label="`Send to ${row.email}`"
              :checked="row.select"
              :disabled="
                sending ||
                mustReload ||
                !row.selectable ||
                (!row.select && selected.length >= preview.maximumBatch)
              "
              @change="toggle(row.uid, $event.target.checked)"
            />
          </template>
          <template #cell-statusLabel="{ row }"
            ><span>{{ row.statusLabel }}</span
            ><span class="d-block small text-body-secondary">{{ row.message }}</span
            ><span v-if="row.attempts >= 3" class="d-block small"
              >Monthly attempt limit reached.</span
            ></template
          >
        </InteractiveTable>
      </section>
      <form class="card card-body" @submit.prevent="submit">
        <h2 class="h4">3. Confirm and send</h2>
        <p role="status">{{ selected.length }} accounts selected.</p>
        <ul v-if="selectedUsers.length" class="text-break">
          <li v-for="recipient in selectedUsers" :key="recipient.uid">{{ recipient.email }}</li>
        </ul>
        <div class="form-check mb-3">
          <input
            id="mail-reviewed"
            v-model="reviewed"
            class="form-check-input"
            type="checkbox"
            :disabled="sending || mustReload || !selected.length"
          />
          <label for="mail-reviewed" class="form-check-label"
            >I have reviewed the email, PDF attachment and selected recipients.</label
          >
        </div>
        <p v-if="mustReload" class="text-body-secondary">
          Reload the preview and subscribers to see the latest recorded results before another send.
        </p>
        <button type="submit" class="btn btn-primary align-self-start" :disabled="!canSend">
          {{
            sending
              ? 'Sending... Please wait'
              : `Send email with PDF to ${selected.length} accounts`
          }}
        </button>
        <p v-if="sending" role="status" class="mt-3 mb-0">
          Checking each subscription and submitting emails. This may take up to two minutes. Results
          are saved on the server.
        </p>
        <p class="small text-body-secondary mt-3 mb-0">
          Accepted by SendGrid means the provider has queued the email. Check SendGrid Email
          Activity for delivery or bounce information.
        </p>
      </form>
    </template>
  </section>
</template>

<style scoped>
.email-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.95rem;
}
.form-check-input {
  min-width: 1.15rem;
  min-height: 1.15rem;
}
.result-list {
  padding-left: 1.3rem;
}
summary:focus-visible {
  outline: 3px solid #244a96;
  outline-offset: 4px;
}
</style>
