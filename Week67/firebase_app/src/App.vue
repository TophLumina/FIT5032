<script setup>
import BHeader from './components/BHeader.vue';
</script>

<template>
   <div class="main-container">
      <div class="header-container">
         <header>
            <BHeader />
         </header>

         <main class="main-content">
            <router-view />
         </main>
      </div>
   </div>
</template>
