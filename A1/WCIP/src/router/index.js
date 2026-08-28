import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Home' },
  },
  {
    path: '/plants',
    name: 'plants',
    component: () => import('@/views/PlantFinderView.vue'),
    meta: { title: 'Plant Finder' },
  },
  {
    path: '/plants/native-violet',
    name: 'plant-detail',
    component: () => import('@/views/PlantDetailView.vue'),
    meta: { title: 'Native Violet' },
  },
  {
    path: '/guides',
    name: 'guides',
    component: () => import('@/views/SectionLandingView.vue'),
    props: {
      eyebrow: 'Gardening Guides',
      title: 'Practical guides for growing well',
      description:
        'Begin with a short, achievable project designed for Melbourne homes, families and schools.',
      cardTitle: 'Build a Pollinator Pot',
      cardDescription: 'A 25-minute beginner project for a balcony, courtyard or classroom.',
      target: { name: 'guide-detail' },
      action: 'Open guide',
    },
    meta: { title: 'Gardening Guides' },
  },
  {
    path: '/guides/build-a-pollinator-pot',
    name: 'guide-detail',
    component: () => import('@/views/GuideDetailView.vue'),
    meta: { title: 'Build a Pollinator Pot' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/SectionLandingView.vue'),
    props: {
      eyebrow: 'About',
      title: 'Small gardens, healthier neighbourhoods',
      description:
        'What Can I Plant? is a Melbourne urban gardening not-for-profit concept focused on practical action.',
      cardTitle: 'Our mission',
      cardDescription: 'Help more people make responsible, locally relevant planting choices.',
      target: { name: 'home' },
      action: 'Return home',
    },
    meta: { title: 'About' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Page not found' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'What Can I Plant?'} | What Can I Plant?`
})

export default router
