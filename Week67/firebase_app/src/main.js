import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBSXXF3JVuxtvCD5fteR1ug1BRwZdiuEE8",
  authDomain: "fit5032-e0aef.firebaseapp.com",
  projectId: "fit5032-e0aef",
  storageBucket: "fit5032-e0aef.firebasestorage.app",
  messagingSenderId: "162413777778",
  appId: "1:162413777778:web:88f2966dd6d5f8dce943eb"
};

// Initialize Firebase
initializeApp(firebaseConfig);

const app = createApp(App)

app.use(router)

app.mount('#app')
