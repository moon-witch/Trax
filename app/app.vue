<script setup lang="ts">
</script>

<template>
  <div class="app-container">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
}

input,
textarea,
button,
select,
a {
  -webkit-tap-highlight-color: transparent;
}

.app-container {
  background: #000b0e;
  min-height: 100vh;
  font-family: 'Roboto', sans-serif;
  color: #efefef;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.2s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>