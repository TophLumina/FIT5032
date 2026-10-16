<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import GoogleAuthButton from './GoogleAuthButton.vue'
import { authErrorMessage, authReady, connectGoogle, user } from '@/services/auth'

const google = computed(() =>
  user.value?.providerData?.find((provider) => provider.providerId === 'google.com'),
)
const busy = ref(false)
const error = ref('')
const success = ref('')
let generation = 0
watch(
  () => user.value?.uid,
  () => {
    generation++
    busy.value = false
    error.value = ''
    success.value = ''
  },
)
onBeforeUnmount(() => generation++)
async function connect() {
  if (busy.value || !authReady.value || !user.value || google.value) return
  const token = generation
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await connectGoogle()
    if (token === generation)
      success.value = 'Google is connected. You can use it to sign in to this WCIP account.'
  } catch (reason) {
    if (token === generation && reason.name !== 'AbortError') error.value = authErrorMessage(reason)
  } finally {
    if (token === generation) busy.value = false
  }
}
</script>

<template>
  <section class="border-top mt-4 pt-4" aria-labelledby="signin-methods-title">
    <h2 id="signin-methods-title" class="h5">Sign-in methods</h2>
    <p v-if="google" class="mb-0">
      Google connected<span v-if="google.email">: {{ google.email }}</span
      >.
    </p>
    <template v-else>
      <p>
        Connect Google to this WCIP account to keep using your existing comments and account
        permissions.
      </p>
      <GoogleAuthButton
        label="Connect Google account"
        :disabled="!authReady"
        :busy="busy"
        @click="connect"
      />
    </template>
    <p v-if="error" class="alert alert-warning mt-3 mb-0" role="alert">{{ error }}</p>
    <p v-if="success" class="mt-3 mb-0" role="status">{{ success }}</p>
  </section>
</template>
