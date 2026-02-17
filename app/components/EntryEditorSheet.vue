<script setup lang="ts">
import { ref, watch, computed } from "vue";

type Entry = {
  id?: string;
  work_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  break_minutes: number;
  note: string | null;
};

const props = defineProps<{
  modelValue: boolean;
  entry: Entry; // prefilled
  title: string;
  submitLabel: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", entry: Entry): void;
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const local = ref<Entry>({ ...props.entry });

watch(
    () => props.entry,
    (v) => (local.value = { ...v }),
    { deep: true }
);

const error = ref<string | null>(null);

function close() {
  open.value = false;
  error.value = null;
}

function validate(e: Entry) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.work_date)) return "Invalid date";
  if (!/^\d{2}:\d{2}$/.test(e.start_time)) return "Invalid start time";
  if (!/^\d{2}:\d{2}$/.test(e.end_time)) return "Invalid end time";
  if (Number.isNaN(e.break_minutes) || e.break_minutes < 0) return "Invalid break minutes";

  const [sh, sm] = e.start_time.split(":").map(Number);
  const [eh, em] = e.end_time.split(":").map(Number);
  const s = sh * 60 + sm;
  const en = eh * 60 + em;
  if (en <= s) return "End time must be after start time";

  return null;
}

function submit() {
  const e = {
    ...local.value,
    break_minutes: Number(local.value.break_minutes ?? 0),
    note: local.value.note?.trim() ? local.value.note.trim() : null,
  };

  const v = validate(e);
  if (v) {
    error.value = v;
    return;
  }

  emit("submit", e);
}
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="open" class="overlay" @click.self="close">
      <Transition name="sheet-slide" appear>
        <div class="sheet" role="dialog" aria-modal="true">
          <div class="head">
            <div class="title">{{ title }}</div>
            <button class="x" @click="close" aria-label="Close">×</button>
          </div>

          <div class="body">
            <label>
              Date
              <input type="date" v-model="local.work_date" />
            </label>

            <div class="row2">
              <label>
                Start
                <input type="time" v-model="local.start_time" />
              </label>

              <label>
                End
                <input type="time" v-model="local.end_time" />
              </label>
            </div>

            <div class="row2">
              <label>
                Break (min)
                <input type="number" min="0" v-model.number="local.break_minutes" />
              </label>

              <label>
                Note
                <input type="text" v-model="local.note" placeholder="Optional" />
              </label>
            </div>

            <p v-if="error" class="error">{{ error }}</p>
          </div>

          <div class="foot">
            <button @click="close">Cancel</button>
            <button class="primary" @click="submit">{{ submitLabel }}</button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* Overlay container */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: grid;
  align-items: end;
  z-index: 50;
}

/* Sheet */
.sheet {
  background: #000b0e;
  border-radius: 4px 4px 0 0;
  border: 1px solid #efefef;
  padding: 12px 12px 16px;
  max-height: 85dvh;
  overflow: auto;
  color: #000b0e;
  will-change: transform, opacity;
}

/* Header */
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 4px 10px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: #efefef;
  text-align: center;
}

.x {
  border: 1px solid #cfcfcf;
  background: none;
  border-radius: 4px;
  width: 36px;
  height: 36px;
  font-size: 20px;
  line-height: 0;
  color: #efefef;
}

/* Body */
.body {
  display: grid;
  gap: 10px;
}

label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: #efefef;
  text-align: center;
}

input {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 4px;
  border: 1px solid #cfcfcf;
  width: 85%;
  justify-self: center;
  text-align: center;
  background: #000b0e;
  color: #efefef;
  color-scheme: dark;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.error {
  color: #b00020;
  font-size: 13px;
}

/* Footer */
.foot {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.foot button {
  flex: 1;
  padding: 12px;
  font-size: 14px;
  border-radius: 10px;
  border: none;
  background: none;
  color: #efefef;
}

.primary {
  font-weight: 600;
}

/* --- Vue transitions --- */

/* Overlay fade */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 180ms ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

/* Sheet slide from bottom */
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 240ms ease, opacity 240ms ease;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.sheet-slide-enter-to,
.sheet-slide-leave-from {
  transform: translateY(0);
  opacity: 1;
}
</style>
