<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { authErrorMessage, authReady, login, register } from '@/services/auth'

const route = useRoute()
const router = useRouter()
const isRegister = computed(() => route.name === 'register')
const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const errorMessage = ref('')

watch(
  () => route.name,
  () => {
    password.value = ''
    confirmPassword.value = ''
    errorMessage.value = ''
  },
)

function destination() {
  const value = route.query.redirect
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return { name: 'account' }
  }
  const resolved = router.resolve(value)
  return resolved.name && !['login', 'register', 'not-found'].includes(resolved.name)
    ? resolved.fullPath
    : { name: 'account' }
}

async function submit() {
  if (busy.value || !authReady.value) return
  errorMessage.value = ''
  if (
    isRegister.value &&
    (displayName.value.trim().length < 2 || displayName.value.trim().length > 30)
  ) {
    errorMessage.value = 'Display name must contain 2–30 characters.'
    return
  }
  if (isRegister.value && password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  busy.value = true
  try {
    if (isRegister.value) {
      const profileSaved = await register(displayName.value, email.value, password.value)
      if (!profileSaved) {
        await router.replace({ name: 'account', query: { profile: 'incomplete' } })
        return
      }
    } else {
      await login(email.value, password.value)
    }
    await router.replace(destination())
  } catch (error) {
    errorMessage.value = authErrorMessage(error)
  } finally {
    password.value = ''
    confirmPassword.value = ''
    busy.value = false
  }
}
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <section class="col-md-8 col-lg-5" aria-labelledby="auth-title">
        <div class="card shadow-sm">
          <div class="card-body p-4 p-lg-5">
            <p class="small fw-bold text-success text-uppercase">Your gardening community</p>
            <h1 id="auth-title" class="h2">{{ isRegister ? 'Create an account' : 'Sign in' }}</h1>
            <p class="text-body-secondary">
              Sign in to join the discussion and share plant ratings in your comments.
            </p>
            <form @submit.prevent="submit">
              <fieldset :disabled="busy || !authReady">
                <legend class="visually-hidden">
                  {{ isRegister ? 'Registration details' : 'Sign-in details' }}
                </legend>
                <div v-if="isRegister" class="mb-3">
                  <label for="auth-name" class="form-label">Display name</label>
                  <input
                    id="auth-name"
                    v-model="displayName"
                    class="form-control"
                    autocomplete="nickname"
                    required
                    minlength="2"
                    maxlength="30"
                  />
                </div>
                <div class="mb-3">
                  <label for="auth-email" class="form-label">Email</label>
                  <input
                    id="auth-email"
                    v-model="email"
                    class="form-control"
                    type="email"
                    autocomplete="email"
                    required
                    maxlength="254"
                  />
                </div>
                <div class="mb-3">
                  <label for="auth-password" class="form-label">Password</label>
                  <input
                    id="auth-password"
                    v-model="password"
                    class="form-control"
                    type="password"
                    :autocomplete="isRegister ? 'new-password' : 'current-password'"
                    required
                    :minlength="isRegister ? 8 : undefined"
                    :aria-describedby="isRegister ? 'password-help' : undefined"
                  />
                  <div v-if="isRegister" id="password-help" class="form-text">
                    Use at least 8 characters.
                  </div>
                </div>
                <div v-if="isRegister" class="mb-3">
                  <label for="auth-confirm" class="form-label">Confirm password</label>
                  <input
                    id="auth-confirm"
                    v-model="confirmPassword"
                    class="form-control"
                    type="password"
                    autocomplete="new-password"
                    required
                    minlength="8"
                  />
                </div>
                <button class="btn btn-primary w-100" type="submit">
                  {{ busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in' }}
                </button>
              </fieldset>
              <p v-if="errorMessage" class="alert alert-danger mt-3 mb-0" role="alert">
                {{ errorMessage }}
              </p>
            </form>
            <p class="mt-4 mb-0">
              {{ isRegister ? 'Already have an account?' : 'New here?' }}
              <RouterLink
                v-if="!busy"
                :to="{ name: isRegister ? 'login' : 'register', query: route.query }"
              >
                {{ isRegister ? 'Sign in' : 'Create an account' }}
              </RouterLink>
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
