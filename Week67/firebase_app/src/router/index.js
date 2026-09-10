import FirebaseSigninView from '@/view/FirebaseSigninView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [],
})

const routes = [
  {
    path: "/FireLogin",
    name: "/FireLogin",
    component: FirebaseSigninView
  }
]
export default router
