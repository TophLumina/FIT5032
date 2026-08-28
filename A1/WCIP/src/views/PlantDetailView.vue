<script setup>
import { RouterLink } from 'vue-router'

const facts = [
  ['Sunlight', 'Part shade'],
  ['Water', 'Moderate'],
  ['Height', '10–15 cm'],
  ['Flowers', 'Spring–summer'],
]

const steps = [
  ['Choose a pot', 'Use a wide container with drainage holes.'],
  ['Prepare soil', 'Use a free-draining native potting mix.'],
  ['Plant', 'Keep the crown level with the soil surface.'],
  ['Maintain', 'Water when the top layer begins to dry.'],
]
</script>

<template>
  <div class="container-xxl py-5">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><RouterLink :to="{ name: 'home' }">Home</RouterLink></li>
        <li class="breadcrumb-item">
          <RouterLink :to="{ name: 'plants' }">Plant Finder</RouterLink>
        </li>
        <li class="breadcrumb-item active" aria-current="page">Native Violet</li>
      </ol>
    </nav>

    <div class="row g-4 mb-4">
      <section class="col-lg-5">
        <div class="card h-100">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase">Plant gallery</p>
            <div class="media-placeholder media-placeholder-lg">Large plant image placeholder</div>
            <p class="text-center text-body-secondary mt-3 mb-0" aria-label="Image 1 of 3">● ○ ○</p>
          </div>
        </div>
      </section>
      <section class="col-lg-7">
        <div class="card h-100">
          <div class="card-body p-4 p-xl-5 d-flex flex-column align-items-start">
            <p class="small fw-bold text-success text-uppercase">Plant summary</p>
            <div class="d-flex flex-wrap gap-2">
              <span
                v-for="tag in ['Victorian native', 'Beginner', 'Pollinators']"
                :key="tag"
                class="badge rounded-pill text-bg-success"
                >{{ tag }}</span
              >
            </div>
            <h1 class="display-4 fw-bold mt-4 mb-1">Native Violet</h1>
            <p class="fs-5 fst-italic">Viola hederacea</p>
            <p class="lead">
              A compact native groundcover for shaded pots and small Melbourne gardens.
            </p>
            <div class="row g-2 w-100 my-3">
              <div v-for="fact in facts" :key="fact[0]" class="col-6 col-xl-3">
                <div class="border rounded p-3 h-100">
                  <strong class="d-block small text-uppercase text-success">{{ fact[0] }}</strong
                  ><span class="small">{{ fact[1] }}</span>
                </div>
              </div>
            </div>
            <a class="btn btn-primary ms-auto" href="#sources">Where to find it →</a>
          </div>
        </div>
      </section>
    </div>

    <section
      class="alert alert-success d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 p-4"
      role="region"
      aria-labelledby="suitability-title"
    >
      <div>
        <p class="small fw-bold text-success-emphasis text-uppercase mb-1">Suitability check</p>
        <h2 id="suitability-title" class="h3">Is this plant right for me?</h2>
        <strong>Match: High</strong>
      </div>
      <p class="mb-0">
        ✓ Balcony pots&nbsp; ✓ Part shade&nbsp; ✓ Beginner friendly&nbsp; ✓ Small pollinators
      </p>
      <RouterLink class="btn btn-outline-success" :to="{ name: 'plants' }"
        >Change my conditions</RouterLink
      >
    </section>

    <div class="row g-4">
      <section class="col-lg-8">
        <div class="card h-100">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase">Grow instructions</p>
            <h2>How to grow Native Violet</h2>
            <div class="row g-4">
              <div v-for="(step, index) in steps" :key="step[0]" class="col-md-6">
                <div class="d-flex gap-3">
                  <span class="badge text-bg-success fs-6 align-self-start p-3">{{
                    index + 1
                  }}</span
                  ><span
                    ><strong class="d-block">{{ step[0] }}</strong
                    ><small>{{ step[1] }}</small></span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <aside class="col-lg-4 d-flex flex-column gap-4">
        <section class="card">
          <div class="card-body">
            <p class="small fw-bold text-success text-uppercase">Biodiversity value</p>
            <h2 class="h4">Biodiversity value</h2>
            <p>
              Flowers provide food for small native bees. Dense growth creates cool, sheltered
              ground cover.
            </p>
          </div>
        </section>
        <section id="sources" class="card">
          <div class="card-body">
            <p class="small fw-bold text-success text-uppercase">Plant sources</p>
            <h2 class="h4">Where to find it</h2>
            <p>3 responsible local nurseries · Melbourne</p>
            <RouterLink class="btn btn-outline-primary" :to="{ name: 'about' }"
              >Contact us</RouterLink
            >
          </div>
        </section>
      </aside>
    </div>

    <section class="mt-5" aria-labelledby="related-guides">
      <h2 id="related-guides" class="h4">Related guides</h2>
      <div class="row g-3">
        <div
          v-for="item in [
            {
              title: 'Build a Pollinator Pot',
              detail: 'Family gardening · 25 min',
              to: { name: 'guide-detail' },
            },
            {
              title: 'Watering Container Plants',
              detail: 'Plant care · 5 min',
              to: { name: 'guides' },
            },
            {
              title: 'Plants for Native Bees',
              detail: 'Biodiversity · 7 min',
              to: { name: 'plants', query: { benefit: 'pollinators' } },
            },
          ]"
          :key="item.title"
          class="col-md-4"
        >
          <RouterLink class="card card-hover h-100 text-decoration-none" :to="item.to"
            ><div class="card-body">
              <strong>{{ item.title }}</strong
              ><small class="d-block">{{ item.detail }}</small>
            </div></RouterLink
          >
        </div>
      </div>
    </section>
  </div>
</template>
