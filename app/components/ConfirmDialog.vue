<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  modelValue: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void
  (e: "confirm"): void
  (e: "cancel"): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
})

function confirm() {
  emit("confirm")
  open.value = false
}

function cancel() {
  emit("cancel")
  open.value = false
}
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="open" class="overlay" @click.self="cancel">
      <Transition name="dialog-scale" appear>
        <div class="dialog" role="dialog" aria-modal="true">
          <h2 class="title">{{ title }}</h2>
          <p class="message">{{ message }}</p>

          <div class="actions">
            <button class="cancel" @click="cancel">
              {{ cancelLabel || "Cancel" }}
            </button>
            <button class="confirm" @click="confirm">
              {{ confirmLabel || "Confirm" }}
            </button>
          </div>
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
}

.cancel {
  background: none;
  color: #efefef;
  border: none;
}

.confirm {
  background: none;
  border: 1px solid #8f0019;
  color: #efefef;
}

/* Overlay fade transition */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 200ms ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

/* Dialog scale transition */
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
