<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import EntryEditorSheet from "@/components/EntryEditorSheet.vue";
import { useSettings } from "@/composables/useSettings";

type Entry = {
  id: string;
  work_date: string; // normalized: YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string | null; // allow null (running)
  break_minutes: number;
  note: string | null;

  // snapshot baseline for overtime calculations
  baseline_daily_minutes_at_time: number;
};

type EntryForm = {
  id?: string;
  work_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  break_minutes: number;
  note: string | null;
};

/** Date helpers (local time) */
function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function weekRangeLocal(dateStr: string) {
  const d = parseLocalDate(dateStr);
  const day = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: formatLocalDate(monday), to: formatLocalDate(sunday) };
}
function normalizeWorkDate(v: any): string {
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return formatLocalDate(new Date(v));
  } catch {
    return String(v).slice(0, 10);
  }
}

/** Time helpers */
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
  if (!enStr) return 0;
  const en = toMinutes(enStr);
  return Math.max(0, en - s - (e.break_minutes || 0));
}
function formatMinutes(min: number) {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

/** Baseline snapshot rule for a day: baseline of earliest entry that day */
function dailyTargetMinutes(entriesForDay: Entry[]): number {
  if (!entriesForDay.length) return 0;
  const sorted = [...entriesForDay].sort((a, b) => hhmm(a.start_time).localeCompare(hhmm(b.start_time)));
  return Number(sorted[0].baseline_daily_minutes_at_time) || 480;
}

const refDate = ref(formatLocalDate(new Date())); // YYYY-MM-DD
const loading = ref(true);
const error = ref<string | null>(null);
const entries = ref<Entry[]>([]);
const range = computed(() => weekRangeLocal(refDate.value));

/** Settings */
const { baselineWeeklyMinutes, refreshSettings } = useSettings();
const expectedWeek = computed(() => baselineWeeklyMinutes.value);

const weekWorked = computed(() => entries.value.reduce((acc, e) => acc + workedMinutes(e), 0));

/**
 * Forces TransitionGroup to re-mount after each load so that enter transitions
 * (and therefore staggering) reliably run.
 */
const listVersion = ref(0);

async function loadWeek() {
  error.value = null;
  loading.value = true;
  try {
    const r = await $fetch<{ ok: boolean; entries: any[] }>("/api/entries", {
      query: { from: range.value.from, to: range.value.to },
      credentials: "include",
    });
    entries.value = (r.entries || []).map((e) => ({
      ...e,
      work_date: normalizeWorkDate(e.work_date),
      baseline_daily_minutes_at_time: Number(e.baseline_daily_minutes_at_time),
    })) as Entry[];

    // bump after the DOM data is replaced
    listVersion.value += 1;
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to load week";
  } finally {
    loading.value = false;
  }
}

const groupedByDay = computed(() => {
  const map = new Map<string, Entry[]>();
  for (const e of entries.value) {
    if (!map.has(e.work_date)) map.set(e.work_date, []);
    map.get(e.work_date)!.push(e);
  }

  for (const [k, list] of map.entries()) {
    list.sort((a, b) => hhmm(a.start_time).localeCompare(hhmm(b.start_time)));
    map.set(k, list);
  }

  const days: { date: string; entries: Entry[]; worked: number; overtime: number; target: number }[] = [];
  const start = parseLocalDate(range.value.from);

  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const key = formatLocalDate(dt);

    const list = map.get(key) || [];
    const worked = list.reduce((acc, x) => acc + workedMinutes(x), 0);
    const target = dailyTargetMinutes(list);
    const overtime = Math.max(0, worked - target);

    days.push({ date: key, entries: list, worked, overtime, target });
  }

  return days;
});

const weekTarget = computed(() => groupedByDay.value.reduce((acc, d) => acc + d.target, 0));
const weekOvertime = computed(() => Math.max(0, weekWorked.value - weekTarget.value));

