<script setup lang="ts">
import router from '@/router';

</script>

<template>
  <!-- Using Bootstrap's Header template (starter code) -->
  <!-- https://getbootstrap.com/docs/5.0/examples/headers/ -->
  <div class="container">
    <header class="d-flex justify-content-center py-3">
      <ul class="nav nav-pills">

        <li class="nav-item">
          <router-link to="/FireLogin" class="nav-link" active-class="active">FireBase Login</router-link>
        </li>

      </ul>
    </header>
  </div>
</template>