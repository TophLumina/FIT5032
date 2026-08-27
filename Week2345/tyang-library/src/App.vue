<script setup>
import JSONLab from './components/JSON.vue'
import router from './router/index.js';
import BHeader from './components/BHeader.vue'

</script>

<template>
   <div class="main-container">
      <div class="form-container">
         <header>
            <BHeader />
         </header>

         <main class="main-content">
            <!-- <Form /> -->
            <!-- <JSONLab /> -->
             <router-view />
         </main>
      </div>
      </div>
</template>
