<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { user, authReady } from '@/services/auth'
import { assistantStatus, askAssistant } from '@/services/assistant'
import { usePlants } from '@/composables/usePlants'
import { conversationInput, questionLimit } from '../../shared/assistant.js'

const route = useRoute()
const { plants } = usePlants()
const selectedPlant = computed(() => plants.value.find((plant) => plant.slug === route.query.plant))
const messages = ref([])
const question = ref('')
const pendingQuestion = ref('')
const busy = ref(false)
const error = ref('')
const available = ref(null)
const checking = ref(false)
const statusError = ref('')
const announcement = ref('')
const quota = ref(null)
const questionBox = ref(null)
const latestReply = ref(null)
let requestController
let statusController
let revision = 0
const examples = [
  'I have a shady balcony in Melbourne. Which plants would suit a beginner?',
  'Compare Native Violet and Coastal Rosemary for a balcony garden.',
  'How can I make a small garden more welcoming to bees?',
]
const canSend = computed(() => authReady.value && user.value && available.value && !busy.value)

async function checkStatus() {
  statusController?.abort()
  const controller = new AbortController()
  statusController = controller
  checking.value = true
  statusError.value = ''
  try {
    available.value = await assistantStatus(controller.signal)
  } catch {
    if (!controller.signal.aborted)
      statusError.value = 'The assistant could not be reached. Check your connection and retry.'
  } finally {
    if (!controller.signal.aborted) checking.value = false
  }
}

function clearConversation() {
  revision++
  requestController?.abort()
  messages.value = []
  question.value = ''
  pendingQuestion.value = ''
  error.value = ''
  busy.value = false
  quota.value = null
  announcement.value = 'Conversation cleared.'
}

async function useExample(example) {
  question.value = example
  await nextTick()
  questionBox.value?.focus()
}

async function sendQuestion() {
  const text = question.value.trim()
  if (!canSend.value || !text || text.length > questionLimit) return
  const currentRevision = ++revision
  const controller = new AbortController()
  requestController = controller
  busy.value = true
  pendingQuestion.value = text
  error.value = ''
  announcement.value = 'The AI assistant is preparing an answer.'
  try {
    const result = await askAssistant(
      conversationInput(messages.value, text),
      selectedPlant.value?.slug,
      controller.signal,
    )
    if (currentRevision !== revision || controller.signal.aborted) return
    messages.value.push(
      { role: 'user', content: text },
      { role: 'assistant', content: result.answer, plants: result.plants },
    )
    question.value = ''
    quota.value = result.quota
    announcement.value = 'Answer ready.'
    await nextTick()
    latestReply.value?.at(-1)?.focus()
  } catch (cause) {
    if (currentRevision === revision && !controller.signal.aborted) {
      error.value =
        cause instanceof TypeError
          ? 'Could not connect. Your question is still here; please try again.'
          : cause.message
      announcement.value = ''
    }
  } finally {
    if (currentRevision === revision) {
      busy.value = false
      pendingQuestion.value = ''
    }
  }
}

watch(() => user.value?.uid, clearConversation, { flush: 'sync' })
watch(() => route.query.plant, clearConversation)
onMounted(checkStatus)
onBeforeUnmount(() => {
  revision++
  requestController?.abort()
  statusController?.abort()
})
</script>

