import { createRouter, createWebHistory } from 'vue-router'
import { authInitialized, user, waitForAdminRole } from '@/services/auth'

const routes = [
  {
    path: '/status',
    name: 'status',
    component: () => import('@/views/StatusView.vue'),
    meta: { title: 'Site status', requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/AuthView.vue'),
    meta: { title: 'Sign in', guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/AuthView.vue'),
    meta: { title: 'Create an account', guestOnly: true },
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('@/views/AccountView.vue'),
    meta: { title: 'Your account', requiresAuth: true },
  },
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
    path: '/plants/:slug',
    name: 'plant-detail',
    component: () => import('@/views/PlantDetailView.vue'),
    meta: { title: 'Plant details' },
  },
  {
    path: '/guides',
    name: 'guides',
    component: () => import('@/views/GuidesView.vue'),
    meta: { title: 'Gardening Guides' },
  },
  {
    path: '/guides/:slug',
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
      image: {
        src: '/images/pages/melbourne-community-garden.jpg',
        alt: 'People gardening together in a Melbourne community garden',
        credit: {
          author: 'HelloMojo',
          license: 'Public domain',
          licenseUrl: 'https://commons.wikimedia.org/wiki/Template:PD-self',
          sourceUrl:
            'https://commons.wikimedia.org/wiki/File:Community_Garden,_Melbourne,_Australia.jpg',
        },
      },
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

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth && !to.meta.guestOnly) return
  await authInitialized
  if (to.meta.requiresAuth && !user.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !(await waitForAdminRole())) return { name: 'account' }
  if (to.meta.guestOnly && user.value) return { name: 'account' }
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'What Can I Plant?'} | What Can I Plant?`
})

export default router
