<script setup>
import { RouterLink } from 'vue-router'

const materials = [
  '30–40 cm pot with drainage',
  'Native potting mix',
  '3 pollinator-friendly plants',
  'Watering can',
  'Small trowel',
  'Mulch',
]
const steps = [
  ['Prepare the pot', 'Cover the drainage hole loosely and fill two-thirds with potting mix.'],
  ['Plan the layout', 'Place taller plants at the back and trailing plants near the edge.'],
  ['Plant and firm', 'Set each plant at its existing soil level, then gently firm around roots.'],
  ['Water and observe', 'Water deeply. Track insect visitors over the next four weeks.'],
]

function printPage() {
  window.print()
}
</script>

<template>
  <div class="container-xxl py-5">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item">
          <RouterLink :to="{ name: 'guides' }">Gardening Guides</RouterLink>
        </li>
        <li class="breadcrumb-item">Family Gardening</li>
        <li class="breadcrumb-item active" aria-current="page">Build a Pollinator Pot</li>
      </ol>
    </nav>
    <header
      class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4"
    >
      <div>
        <p class="small fw-bold text-success text-uppercase mb-1">Family gardening guide</p>
        <h1 class="display-4 fw-bold">Build a Pollinator Pot</h1>
        <p class="lead mb-0">A small-space project for beginners, families and classrooms.</p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <span
          v-for="tag in ['25 minutes', 'Beginner', 'Family / school']"
          :key="tag"
          class="badge rounded-pill text-bg-success"
          >{{ tag }}</span
        >
      </div>
    </header>

    <div class="row g-4 mb-4">
      <section class="col-lg-5">
        <div class="card h-100">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase">Guide hero</p>
            <div class="media-placeholder media-placeholder-lg">
              Large project image placeholder
            </div>
          </div>
        </div>
      </section>
      <section class="col-lg-7">
        <div class="card h-100">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase">Materials list</p>
            <h2>What you’ll need</h2>
            <div class="row g-2 mb-3">
              <div v-for="material in materials" :key="material" class="col-md-6">
                <div class="border rounded p-3">□ {{ material }}</div>
              </div>
            </div>
            <small>Before you start: choose a spot with at least 4 hours of sun.</small>
          </div>
        </div>
      </section>
    </div>

    <div class="row g-4">
      <section class="col-lg-8">
        <div class="card h-100">
          <div class="card-body p-4">
            <p class="small fw-bold text-success text-uppercase">Numbered steps</p>
            <h2>Step by step</h2>
            <ol class="list-group list-group-flush list-unstyled">
              <li
                v-for="(step, index) in steps"
                :key="step[0]"
                class="list-group-item px-0 py-3 d-flex gap-3"
              >
                <span class="badge text-bg-success fs-6 align-self-start p-3">0{{ index + 1 }}</span
                ><span
                  ><strong class="d-block">{{ step[0] }}</strong
                  ><small>{{ step[1] }}</small></span
                >
              </li>
            </ol>
          </div>
        </div>
      </section>
      <aside class="col-lg-4 d-flex flex-column gap-4">
        <section class="card">
          <div class="card-body">
            <p class="small fw-bold text-success text-uppercase">Recommended plants</p>
            <h2 class="h4">Recommended plants</h2>
            <ul class="list-group list-group-flush mb-3">
              <li
                v-for="plant in [
                  'Chocolate Lily · sun · bees',
                  'Common Everlasting · butterflies',
                  'Native Violet · part shade',
                ]"
                :key="plant"
                class="list-group-item px-0"
              >
                {{ plant }}
              </li>
            </ul>
            <RouterLink
              class="btn btn-outline-primary w-100"
              :to="{ name: 'plants', query: { benefit: 'pollinators' } }"
              >Compare plants</RouterLink
            >
          </div>
        </section>
        <section class="alert alert-success mb-0">
          <p class="small fw-bold text-success-emphasis text-uppercase">Learning prompt</p>
          <h2 class="h4">Family / school learning idea</h2>
          <p>
            Create a weekly “pollinator count”. Record the insect type, weather and flower visited.
          </p>
          <button class="btn btn-outline-success no-print" type="button" @click="printPage">
            Print activity sheet
          </button>
        </section>
      </aside>
    </div>

    <section class="mt-5" aria-labelledby="more-guides">
      <h2 id="more-guides" class="h4">Related guides</h2>
      <div class="row g-3">
        <div
          v-for="item in [
            {
              title: 'Balcony Garden Basics',
              detail: 'Small-space · 8 min',
              to: { name: 'guides' },
            },
            {
              title: 'Plants for Native Bees',
              detail: 'Biodiversity · 7 min',
              to: { name: 'plants', query: { benefit: 'pollinators' } },
            },
            {
              title: 'School Garden Starter',
              detail: 'School guide · 12 min',
              to: { name: 'guides' },
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