<template>
  <div class="container-xxl py-5 assistant-page">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><RouterLink :to="{ name: 'home' }">Home</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">AI Garden Assistant</li>
      </ol>
    </nav>
    <header class="mb-4">
      <p class="small fw-bold text-success text-uppercase mb-1">
        A little help for your next planting
      </p>
      <h1 class="display-5 fw-bold">AI Garden Assistant</h1>
      <p class="lead mb-0">
        Find a plant for your space, compare your options, or ask a follow-up.
      </p>
    </header>

    <div class="row g-4 align-items-start">
      <aside class="col-lg-4 order-2 order-lg-1">
        <section class="card bg-light border-0 mb-3" aria-labelledby="start-title">
          <div class="card-body p-4">
            <h2 id="start-title" class="h5">Start with your garden</h2>
            <p>
              Tell me about your light, space and watering routine. I use the WCIP plant catalogue
              to help you explore Melbourne gardening.
            </p>
            <div v-if="selectedPlant" class="border-top pt-3 mb-3">
              <p class="small text-body-secondary mb-1">Currently discussing</p>
              <RouterLink
                :to="{ name: 'plant-detail', params: { slug: selectedPlant.slug } }"
                class="fw-bold"
                >{{ selectedPlant.commonName }}</RouterLink
              >
              <div>
                <RouterLink :to="{ name: 'garden-assistant' }" class="small"
                  >Start a general conversation</RouterLink
                >
              </div>
            </div>
            <div class="d-grid gap-2">
              <button
                v-for="example in examples"
                :key="example"
                type="button"
                class="btn btn-outline-primary text-start"
                :disabled="busy"
                @click="useExample(example)"
              >
                {{ example }}
              </button>
            </div>
          </div>
        </section>
        <p class="small text-body-secondary">
          AI suggestions can be mistaken. Check plant details and local guidance before acting,
          especially for plant safety.
        </p>
        <p id="chat-privacy" class="small text-body-secondary">
          Your messages and the WCIP catalogue are sent to OpenAI to answer your questions. Avoid
          sharing personal details. WCIP keeps this conversation only on this page; leaving or
          clearing it removes it.
        </p>
        <p class="small text-body-secondary">
          Up to 20 questions per person each day, subject to the site's shared allowance. Only
          recent messages are used for follow-up questions.
        </p>
        <RouterLink :to="{ name: 'plants' }">Explore the full plant catalogue →</RouterLink>
      </aside>

      <section class="col-lg-8 order-1 order-lg-2" aria-labelledby="conversation-title">
        <div class="card shadow-sm">
          <div class="card-body p-3 p-md-4">
            <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
              <h2 id="conversation-title" class="h4 mb-0">Your conversation</h2>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="!messages.length && !question && !busy"
                @click="clearConversation"
              >
                New conversation
              </button>
            </div>
            <p v-if="!authReady" role="status">Checking sign-in…</p>
            <div v-else-if="!user" class="alert alert-info">
              <p class="mb-2">Sign in to ask questions and continue the conversation.</p>
              <RouterLink
                class="btn btn-primary"
                :to="{ name: 'login', query: { redirect: route.fullPath } }"
                >Sign in to chat</RouterLink
              >
            </div>
            <p v-if="checking" role="status">Checking assistant availability…</p>
            <div
              v-else-if="statusError || available === false"
              class="alert alert-warning"
              role="status"
            >
              <p class="mb-2">
                {{
                  statusError ||
                  'The AI assistant is not available yet. You can still browse plants and gardening guides.'
                }}
              </p>
              <button type="button" class="btn btn-outline-dark btn-sm" @click="checkStatus">
                Check again
              </button>
            </div>

            <div v-if="!messages.length && !busy" class="chat-welcome rounded p-4 mb-3">
              <p class="h5">What would you like to grow?</p>
              <p class="mb-0">
                Try a suggested question, or describe your own garden. You can ask in English or
                Chinese.
              </p>
            </div>
            <ol class="list-unstyled mb-0" aria-label="Conversation messages">
              <li
                v-for="(message, index) in messages"
                :key="index"
                class="chat-message rounded p-3 mb-3"
                :class="message.role === 'user' ? 'chat-user' : 'chat-assistant'"
              >
                <h3
                  v-if="message.role === 'assistant'"
                  ref="latestReply"
                  tabindex="-1"
                  class="h6 fw-bold"
                >
                  AI Garden Assistant
                </h3>
                <h3 v-else class="h6 fw-bold">You</h3>
                <p class="chat-text mb-0">{{ message.content }}</p>
                <div v-if="message.plants?.length" class="border-top pt-3 mt-3">
                  <p class="small fw-bold mb-2">Related catalogue entries</p>
                  <ul class="list-unstyled mb-0">
                    <li
                      v-for="plant in message.plants"
                      :key="plant.slug"
                      class="d-flex flex-wrap gap-2 mb-2"
                    >
                      <RouterLink :to="{ name: 'plant-detail', params: { slug: plant.slug } }">{{
                        plant.name
                      }}</RouterLink>
                      <span aria-hidden="true">·</span>
                      <RouterLink
                        :to="{ name: 'plant-map', query: { plant: plant.slug } }"
                        :aria-label="`View ${plant.name} on the observation map`"
                        >Observation map</RouterLink
                      >
                    </li>
                  </ul>
                </div>
              </li>
            </ol>
            <div v-if="busy" class="chat-user rounded p-3 mb-3">
              <p class="fw-bold mb-1">You</p>
              <p class="chat-text mb-0">{{ pendingQuestion }}</p>
            </div>
            <p class="small" role="status" aria-live="polite">{{ announcement }}</p>
            <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>

            <form @submit.prevent="sendQuestion" :aria-busy="busy">
              <label for="garden-question" class="form-label fw-bold"
                >Your gardening question</label
              >
              <textarea
                id="garden-question"
                ref="questionBox"
                v-model="question"
                class="form-control"
                rows="4"
                :maxlength="questionLimit"
                :disabled="busy"
                required
                aria-describedby="chat-privacy question-length"
                placeholder="My balcony gets afternoon sun. What could I grow?"
              />
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
                <span id="question-length" class="small text-body-secondary"
                  >{{ question.length }} / {{ questionLimit }} characters</span
                >
                <button
                  class="btn btn-primary px-4"
                  type="submit"
                  :disabled="!canSend || !question.trim()"
                >
                  {{ busy ? 'Thinking…' : 'Ask assistant' }}
                </button>
              </div>
              <p v-if="quota" class="small text-body-secondary mb-0 mt-2">
                {{ quota.remaining }} questions remaining in your daily allowance. Resets
                {{ new Date(quota.resetsAt).toLocaleString('en-AU') }}.
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.assistant-page {
  max-width: 1200px;
}
.chat-welcome,
.chat-assistant {
  background: #f2f6f0;
}
.chat-user {
  background: #eef3fa;
}
.chat-message {
  border: 1px solid #d5dfd2;
}
.chat-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
.alert-info {
  color: #084298;
  background: #cfe2ff;
  border-color: #b6d4fe;
}
.alert-warning {
  color: #664d03;
  background: #fff3cd;
  border-color: #ffecb5;
}
.alert-danger {
  color: #842029;
  background: #f8d7da;
  border-color: #f5c2c7;
}
</style>
