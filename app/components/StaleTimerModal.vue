<script setup lang="ts">
import { formatDisplayDate } from "@/utils/date";

defineProps<{
  modelValue: boolean
  entry: {
    id: string
    work_date: string
    start_time: string
    note: string | null
  } | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: "stopEod"): void
  (e: "discard"): void
}>()
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="modelValue && entry" class="overlay">
      <Transition name="dialog-scale" appear>
        <div class="dialog" role="alertdialog" aria-modal="true">
          <h2 class="title">Timer still running</h2>
          <p class="message">
            A timer started on <strong>{{ formatDisplayDate(entry.work_date) }}</strong>
            at <strong>{{ entry.start_time }}</strong> was never stopped.
            What would you like to do?
          </p>

          <div class="actions">
            <button class="btn-discard" :disabled="loading" @click="emit('discard')">
              Discard
            </button>
            <button class="btn-stop" :disabled="loading" @click="emit('stopEod')">
              Stop at 23:59
            </button>
          </div>

          <p class="hint">You can edit the entry afterwards to adjust the end time.</p>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
  z-index: 100;
}

.dialog {
  background: #000b0e;
  border-radius: 4px;
  padding: 20px;
  border: 1px solid #efefef;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.title {
  margin: 0 0 12px;
  font-size: 18px;
  color: #efefef;
  text-align: center;
}

.message {
  margin: 0 0 20px;
  font-size: 14px;
  color: #efefef;
  text-align: center;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions button {
  flex: 1;
  padding: 12px;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  background: none;
  color: #efefef;
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-discard {
  border: none;
}

.btn-stop {
  border: 1px solid #1FA1D0;
}

.hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #efefef;
  opacity: 0.5;
  text-align: center;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 200ms ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active,
.dialog-scale-leave-active {
  transition: transform 250ms ease, opacity 250ms ease;
}

.dialog-scale-enter-from,
.dialog-scale-leave-to {
  transform: scale(0.9);
  opacity: 0;
}

.dialog-scale-enter-to,
.dialog-scale-leave-from {
  transform: scale(1);
  opacity: 1;
}
</style>
