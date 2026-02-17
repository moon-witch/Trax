<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import EntryEditorSheet from "@/components/EntryEditorSheet.vue";
import { useTimer } from "@/composables/useTimer";
import {formatDisplayDate, localYYYYMMDD} from "@/utils/date";

type Entry = {
  id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string | null; // can be null while running
  break_minutes: number;
  note: string | null;
};

type EntryForm = {
  id?: string;
  work_date: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  break_minutes: number;
  note: string | null;
};

const { timerStatus, refreshTimer, startTimer, stopTimer, startBreak, stopBreak } = useTimer();
const { baselineDailyMinutes, refreshSettings } = useSettings();

const userName = ref<string>("");

const today = localYYYYMMDD();
const selectedDate = ref(today);

const loading = ref(false);
const error = ref<string | null>(null);
const entries = ref<Entry[]>([]);

const editorOpen = ref(false);
const editorMode = ref<"create" | "edit">("create");
const editorEntry = ref<EntryForm>({
  work_date: today,
  start_time: "09:00",
  end_time: "17:00",
  break_minutes: 0,
  note: null,
});

function hhmm(t: string | null) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

function toMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function workedMinutes(e: Entry) {
  const s = toMinutes(hhmm(e.start_time));
  const enStr = hhmm(e.end_time);
  // If end_time is null (running), treat worked as 0 for totals display
  if (!enStr) return 0;
  const en = toMinutes(enStr);
  return Math.max(0, en - s - (e.break_minutes || 0));
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function dailyOvertime(minWorked: number) {
  return Math.max(0, minWorked - 480);
}

const dayWorked = computed(() => entries.value.reduce((acc, e) => acc + workedMinutes(e), 0));
const dayOvertime = computed(() => dailyOvertime(dayWorked.value));

const timerRunning = computed(() => !!timerStatus.value?.running);
const timerEntry = computed(() => timerStatus.value?.entry ?? null);
const timerStartHHMM = computed(() => timerEntry.value?.start_time || timerStatus.value?.start_time || null);

const breakRunning = computed(() => !!timerEntry.value?.is_on_break);
const breakSeconds = computed(() => Number(timerEntry.value?.break_seconds ?? 0));
const breakMinutes = computed(() => Math.floor(breakSeconds.value / 60));

function formatSeconds(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function loadUserName() {
  try {
    const r = await $fetch<{ ok: boolean; name: string }>("/api/user/name", {
      method: "GET",
      credentials: "include",
    });
    userName.value = r?.name || "";
  } catch {
    userName.value = "";
  }
}

async function loadToday() {
  error.value = null;
  loading.value = true;
  try {
    const r = await $fetch<{ ok: boolean; entries: Entry[] }>("/api/entries", {
      query: { from: selectedDate.value, to: selectedDate.value },
      credentials: "include",
    });
    entries.value = r.entries;
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to load entries";
  } finally {
    loading.value = false;
  }
}

function openCreatePrefilled(start?: string, end?: string) {
  editorMode.value = "create";
  editorEntry.value = {
    work_date: selectedDate.value,
    start_time: start || "09:00",
    end_time: end || "17:00",
    break_minutes: 0,
    note: null,
  };
  editorOpen.value = true;
}

function openEdit(e: Entry) {
  editorMode.value = "edit";
  editorEntry.value = {
    id: e.id,
    work_date: e.work_date,
    start_time: hhmm(e.start_time),
    end_time: hhmm(e.end_time) || "17:00",
    break_minutes: e.break_minutes ?? 0,
    note: e.note ?? null,
  };
  editorOpen.value = true;
}

async function submitEditor(e: EntryForm) {
  error.value = null;
  loading.value = true;
  try {
    if (editorMode.value === "create") {
      await $fetch("/api/entries", {
        method: "POST",
        credentials: "include",
        body: e,
      });
    } else {
      if (!e.id) throw new Error("Missing entry id");
      await $fetch(`/api/entries/${e.id}`, {
        method: "PUT",
        credentials: "include",
        body: {
          work_date: e.work_date,
          start_time: e.start_time,
          end_time: e.end_time,
          break_minutes: e.break_minutes,
          note: e.note,
        },
      });
    }

    editorOpen.value = false;
    await Promise.all([loadToday(), refreshTimer()]);
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || "Failed to save entry";
  } finally {
    loading.value = false;
  }
}

async function deleteEntry(e: Entry) {
  error.value = null;
  loading.value = true;
  try {
    await $fetch(`/api/entries/${e.id}`, { method: "DELETE", credentials: "include" });
    await Promise.all([loadToday(), refreshTimer()]);
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || "Failed to delete entry";
  } finally {
    loading.value = false;
  }
}

async function onStartTimer() {
  error.value = null;
  loading.value = true;
  try {
    await startTimer();
    await Promise.all([refreshTimer(), loadToday()]);
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to start timer";
  } finally {
    loading.value = false;
  }
}

async function onStopTimer() {
  error.value = null;
  loading.value = true;
  try {
    await stopTimer();
    await Promise.all([refreshTimer(), loadToday()]);
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to stop timer";
  } finally {
    loading.value = false;
  }
}

async function onToggleBreak() {
  error.value = null;
  loading.value = true;
  try {
    if (!timerRunning.value) {
      throw createError({ statusCode: 409, statusMessage: "Timer is not running" });
    }

    if (breakRunning.value) {
      await stopBreak();
    } else {
      await startBreak();
    }

    await refreshTimer();
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to toggle break";
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([refreshTimer(), loadToday()]);
}

onMounted(async () => {
  await Promise.all([
    refreshAll(),
    loadUserName(),
    refreshSettings(),
  ]);
});
</script>

<template>
  <main class="wrap">
    <header class="top">
      <div class="head-row">
        <Transition name="fade" tag="div" class="greeting">
          <h2 v-if="userName">Hey, {{ userName }}!</h2>
        </Transition>
        <h1>Today</h1>
        <div class="date">{{ formatDisplayDate(selectedDate) }}</div>
      </div>

      <div class="stats">
        <div><strong>Worked</strong> {{ formatMinutes(dayWorked) }} hr</div>
        <div><strong>Overtime</strong> {{ formatMinutes(dayOvertime) }} hr</div>
      </div>
    </header>
    <div class="controls">
      <h2>Track time</h2>

      <div class="track">
        <button class="primary" :disabled="loading || timerRunning" @click="onStartTimer">
          Start
        </button>

        <button class="primary" :disabled="loading || !timerRunning" @click="onStopTimer">
          Stop
        </button>

        <button class="primary" :disabled="loading || !timerRunning" @click="onToggleBreak">
          {{ breakRunning ? "End break" : "Break" }}
        </button>

        <button class="primary" :disabled="loading" @click="openCreatePrefilled()">
          Add
        </button>
      </div>

      <Transition v-if="timerRunning && timerStartHHMM" appear name="fade" tag="div">
        <div class="timer" >
          Running since <strong>{{ timerStartHHMM }}</strong>
          <span v-if="breakSeconds" class="muted"> · Break {{ formatSeconds(breakSeconds) }}</span>
          <span v-if="breakRunning" class="muted"> · on break</span>
          <span v-else-if="breakMinutes" class="muted"> · break total {{ breakMinutes }}m</span>
        </div>
      </Transition>

      <p v-if="error" class="error">{{ error }}</p>
    </div>

      <h2>Entries</h2>

    <Transition v-if="loading" appear name="fade" tag="div">
      <div class="muted">Loading…</div>
    </Transition>

    <TransitionGroup appear name="fade" class="list" tag="ul" v-else-if="entries.length">
      <li v-for="e in entries" :key="e.id" class="item">
        <div class="meta">
          <div class="mins">
            <strong>
              {{ hhmm(e.start_time) }} – {{ hhmm(e.end_time) || "..." }}
            </strong>

            <span v-if="e.end_time" class="muted">
                · {{ formatMinutes(workedMinutes(e)) }} hr
              </span>

            <span v-else class="muted"> · running</span>
          </div>

          <div class="sub muted" v-if="e.break_minutes || e.note">
            <span v-if="e.break_minutes">Break {{ e.break_minutes }}m</span>
            <span v-if="e.break_minutes && e.note"> · </span>
            <span v-if="e.note">{{ e.note }}</span>
          </div>
        </div>

        <div class="actions" v-if="e.end_time">
          <button :disabled="loading" @click="openEdit(e)">Edit</button>
          <button :disabled="loading" @click="deleteEntry(e)">Delete</button>
        </div>
      </li>
    </TransitionGroup>

    <Transition v-else appear name="fade" tag="div">
      <div class="muted no-entries">No entries for today.</div>
    </Transition>

    <EntryEditorSheet
        v-model="editorOpen"
        :title="editorMode === 'create' ? 'Add entry' : 'Edit entry'"
        :submitLabel="editorMode === 'create' ? 'Create' : 'Save'"
        :entry="editorEntry"
        @submit="submitEditor"
    />
  </main>
</template>

<style scoped>
.greeting {
  position: absolute;
  top: 5rem;
  left: 50%;
  transform: translateX(-50%);
  color: #1FA1D0;
}
.wrap {
  padding: 16px;
  max-width: 720px;
  margin: 0 auto;
}

.top {
  margin-bottom: 14px;
}

.head-row {
  margin-top: 10rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

h1 {
  margin: 0;
  font-size: 25px;
}

.date {
  font-size: 15px;
  opacity: 0.85;
}

.stats {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  font-size: 13px;
  padding: .5rem;
  border: 1px solid #d7d7d7;
  border-radius: 4px;
}

h2 {
  margin-top: 0;
  font-size: 20px;
  text-align: center;
}

.controls {
  border: 1px solid #efefef;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 1rem;
}

.track {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: .5rem;
}

button {
  padding: 12px;
  font-size: 14px;
  border-radius: 10px;
  border: 1px solid #cfcfcf;
  background: #efefef;
  cursor: pointer;
}

.primary {
  font-weight: 600;

}

.timer {
  margin-top: 10px;
  font-size: 13px;
  text-align: center;
}

.error {
  margin-top: 10px;
  color: #b00020;
  font-size: 13px;
  text-align: center;
}

.muted {
  font-size: 13px;
  opacity: 0.75;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta {
  display: flex;
  flex-wrap: wrap;
}

.mins {

  font-size: 13px;
}

.sub {
  font-size: 13px;
}

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
}

.no-entries {
  text-align: center;
}
</style>
