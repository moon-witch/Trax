<script setup lang="ts">
defineProps<{
  loading?: boolean
  error?: string | null
}>()
</script>

<template>
  <div v-if="loading" class="muted">Loading…</div>
  <p v-if="error" class="error">{{ error }}</p>
</template>

<style scoped>
.muted {
  font-size: 13px;
  opacity: 0.75;
}

.error {
  color: #b00020;
  font-size: 13px;
  margin: 10px 0 0;
}
</style>