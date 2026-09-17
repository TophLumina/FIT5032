import { createRouter, createWebHistory } from 'vue-router'
import FirebaseRegisterView from '@/views/FireBaseRegisterView.vue'
import FirebaseSigninView from '@/views/FireBaseSigninView.vue'
import AddBookView from '@/views/AddBookView.vue'

const routes = [
  {
    path: "/",
    redirect: "/FireSignin"
  },
  {
    path: "/FireLogin",
    name: "/FireLogin",
    component: FirebaseRegisterView
  },
  {
    path: "/FireSignin",
    name: "/FireSignin",
    component: FirebaseSigninView
  },
  {
    path: "/FireAddBook",
    name: "/FireAddBook",
    component: AddBookView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
