import { createApp } from 'vue'
import App from './App.vue'

// bootstrap css 
import 'bootstrap/dist/css/bootstrap.min.css'

import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ColumnGroup from 'primevue/columngroup';   // optional
import Row from 'primevue/row';                   // optional

const app = createApp(App);
app.use(PrimeVue, {
    theme: {
        preset: Aura
    }
})

createApp(App).mount('#app')
