<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import EntryEditorSheet from "@/components/EntryEditorSheet.vue";
import EntryListItem from "@/components/EntryListItem.vue";
import StatsDisplay from "@/components/StatsDisplay.vue";
import LoadingError from "@/components/LoadingError.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { useTimer } from "@/composables/useTimer";
import { useSettings } from "@/composables/useSettings";
import { useEntries } from "@/composables/useEntries";
import { formatDisplayDate, localYYYYMMDD } from "@/utils/date";
import { formatMinutes, formatSeconds, workedMinutes } from "@/utils/time";
import type { Entry, EntryForm } from "@/types/entry";

const { timerStatus, refreshTimer, startTimer, stopTimer, startBreak, stopBreak } = useTimer();
const { baselineDailyMinutes, refreshSettings } = useSettings();
const { createEntry, updateEntry, deleteEntry: deleteEntryApi, loading: entriesLoading, error: entriesError } = useEntries();

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

const confirmDeleteOpen = ref(false);
const entryToDelete = ref<Entry | null>(null);

function dailyOvertime(minWorked: number) {
  return Math.max(0, minWorked - 480);
}

const dayWorked = computed(() => entries.value.reduce((acc, e) => acc + workedMinutes(e), 0));
const dayOvertime = computed(() => dailyOvertime(dayWorked.value));

const statsItems = computed(() => [
  { label: "Worked", value: `${formatMinutes(dayWorked.value)} hr` },
  { label: "Overtime", value: `${formatMinutes(dayOvertime.value)} hr` }
]);

const timerRunning = computed(() => !!timerStatus.value?.running);
const timerEntry = computed(() => timerStatus.value?.entry ?? null);
const timerStartHHMM = computed(() => {
  const startTime = timerEntry.value?.start_time || timerStatus.value?.start_time || null;
  if (!startTime) return null;
  return String(startTime).slice(0, 5);
});

const breakRunning = computed(() => !!timerEntry.value?.is_on_break);
const breakSeconds = computed(() => Number(timerEntry.value?.break_seconds ?? 0));
const breakMinutes = computed(() => Math.floor(breakSeconds.value / 60));

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
  const startTime = String(e.start_time).slice(0, 5);
  const endTime = e.end_time ? String(e.end_time).slice(0, 5) : "17:00";
  editorEntry.value = {
    id: e.id,
    work_date: e.work_date,
    start_time: startTime,
    end_time: endTime,
    break_minutes: e.break_minutes ?? 0,
    note: e.note ?? null,
  };
  editorOpen.value = true;
}

async function submitEditor(e: EntryForm) {
  error.value = null;
  try {
    if (editorMode.value === "create") {
      await createEntry(e);
    } else {
      await updateEntry(e);
    }
    editorOpen.value = false;
    await Promise.all([loadToday(), refreshTimer()]);
  } catch (err: any) {
    error.value = entriesError.value || "Failed to save entry";
  }
}

function showDeleteConfirm(e: Entry) {
  entryToDelete.value = e;
  confirmDeleteOpen.value = true;
}

async function handleDeleteEntry() {
  if (!entryToDelete.value) return;

  error.value = null;
  try {
    await deleteEntryApi(entryToDelete.value.id);
    await Promise.all([loadToday(), refreshTimer()]);
  } catch (err: any) {
    error.value = entriesError.value || "Failed to delete entry";
  } finally {
    entryToDelete.value = null;
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

      <StatsDisplay :items="statsItems" />
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

      <LoadingError :error="error" />
    </div>

      <h2>Entries</h2>

    <LoadingError :loading="loading" />

    <TransitionGroup appear name="fade" class="list" tag="ul" v-if="!loading && entries.length">
      <EntryListItem
        v-for="e in entries"
        :key="e.id"
        :entry="e"
        :loading="loading || entriesLoading"
        @edit="openEdit"
        @delete="showDeleteConfirm"
      />
    </TransitionGroup>

    <Transition v-if="!loading && !entries.length" appear name="fade" tag="div">
      <div class="muted no-entries">No entries for today.</div>
    </Transition>

    <EntryEditorSheet
        v-model="editorOpen"
        :title="editorMode === 'create' ? 'Add entry' : 'Edit entry'"
        :submitLabel="editorMode === 'create' ? 'Create' : 'Save'"
        :entry="editorEntry"
        @submit="submitEditor"
    />

    <ConfirmDialog
      v-model="confirmDeleteOpen"
      title="Delete Entry"
      :message="entryToDelete ? `Do you want to delete the entry for ${formatDisplayDate(entryToDelete.work_date)}?` : ''"
      confirm-label="Delete"
      cancel-label="Cancel"
      @confirm="handleDeleteEntry"
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

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.no-entries {
  text-align: center;
  font-size: 13px;
  opacity: 0.75;
}
</style>
