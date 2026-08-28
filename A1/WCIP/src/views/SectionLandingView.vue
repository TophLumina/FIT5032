<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  cardTitle: { type: String, required: true },
  cardDescription: { type: String, required: true },
  target: { type: [String, Object], required: true },
  action: { type: String, required: true },
})
</script>

<template>
  <div class="container-xxl py-5">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><RouterLink :to="{ name: 'home' }">Home</RouterLink></li>
        <li class="breadcrumb-item active" aria-current="page">{{ eyebrow }}</li>
      </ol>
    </nav>
    <section class="hero-surface rounded-4 p-4 p-lg-5 mb-4">
      <div class="py-lg-5">
        <p class="small fw-bold text-success text-uppercase mb-1">{{ eyebrow }}</p>
        <h1 class="display-3 fw-bold">{{ title }}</h1>
        <p class="lead col-lg-8">{{ description }}</p>
      </div>
    </section>
    <section class="card">
      <div class="card-body p-4">
        <div class="row g-4 align-items-center">
          <div class="col-lg-5"><div class="media-placeholder">Section preview</div></div>
          <div class="col-lg-7">
            <p class="small fw-bold text-success text-uppercase mb-1">Featured pathway</p>
            <h2>{{ cardTitle }}</h2>
            <p>{{ cardDescription }}</p>
            <RouterLink class="btn btn-primary" :to="target">{{ action }} →</RouterLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
