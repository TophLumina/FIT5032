<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import InteractiveTable from '@/components/InteractiveTable.vue'
import { isAdmin, user } from '@/services/auth'
import {
  previewSeasonalEmail,
  saveSeasonalEmailDraft,
  sendSeasonalEmail,
  downloadGuide,
} from '@/services/seasonalEmail'

const preview = ref(null)
const selected = ref([])
const reviewed = ref(false)
const loading = ref(false)
const sending = ref(false)
const saving = ref(false)
const draft = ref({ subject: '', introduction: '', checklist: '', note: '' })
const error = ref('')
const notice = ref('')
const results = ref([])
const mustReload = ref(false)
let generation = 0
const labels = {
  ready: 'Not sent',
  accepted: 'Accepted by Gmail',
  blocked: 'Delivery blocked',
  rejected: 'Rejected',
  unknown: 'Needs review',
  processing: 'In progress',
  skipped: 'Skipped',
  limited: 'Daily limit reached',
}
function statusLabel(record) {
  if (record.status === 'accepted' && record.provider === 'sendgrid')
    return 'Previously accepted by SendGrid'
  return labels[record.status] || record.status
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
    statusLabel: statusLabel(recipient),
  })),
)
const selectedUsers = computed(() => rows.value.filter((row) => row.select))
const content = computed(() => ({
  subject: draft.value.subject,
  introduction: draft.value.introduction,
  tasks: draft.value.checklist
    .split('\n')
    .map((task) => task.trim())
    .filter(Boolean),
  note: draft.value.note,
}))
const dirty = computed(
  () =>
    preview.value &&
    JSON.stringify(content.value) !==
      JSON.stringify({
        subject: preview.value.guide.subject,
        introduction: preview.value.guide.introduction,
        tasks: preview.value.guide.tasks,
        note: preview.value.guide.note || '',
      }),
)
const editorError = computed(() => {
  if (!content.value.subject.trim() || content.value.subject.length > 200)
    return 'Enter a subject of 1 to 200 characters.'
  if (!content.value.introduction.trim() || content.value.introduction.length > 1200)
    return 'Enter an introduction of 1 to 1,200 characters.'
  if (
    content.value.tasks.length < 1 ||
    content.value.tasks.length > 6 ||
    content.value.tasks.some((task) => task.length > 240)
  )
    return 'Enter 1 to 6 checklist items, with up to 240 characters per item.'
  if (content.value.note.length > 1200) return 'Keep the additional note within 1,200 characters.'
  return ''
})
function editContent(value) {
  draft.value = {
    subject: value.subject,
    introduction: value.introduction,
    checklist: value.tasks.join('\n'),
    note: value.note || '',
  }
  reviewed.value = false
}
watch(
  draft,
  () => {
    reviewed.value = false
  },
  { deep: true },
)
const canSend = computed(
  () =>
    isAdmin.value &&
    !loading.value &&
    !sending.value &&
    !saving.value &&
    !dirty.value &&
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
    editContent(response.guide)
    mustReload.value = false
  } catch (reason) {
    if (token === generation && reason.name !== 'AbortError') error.value = readableError(reason)
  } finally {
    if (token === generation) loading.value = false
  }
}
async function save() {
  if (
    !isAdmin.value ||
    !dirty.value ||
    editorError.value ||
    saving.value ||
    sending.value ||
    mustReload.value
  )
    return
  const token = generation
  saving.value = true
  reviewed.value = false
  error.value = ''
  notice.value = ''
  try {
    const response = await saveSeasonalEmailDraft({
      issueId: preview.value.guide.issueId,
      draftVersion: preview.value.guide.draftVersion,
      content: content.value,
    })
    if (token !== generation) return
    preview.value = { ...preview.value, ...response }
    editContent(response.guide)
    notice.value =
      'Draft saved for this month. Review the updated email and PDF before sending. No email was sent.'
  } catch (reason) {
    if (token === generation && reason.name !== 'AbortError') {
      error.value = readableError(reason)
      if (reason.code !== 'functions/invalid-argument') mustReload.value = true
    }
  } finally {
    if (token === generation) saving.value = false
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
    saving.value = false
    draft.value = { subject: '', introduction: '', checklist: '', note: '' }
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
        :disabled="loading || sending || saving"
        @click="load"
      >
        {{
          loading
            ? 'Loading...'
            : dirty
              ? 'Discard edits and reload'
              : 'Reload preview and subscribers'
        }}
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
          <strong>{{ result.email }}: {{ statusLabel(result) }}</strong
          ><br />{{ result.message }}
        </li>
      </ul>
    </section>
    <template v-if="preview">
      <div class="row g-4 mb-4">
        <section class="col-lg-7" aria-labelledby="mail-preview-title">
          <div class="card card-body h-100">
            <h2 id="mail-preview-title" class="h4">1. Edit and review the email</h2>
            <p class="text-body-secondary">
              Edit this month's message, then save to update the email and PDF together. Saved
              drafts are shared with other administrators and remain available after reloading.
            </p>
            <fieldset
              :disabled="saving || sending || mustReload"
              aria-describedby="mail-editor-help"
            >
              <legend class="visually-hidden">Seasonal email content</legend>
              <div class="mb-3">
                <label for="mail-subject" class="form-label fw-semibold">Subject</label>
                <input
                  id="mail-subject"
                  v-model="draft.subject"
                  class="form-control"
                  maxlength="200"
                  required
                />
              </div>
              <div class="mb-3">
                <label for="mail-introduction" class="form-label fw-semibold">Introduction</label>
                <textarea
                  id="mail-introduction"
                  v-model="draft.introduction"
                  class="form-control"
                  rows="4"
                  maxlength="1200"
                  required
                  aria-describedby="mail-introduction-help"
                ></textarea>
                <p id="mail-introduction-help" class="form-text">
                  {{ draft.introduction.length }} / 1,200 characters
                </p>
              </div>
              <div class="mb-3">
                <label for="mail-checklist" class="form-label fw-semibold"
                  >Seasonal checklist</label
                >
                <textarea
                  id="mail-checklist"
                  v-model="draft.checklist"
                  class="form-control"
                  rows="5"
                  maxlength="1500"
                  required
                  aria-describedby="mail-checklist-help"
                ></textarea>
                <p id="mail-checklist-help" class="form-text">
                  One item per line; 1–6 items, up to 240 characters each.
                </p>
              </div>
              <div class="mb-3">
                <label for="mail-note" class="form-label fw-semibold"
                  >Additional note (optional)</label
                >
                <textarea
                  id="mail-note"
                  v-model="draft.note"
                  class="form-control"
                  rows="4"
                  maxlength="1200"
                  aria-describedby="mail-note-help"
                ></textarea>
                <p id="mail-note-help" class="form-text">
                  {{ draft.note.length }} / 1,200 characters
                </p>
              </div>
              <p id="mail-editor-help" class="small text-body-secondary">
                Plant facts and links come from the catalogue. Subscription instructions are
                included automatically.
              </p>
              <p v-if="dirty && editorError" role="alert" class="text-danger">{{ editorError }}</p>
              <div class="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="!dirty || !!editorError"
                  @click="save"
                >
                  {{ saving ? 'Saving and preparing PDF...' : 'Save draft and update preview' }}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :disabled="!dirty"
                  @click="editContent(preview.guide)"
                >
                  Discard edits
                </button>
                <button
                  v-if="preview.defaults"
                  type="button"
                  class="btn btn-link"
                  @click="editContent(preview.defaults)"
                >
                  Restore seasonal defaults
                </button>
              </div>
            </fieldset>
            <p v-if="saving" role="status">Saving the draft and preparing the updated PDF...</p>
            <p v-else-if="dirty" role="status" class="alert alert-warning">
              Unsaved changes. Save the draft to refresh the preview and PDF before sending.
            </p>
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
              <summary class="fw-semibold mb-3">Saved email preview</summary>
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
              :disabled="dirty || saving || sending || mustReload"
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
          (up to three attempts). Uncertain results stay locked until the sending mailbox is
          checked. Site limit: {{ preview.dailyLimit }} attempts per Melbourne day.
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
                saving ||
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
            :disabled="sending || saving || dirty || mustReload || !selected.length"
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
          Accepted by Gmail means Gmail accepted the send request. Recipient delivery is not
          confirmed here. Check the sending mailbox for any delivery failure notice.
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
