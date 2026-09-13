<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { authReady, isAdmin, user } from '@/services/auth'
import { addComment, editComment, removeComment, subscribeToComments } from '@/services/comments'

const props = defineProps({
  contentType: {
    type: String,
    required: true,
    validator: (value) => ['plant', 'guide'].includes(value),
  },
  contentSlug: { type: String, required: true },
})
const route = useRoute()
const contentKey = computed(() => `${props.contentType}:${props.contentSlug}`)
const comments = ref([])
const loading = ref(true)
const fromCache = ref(true)
const pending = ref(false)
const loadError = ref('')
const actionError = ref('')
const successMessage = ref('')
const busy = ref(false)
const message = ref('')
const rating = ref(null)
const editingId = ref(null)
const editForm = reactive({ message: '', rating: null })

// A new rated comment replaces this account's contribution to the plant average.
const ratedComments = computed(() => {
  const latestByAuthor = new Map()
  for (const comment of comments.value) {
    if (
      !comment.pending &&
      Number.isInteger(comment.rating) &&
      !latestByAuthor.has(comment.authorUid)
    ) {
      latestByAuthor.set(comment.authorUid, comment)
    }
  }
  return [...latestByAuthor.values()]
})
const average = computed(() =>
  ratedComments.value.length
    ? (
        ratedComments.value.reduce((sum, comment) => sum + comment.rating, 0) /
        ratedComments.value.length
      ).toFixed(1)
    : null,
)

watch(
  contentKey,
  (key, _previous, onCleanup) => {
    let active = true
    comments.value = []
    loading.value = true
    fromCache.value = true
    loadError.value = ''
    actionError.value = ''
    successMessage.value = ''
    message.value = ''
    rating.value = null
    editingId.value = null
    const unsubscribe = subscribeToComments(
      key,
      (snapshot) => {
        if (!active) return
        comments.value = snapshot.comments
        fromCache.value = snapshot.fromCache
        pending.value = snapshot.pending
        loading.value = false
        if (
          editingId.value &&
          !snapshot.comments.some((comment) => comment.id === editingId.value)
        ) {
          editingId.value = null
        }
      },
      () => {
        if (!active) return
        comments.value = []
        loadError.value = 'Comments could not be loaded. Please refresh to try again.'
        loading.value = false
      },
    )
    onCleanup(() => {
      active = false
      unsubscribe()
    })
  },
  { immediate: true },
)

watch(
  () => user.value?.uid,
  () => {
    message.value = ''
    rating.value = null
    editingId.value = null
    actionError.value = ''
    successMessage.value = ''
  },
)
watch(isAdmin, (value) => {
  if (!value) editingId.value = null
})

function validMessage(value) {
  return value.trim().length >= 10 && value.trim().length <= 300
}

async function runAction(action, success, failure, onSuccess) {
  const key = contentKey.value
  const uid = user.value?.uid
  const sameContext = () => key === contentKey.value && uid === user.value?.uid
  busy.value = true
  actionError.value = ''
  successMessage.value = ''
  try {
    await action(key)
    if (sameContext()) {
      onSuccess?.()
      successMessage.value = success
    }
  } catch {
    if (sameContext()) actionError.value = failure
  } finally {
    busy.value = false
  }
}

function submitComment() {
  if (busy.value || !user.value || fromCache.value || loadError.value) return
  actionError.value = ''
  successMessage.value = ''
  if (!validMessage(message.value)) {
    actionError.value = 'Comment must contain 10–300 characters.'
    return
  }
  return runAction(
    (key) => addComment(key, message.value, props.contentType === 'plant' ? rating.value : null),
    'Your comment has been posted.',
    'Your comment could not be posted. Please try again.',
    () => {
      message.value = ''
      rating.value = null
    },
  )
}

function startEditing(comment) {
  if (!isAdmin.value || busy.value) return
  editingId.value = comment.id
  editForm.message = comment.message
  editForm.rating = comment.rating
  actionError.value = ''
  successMessage.value = ''
}

function saveEdit() {
  if (!isAdmin.value || busy.value || !editingId.value) return
  actionError.value = ''
  if (!validMessage(editForm.message)) {
    actionError.value = 'Comment must contain 10–300 characters.'
    return
  }
  return runAction(
    (key) => editComment(key, editingId.value, editForm.message, editForm.rating),
    'Comment updated.',
    'The comment could not be updated. Check your permissions and try again.',
    () => {
      editingId.value = null
    },
  )
}

function deleteComment(comment) {
  if (!isAdmin.value || busy.value || !window.confirm('Delete this comment?')) return
  return runAction(
    (key) => removeComment(key, comment.id),
    'Comment deleted.',
    'The comment could not be deleted. Check your permissions and try again.',
  )
}

