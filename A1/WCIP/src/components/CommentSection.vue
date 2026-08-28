<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'

const props = defineProps({
  contentType: {
    type: String,
    required: true,
    validator: (value) => ['plant', 'guide'].includes(value),
  },
  contentSlug: {
    type: String,
    required: true,
  },
})

const formElement = ref(null)
const comments = ref([])
const userComments = ref([])
const loading = ref(true)
const loadWarning = ref('')
const successMessage = ref('')

const form = reactive({
  name: '',
  email: '',
  message: '',
})

const errors = reactive({
  name: '',
  email: '',
  message: '',
})

const contentKey = computed(() => `${props.contentType}:${props.contentSlug}`)
const storageKey = 'wcip:comments'
const legacyStorageKey = computed(() => `wcip:comments:${contentKey.value}`)

onMounted(loadComments)

async function loadComments() {
  loading.value = true
  loadWarning.value = ''

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/comments.json`)
    if (!response.ok) throw new Error(`Comment data request failed with status ${response.status}.`)
    const data = await response.json()
    comments.value = Array.isArray(data[contentKey.value]) ? data[contentKey.value] : []
  } catch {
    loadWarning.value =
      'Published comments could not be loaded, but you can still add a local comment.'
  }

  try {
    const storedDocument = parseStoredDocument()
    const currentComments = storedDocument[contentKey.value]

    if (Array.isArray(currentComments)) {
      userComments.value = currentComments
    } else {
      const legacyComments = JSON.parse(localStorage.getItem(legacyStorageKey.value) ?? '[]')
      userComments.value = Array.isArray(legacyComments) ? legacyComments : []

      if (userComments.value.length) {
        saveUserComments()
        localStorage.removeItem(legacyStorageKey.value)
      }
    }

    comments.value = [...userComments.value, ...comments.value]
  } catch {
    loadWarning.value = 'Saved comments could not be restored from this browser.'
  } finally {
    loading.value = false
  }
}

function validateForm() {
  const name = form.name.trim()
  const email = form.email.trim()
  const message = form.message.trim()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  errors.name = !name
    ? 'Display name is required.'
    : name.length < 2 || name.length > 30
      ? 'Display name must contain 2–30 characters.'
      : ''
  errors.email = !email
    ? 'Email address is required.'
    : !emailPattern.test(email)
      ? 'Enter a valid email address.'
      : ''
  errors.message = !message
    ? 'Comment is required.'
    : message.length < 10 || message.length > 300
      ? 'Comment must contain 10–300 characters.'
      : ''

  return !Object.values(errors).some(Boolean)
}

async function submitComment() {
  successMessage.value = ''

  if (!validateForm()) {
    await nextTick()
    formElement.value?.querySelector('.is-invalid')?.focus()
    return
  }

  const comment = {
    id: `local-${Date.now()}`,
    author: form.name.trim(),
    message: form.message.trim(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  }

  userComments.value.unshift(comment)
  comments.value.unshift(comment)

  try {
    saveUserComments()
    successMessage.value =
      'Thanks — your comment is pending review and saved as JSON in this browser.'
  } catch {
    successMessage.value =
      'Your comment was added for this session, but could not be saved locally.'
  }

  form.name = ''
  form.email = ''
  form.message = ''
  Object.keys(errors).forEach((key) => {
    errors[key] = ''
  })
}

function parseStoredDocument() {
  const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function saveUserComments() {
  const storedDocument = parseStoredDocument()
  storedDocument[contentKey.value] = userComments.value
  localStorage.setItem(storageKey, JSON.stringify(storedDocument))
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <section class="mt-5" aria-labelledby="comments-title">
    <div class="row g-4">
      <div class="col-lg-7">
        <div class="card h-100">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase mb-1">Community feedback</p>
            <h2 id="comments-title" class="h3">Comments ({{ comments.length }})</h2>

            <div v-if="loading" class="d-flex align-items-center gap-3 py-4" role="status">
              <span class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
              <span>Loading comments…</span>
            </div>
            <div v-else>
              <div v-if="loadWarning" class="alert alert-warning" role="alert">
                {{ loadWarning }}
              </div>
              <p v-if="comments.length === 0" class="text-body-secondary">
                No comments yet. Start the discussion.
              </p>
              <article v-for="comment in comments" :key="comment.id" class="border-top py-3">
                <div class="d-flex flex-wrap justify-content-between gap-2">
                  <strong>{{ comment.author }}</strong>
                  <span class="small text-body-secondary">{{ formatDate(comment.createdAt) }}</span>
                </div>
                <p class="mb-2 mt-2">{{ comment.message }}</p>
                <span v-if="comment.status === 'pending'" class="badge text-bg-warning"
                  >Pending review</span
                >
              </article>
            </div>
          </div>
        </div>
      </div>

      <form ref="formElement" class="col-lg-5" novalidate @submit.prevent="submitComment">
        <div class="card">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase mb-1">Comment form</p>
            <h2 class="h3">Add a comment</h2>

            <div class="mb-3">
              <label class="form-label" for="comment-name">Display name</label>
              <input
                id="comment-name"
                v-model="form.name"
                class="form-control"
                :class="{ 'is-invalid': errors.name }"
                type="text"
                required
                minlength="2"
                maxlength="30"
                autocomplete="name"
                aria-describedby="comment-name-error"
                @blur="validateForm"
              />
              <div id="comment-name-error" class="invalid-feedback">{{ errors.name }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label" for="comment-email">Email</label>
              <input
                id="comment-email"
                v-model="form.email"
                class="form-control"
                :class="{ 'is-invalid': errors.email }"
                type="email"
                required
                autocomplete="email"
                aria-describedby="comment-email-help comment-email-error"
                @blur="validateForm"
              />
              <div id="comment-email-help" class="form-text">
                Used for validation only; it will not be displayed.
              </div>
              <div id="comment-email-error" class="invalid-feedback">{{ errors.email }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label" for="comment-message">Comment</label>
              <textarea
                id="comment-message"
                v-model="form.message"
                class="form-control"
                :class="{ 'is-invalid': errors.message }"
                rows="5"
                required
                minlength="10"
                maxlength="300"
                aria-describedby="comment-message-count comment-message-error"
                @blur="validateForm"
              ></textarea>
              <div id="comment-message-count" class="form-text text-end">
                {{ form.message.length }}/300
              </div>
              <div id="comment-message-error" class="invalid-feedback">{{ errors.message }}</div>
            </div>

            <button class="btn btn-primary" type="submit">Submit for review</button>
            <div v-if="successMessage" class="alert alert-success mt-3 mb-0" role="status">
              {{ successMessage }}
            </div>
          </div>
        </div>
      </form>
    </div>
  </section>
</template>
