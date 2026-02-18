<script setup lang="ts">
defineProps<{
  disabled?: boolean
  canEdit?: boolean
}>()

defineEmits<{
  edit: []
  delete: []
}>()
</script>

<template>
  <div class="actions">
    <button :disabled="disabled || !canEdit" @click="$emit('edit')">Edit</button>
    <button :disabled="disabled || !canEdit" @click="$emit('delete')">Delete</button>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.actions button {
  background: #000b0e;
  color: #efefef;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 4px;
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>