/** Editor */
const editorOpen = ref(false);
const editorMode = ref<"create" | "edit">("edit");
const editorEntry = ref<EntryForm>({
  work_date: range.value.from,
  start_time: "09:00",
  end_time: "17:00",
  break_minutes: 0,
  note: null,
});
function openCreate(day: string) {
  editorMode.value = "create";
  editorEntry.value = {
    work_date: day,
    start_time: "09:00",
    end_time: "17:00",
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
    await loadWeek();
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.data?.message || err?.message || "Failed to save entry";
  } finally {
    loading.value = false;
  }
}
async function deleteEntry(e: Entry) {
  error.value = null;
  loading.value = true;
  try {
    await $fetch(`/api/entries/${e.id}`, { method: "DELETE", credentials: "include" });
    await loadWeek();
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.data?.message || err?.message || "Failed to delete entry";
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await refreshSettings().catch(() => undefined);
  await loadWeek();
}

onMounted(refreshAll);
watch(refDate, refreshAll);
</script>

<template>
  <main class="wrap">
    <header class="top">
      <h1>Week</h1>
      <div class="picker">
        <label>
          Reference date
          <input type="date" v-model="refDate" />
        </label>
        <div class="range">
          {{ range.from }} – {{ range.to }}
        </div>
      </div>

      <!-- No fade for stats -->
      <div class="stats">
        <div><strong>Weekly hours</strong> {{ formatMinutes(weekWorked) }} / {{ formatMinutes(expectedWeek) }}</div>
        <div><strong>Overtime</strong> {{ formatMinutes(weekOvertime) }}</div>
      </div>
    </header>

    <section class="card">
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="loading" class="muted">Loading…</div>

      <div v-else class="days">
        <article v-for="d in groupedByDay" :key="d.date" class="day">
          <div class="day-head">
            <div class="date">{{ formatDisplayDate(d.date) }}</div>
            <div class="sum">
              {{ formatMinutes(d.worked) }} hr
              <span class="ot">OT {{ formatMinutes(d.overtime) }} hr</span>
            </div>
            <div v-if="d.entries.length === 0" class="empty">
              <button :disabled="loading" @click="openCreate(d.date)">+</button>
            </div>
          </div>

          <!-- Staggered entry fade-in (per day) -->
          <TransitionGroup
              v-if="d.entries.length > 0"
              :key="`${d.date}-${listVersion}`"
              tag="ul"
              name="fade"
              class="list"
              appear
          >
            <li
                v-for="(e, idx) in d.entries"
                :key="e.id"
                class="item"
                :style="{ transitionDelay: `${idx * 150}ms` }"
            >
              <div class="line">
                <span class="time">
                  {{ hhmm(e.start_time) }}–{{ hhmm(e.end_time) || "…" }}
                  <span v-if="!e.end_time" class="muted"> (running)</span>
                </span>
                <span class="worked">
                  {{ e.end_time ? formatMinutes(workedMinutes(e)) : "—" }} hr
                </span>
              </div>

              <div class="sub muted" v-if="e.break_minutes || e.note">
                <span v-if="e.break_minutes">Break {{ e.break_minutes }}m</span>
                <span v-if="e.break_minutes && e.note"> · </span>
                <span v-if="e.note">{{ e.note }}</span>
              </div>

              <div class="actions">
                <button :disabled="loading || !e.end_time" @click="openEdit(e)">Edit</button>
                <button :disabled="loading || !e.end_time" @click="deleteEntry(e)">Delete</button>
              </div>
            </li>
          </TransitionGroup>
        </article>
      </div>
    </section>

    <EntryEditorSheet
        v-model="editorOpen"
        :title="editorMode === 'create' ? 'Create entry' : 'Edit entry'"
        :submitLabel="editorMode === 'create' ? 'Create' : 'Save'"
        :entry="editorEntry"
        @submit="submitEditor"
    />
  </main>
</template>

<style scoped>
.wrap { padding: 16px; max-width: 720px; padding-top: 5rem; padding-bottom: 5rem; @media (min-width: 768px) { justify-self: center; width: 30%;}}
.top h1 { margin: 0 0 10px; font-size: 25px; text-align: center;}
.picker { display: flex; flex-direction: column; justify-content: space-between; gap: 10px; align-items: center; }
label { display: grid; gap: 6px; font-size: 13px; text-align: center;}
input { padding: 10px 12px; font-size: 14px; border-radius: 10px; border: 1px solid #cfcfcf; }
.range { font-size: 13px; opacity: 0.85;}
.stats { text-align: center; border: 1px solid #efefef; border-radius: 4px; padding: .5rem; font-size: 15px; margin: 1rem; }
.card { padding: 14px; background: none; color: black; }
.error { color: #b00020; font-size: 13px; margin: 0 0 10px; }
.muted { font-size: 13px; opacity: 0.75; }

.days { display: grid; gap: 10px; }

.day {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  background: white;
}

.day-head {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
  background: #e6e6e6;
  border-radius: 4px;
  padding: 4px 8px;
}
.date { font-weight: 600; font-size: 13px; }
.sum { font-size: 13px; padding-right: 10px; }
.ot { margin-left: 8px; opacity: 0.9; }
.empty { position: absolute; top: 50%; right: -25px; transform: translateY(-50%); background: white; border-radius: 4px; }

.list { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 10px; }
.item { border-top: 1px solid #efefef; padding-top: 10px; }
.item:first-child { border-top: none; padding-top: 0; }
.line { display: flex; justify-content: space-between; font-size: 13px; }
.time { font-weight: 500; }
.worked { opacity: 0.9; }
.sub { margin-top: 4px; }
.actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.actions button, .empty button { padding: 8px 10px; font-size: 13px; border-radius: 4px; border: none; background: #e6e6e6; }

/* Move transitions for TransitionGroup */
.list :deep(.fade-move) { transition: transform .5s ease; }

/* Do not keep delays when leaving (prevents odd delayed removals) */
.list :deep(.fade-leave-active) { transition-delay: 0ms !important; }
</style>