function formatDate(value) {
  if (!value?.toDate) return 'Saving…'
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value.toDate())
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
            <p
              v-if="contentType === 'plant' && average && !fromCache && !pending && !loadError"
              class="text-body-secondary"
            >
              <strong class="text-primary">{{ average }} / 5 ★</strong>
              · {{ ratedComments.length }}
              {{ ratedComments.length === 1 ? 'gardener' : 'gardeners' }}
            </p>
            <p v-if="loading" role="status">Loading comments…</p>
            <p v-else-if="loadError" class="alert alert-warning" role="alert">{{ loadError }}</p>
            <template v-else>
              <p v-if="fromCache || pending" class="small text-body-secondary" role="status">
                {{
                  pending
                    ? 'Waiting for changes to be saved…'
                    : 'Connecting to get the latest comments…'
                }}
              </p>
              <p v-if="!comments.length && !fromCache" class="text-body-secondary">
                No comments yet. Start the discussion.
              </p>
              <article v-for="comment in comments" :key="comment.id" class="border-top py-3">
                <div class="d-flex flex-wrap justify-content-between gap-2">
                  <strong>{{ comment.author }}</strong>
                  <span class="small text-body-secondary">{{ formatDate(comment.createdAt) }}</span>
                </div>
                <form
                  v-if="isAdmin && editingId === comment.id"
                  class="mt-3"
                  @submit.prevent="saveEdit"
                >
                  <fieldset :disabled="busy || fromCache">
                    <legend class="visually-hidden">Edit comment</legend>
                    <label :for="`edit-message-${comment.id}`" class="form-label">Comment</label>
                    <textarea
                      :id="`edit-message-${comment.id}`"
                      v-model="editForm.message"
                      class="form-control mb-3"
                      required
                      minlength="10"
                      maxlength="300"
                      rows="4"
                    ></textarea>
                    <div v-if="contentType === 'plant'" class="mb-3">
                      <label :for="`edit-rating-${comment.id}`" class="form-label"
                        >Plant rating (optional)</label
                      >
                      <select
                        :id="`edit-rating-${comment.id}`"
                        v-model="editForm.rating"
                        class="form-select"
                      >
                        <option :value="null">No rating</option>
                        <option v-for="score in 5" :key="score" :value="score">
                          {{ score }} / 5 ★
                        </option>
                      </select>
                    </div>
                    <div class="d-flex gap-2">
                      <button class="btn btn-primary btn-sm" type="submit">
                        {{ busy ? 'Saving…' : 'Save changes' }}
                      </button>
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        type="button"
                        @click="editingId = null"
                      >
                        Cancel
                      </button>
                    </div>
                  </fieldset>
                </form>
                <template v-else>
                  <p
                    v-if="comment.rating !== null && contentType === 'plant'"
                    class="text-primary small mt-2 mb-1"
                  >
                    <span :aria-label="`${comment.rating} out of 5 stars`"
                      >{{ '★'.repeat(comment.rating) }}{{ '☆'.repeat(5 - comment.rating) }}</span
                    >
                  </p>
                  <p class="mb-2 mt-2 text-break comment-message">{{ comment.message }}</p>
                  <span v-if="comment.pending" class="small text-body-secondary">Saving…</span>
                  <div v-if="isAdmin" class="d-flex gap-2 mt-2">
                    <button
                      class="btn btn-outline-primary btn-sm"
                      type="button"
                      :disabled="busy || comment.pending || fromCache"
                      @click="startEditing(comment)"
                    >
                      Edit
                    </button>
                    <button
                      class="btn btn-outline-danger btn-sm"
                      type="button"
                      :disabled="busy || comment.pending || fromCache"
                      @click="deleteComment(comment)"
                    >
                      Delete
                    </button>
                  </div>
                </template>
              </article>
            </template>
          </div>
        </div>
      </div>

      <div class="col-lg-5">
        <div class="card">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase mb-1">Join the discussion</p>
            <h2 class="h3">Add a comment</h2>
            <p v-if="!authReady" role="status">Loading your account…</p>
            <p v-else-if="!user" class="mb-0">
              <RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }"
                >Sign in</RouterLink
              >
              to add a comment{{ contentType === 'plant' ? ' and an optional plant rating' : '' }}.
            </p>
            <form v-else @submit.prevent="submitComment">
              <p class="small text-body-secondary">
                Commenting as {{ user.displayName || 'Gardener' }}
                <span v-if="isAdmin" class="badge text-bg-warning ms-1">admin</span>
              </p>
              <fieldset :disabled="busy || fromCache || !!loadError">
                <legend class="visually-hidden">Your comment</legend>
                <div class="mb-3">
                  <label class="form-label" for="comment-message">Comment</label>
                  <textarea
                    id="comment-message"
                    v-model="message"
                    class="form-control"
                    rows="5"
                    required
                    minlength="10"
                    maxlength="300"
                    aria-describedby="comment-message-help"
                  ></textarea>
                  <div id="comment-message-help" class="form-text">
                    10–300 characters · {{ message.length }}/300
                  </div>
                </div>
                <div v-if="contentType === 'plant'" class="mb-3">
                  <label for="comment-rating" class="form-label">Plant rating (optional)</label>
                  <select
                    id="comment-rating"
                    v-model="rating"
                    class="form-select"
                    aria-describedby="comment-rating-help"
                  >
                    <option :value="null">No rating</option>
                    <option v-for="score in 5" :key="score" :value="score">
                      {{ score }} / 5 ★
                    </option>
                  </select>
                  <div id="comment-rating-help" class="form-text">
                    Your latest rated comment counts towards this plant's average.
                  </div>
                </div>
                <button class="btn btn-primary" type="submit">
                  {{ busy ? 'Saving…' : 'Post comment' }}
                </button>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>
    <p v-if="actionError" class="alert alert-danger mt-3 mb-0" role="alert">{{ actionError }}</p>
    <p v-if="successMessage" class="alert alert-success mt-3 mb-0" role="status">
      {{ successMessage }}
    </p>
  </section>
</template>

<style scoped>
.comment-message {
  white-space: pre-wrap;
}
</style>
