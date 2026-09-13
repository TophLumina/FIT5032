import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'bootswatch/dist/flatly/bootstrap.min.css'
import './assets/theme.css'
import { recordVisit } from './services/status'

createApp(App).use(router).mount('#app')
router.isReady().then(() => recordVisit())
