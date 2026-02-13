<script setup lang="ts">
import { ref, computed } from "vue";

type Entry = {
  id: string;
  work_date: string; // YYYY-MM-DD (or ISO; we normalize)
  start_time: string; // HH:MM:SS
  end_time: string | null; // running allowed
  break_minutes: number;
  note: string | null;

  // Optional if your API includes them; harmless if absent
  baseline_daily_minutes_at_time?: number;
  baseline_weekly_minutes_at_time?: number;
  workdays_per_week_at_time?: number;
};

async function fetchUserName(): Promise<string> {
  try {
    const r = await $fetch<{ ok: boolean; name: string }>("/api/user/name", {
      credentials: "include",
    });
    return String(r?.name || "");
  } catch {
    return "";
  }
}

/** Date helpers (local time) */
function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeWorkDate(v: any): string {
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return formatLocalDate(new Date(v));
  } catch {
    return String(v).slice(0, 10);
  }
}

function monthRangeLocal(yyyyMm: string) {
  // yyyyMm is "YYYY-MM" from <input type="month">
  const [y, m] = yyyyMm.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0); // day 0 of next month = last day of selected month
  return { from: formatLocalDate(first), to: formatLocalDate(last) };
}

/** CSV helpers */
function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Escape double quotes by doubling them; quote if needed
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]) {
  const head = headers.map(csvEscape).join(",");
  const lines = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","));
  // Excel-friendly UTF-8 BOM
  return "\uFEFF" + [head, ...lines].join("\r\n");
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** State */
const today = new Date();
const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

const month = ref<string>(initialMonth);
const loading = ref(false);
const error = ref<string | null>(null);

const range = computed(() => monthRangeLocal(month.value));

/** Optional: include derived minutes in export */
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

async function exportMonthCsv() {
  error.value = null;
  loading.value = true;

  try {
    const [name, r] = await Promise.all([
      fetchUserName(),
      $fetch<{ ok: boolean; entries: any[] }>("/api/entries", {
        query: { from: range.value.from, to: range.value.to },
        credentials: "include",
      }),
    ]);

    const entries: Entry[] = (r.entries || []).map((e) => ({
      ...e,
      work_date: normalizeWorkDate(e.work_date),
    }));

    entries.sort((a, b) => {
      const d = a.work_date.localeCompare(b.work_date);
      if (d !== 0) return d;
      return hhmm(a.start_time).localeCompare(hhmm(b.start_time));
    });

    const rows = entries.map((e) => ({
      name, // ← add user name
      work_date: e.work_date,
      start_time: hhmm(e.start_time),
      end_time: hhmm(e.end_time),
      break_minutes: e.break_minutes ?? 0,
      worked_minutes: e.end_time ? workedMinutes(e) : "",
      note: e.note ?? "",
    }));

    const headers = [
      "name",              // ← new column
      "work_date",
      "start_time",
      "end_time",
      "break_minutes",
      "worked_minutes",
      "note",
    ];

    const csv = toCsv(rows, headers);
    const filename = `entries_${month.value}.csv`;
    downloadTextFile(filename, csv);
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to export CSV";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="export-card">
    <h2 class="title">Monthly CSV Export</h2>

    <div class="controls">
      <label class="field">
        Month
        <input type="month" v-model="month" :disabled="loading" />
        <p class="muted">Range: {{ range.from }} – {{ range.to }}</p>
      </label>

      <button class="btn" :disabled="loading" @click="exportMonthCsv">
        {{ loading ? "Exporting…" : "Download CSV" }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.export-card {
  border: 1px solid #efefef;
  border-radius: 4px;
  padding: 12px;
  background: none;
  color: white;
  max-width: 720px;
  margin-top: 3rem;
}

.title {
  margin: 0 0 10px;
  font-size: 16px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  align-items: center;
}

.field {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

input {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 10px;
  border: 1px solid #cfcfcf;
  text-align: center;
}

.btn {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 6px;
  border: none;
  background: #e6e6e6;
  cursor: pointer;
  margin-top: 1rem;
}

.btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.error {
  color: #b00020;
  font-size: 13px;
  margin: 10px 0 0;
}

.muted {
  font-size: 13px;
  opacity: 0.75;
  margin: 10px 0 0;
}
</style>
