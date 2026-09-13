<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { adminRoleError, isAdmin, user, userProfileError } from '@/services/auth'

const route = useRoute()
</script>

<template>
  <section v-if="user" class="container py-5" aria-labelledby="account-title">
    <div class="card mx-auto" style="max-width: 40rem">
      <div class="card-body p-4 p-lg-5">
        <p class="small fw-bold text-success text-uppercase">Your account</p>
        <h1 id="account-title" class="h2">Welcome, {{ user.displayName || 'gardener' }}</h1>
        <span v-if="isAdmin" class="badge text-bg-warning mb-3">admin</span>
        <p>Signed in as {{ user.email }}</p>
        <p v-if="adminRoleError" class="alert alert-warning" role="status">{{ adminRoleError }}</p>
        <p v-if="userProfileError" class="alert alert-warning" role="status">
          {{ userProfileError }}
        </p>
        <p v-if="route.query.profile === 'incomplete'" class="alert alert-warning" role="status">
          Your account was created, but your display name could not be saved. You can still add
          comments.
        </p>
        <p>Share your experience in a comment and optionally include a plant rating.</p>
        <p v-if="isAdmin">You can edit and delete comments directly in each discussion.</p>
        <RouterLink
          v-if="isAdmin"
          class="btn btn-outline-primary me-2 mb-2"
          :to="{ name: 'status' }"
          >Site status</RouterLink
        >
        <RouterLink class="btn btn-primary" :to="{ name: 'plants' }">Find a plant</RouterLink>
      </div>
    </div>
  </section>
</template>
