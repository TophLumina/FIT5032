import { createRouter, createWebHistory } from 'vue-router'
import FirebaseRegisterView from '@/views/FireBaseRegisterView.vue'
import FirebaseSigninView from '@/views/FireBaseSigninView.vue'

const routes = [
  {
    path: "/FireLogin",
    name: "/FireLogin",
    component: FirebaseRegisterView
  },
  {
    path: "/FireSignin",
    name: "/FireSignin",
    component: FirebaseSigninView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
