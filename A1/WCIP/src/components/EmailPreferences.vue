<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { user } from '@/services/auth'
import { getEmailPreferences, saveEmailPreferences } from '@/services/emailPreferences'

const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const subscribed = ref(false)
const savedSubscription = ref(false)
const email = ref('')
const error = ref('')
const message = ref('')
let requestId = 0

async function load() {
  const id = ++requestId
  loaded.value = false
  subscribed.value = false
  savedSubscription.value = false
  email.value = ''
  error.value = ''
  message.value = ''
  saving.value = false
  loading.value = false
  const uid = user.value?.uid
  if (!uid) return
  loading.value = true
  try {
    const result = await getEmailPreferences(uid)
    if (id !== requestId) return
    subscribed.value = savedSubscription.value = result.subscribed === true
    email.value = result.email
    loaded.value = true
  } catch {
    if (id === requestId)
      error.value = 'Email preferences could not be loaded. Check your connection and try again.'
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function save() {
  if (!loaded.value || saving.value || subscribed.value === savedSubscription.value) return
  const id = ++requestId
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await saveEmailPreferences(user.value.uid, subscribed.value)
    if (id !== requestId) return
    subscribed.value = savedSubscription.value = result.subscribed === true
    email.value = result.email
    message.value = result.subscribed
      ? 'Subscribed. You can unsubscribe here at any time.'
      : 'Unsubscribed. You will not be included in future seasonal email sends.'
  } catch {
    if (id === requestId)
      error.value =
        'Your change could not be confirmed. Try saving again, or reload your preferences.'
  } finally {
    if (id === requestId) saving.value = false
  }
}

watch([() => user.value?.uid, () => user.value?.email], load, { immediate: true })
onBeforeUnmount(() => {
  requestId++
})
</script>

<template>
  <section class="border-top pt-4 mt-3" aria-labelledby="email-preferences-heading">
    <h2 id="email-preferences-heading" class="h5">Seasonal planting emails</h2>
    <p id="seasonal-email-description" class="text-body-secondary">
      Receive Melbourne seasonal plant recommendations and an attached planting guide at your
      account email. Subscription is optional and you can unsubscribe here at any time.
    </p>
    <p v-if="loading" role="status">Loading email preferences…</p>
    <form v-if="loaded" @submit.prevent="save" :aria-busy="saving">
      <p class="small">Delivery address: {{ email }}</p>
      <div class="form-check mb-3">
        <input
          id="seasonal-email-subscription"
          v-model="subscribed"
          class="form-check-input"
          type="checkbox"
          aria-describedby="seasonal-email-description seasonal-email-saved"
          :disabled="saving"
          @change="message = ''"
        />
        <label class="form-check-label" for="seasonal-email-subscription">
          Subscribe to seasonal planting emails
        </label>
      </div>
      <p id="seasonal-email-saved" class="small text-body-secondary">
        Saved preference: {{ savedSubscription ? 'Subscribed' : 'Not subscribed' }}.
      </p>
      <button class="btn btn-primary" :disabled="saving || subscribed === savedSubscription">
        {{ saving ? 'Saving…' : 'Save email preferences' }}
      </button>
    </form>
    <p class="mt-3 mb-0" role="status">{{ message }}</p>
    <div v-if="error" class="alert alert-warning mt-3 mb-0" role="alert">
      <p class="mb-2">{{ error }}</p>
      <button class="btn btn-outline-primary btn-sm" type="button" @click="load">
        Reload preferences
      </button>
    </div>
  </section>
</template>
