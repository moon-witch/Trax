<script setup lang="ts">
defineProps<{
  items: Array<{ label: string; value: string; muted?: boolean }>
}>()
</script>

<template>
  <div class="stats">
    <div v-for="item in items" :key="item.label" :class="{ muted: item.muted }">
      <strong>{{ item.label }}</strong> {{ item.value }}
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  font-size: 13px;
  padding: .5rem;
  border: 1px solid #d7d7d7;
  border-radius: 4px;
}

.muted {
  opacity: 0.75;
}
</style>