import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'bootswatch/dist/flatly/bootstrap.min.css'
import './assets/theme.css'

createApp(App).use(router).mount('#app')
