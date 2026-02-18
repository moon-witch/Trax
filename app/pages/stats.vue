<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import CSVExport from "~/components/CSVExport.vue";
import LoadingError from "~/components/LoadingError.vue";
import { formatMinutes } from "@/utils/time";
import type { Stats } from "@/types/entry";

const loading = ref(false);
const error = ref<string | null>(null);
const stats = ref<Stats | null>(null);

/**
 * Prefer a single "overtime_total_minutes" coming from the backend (Option B).
 * If it is not available yet, fall back to (daily + weekly) if provided.
 */
const overtimeTotal = computed(() => {
  const s = stats.value;
  if (!s) return 0;

  if (typeof s.overtime_total_minutes === "number") return s.overtime_total_minutes;

  const daily = typeof s.overtime_daily_minutes === "number" ? s.overtime_daily_minutes : 0;
  const weekly = typeof s.overtime_weekly_minutes === "number" ? s.overtime_weekly_minutes : 0;
  return daily + weekly;
});

const overtimeDaily = computed(() => stats.value?.overtime_daily_minutes ?? 0);
const overtimeWeekly = computed(() => stats.value?.overtime_weekly_minutes ?? 0);

async function loadStats() {
  error.value = null;
  loading.value = true;
  try {
    const r = await $fetch<{ ok: boolean; stats: Stats }>("/api/stats", {
      credentials: "include",
    });
    stats.value = r.stats;
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || "Failed to load stats";
  } finally {
    loading.value = false;
  }
}

onMounted(loadStats);
</script>

<template>
  <main class="wrap">
    <header class="top">
      <h1>Stats</h1>
      <button :disabled="loading" @click="loadStats">Refresh</button>

      <div class="stats" v-if="stats">
        <div style="margin-top: 16px;">
          <strong>Overtime</strong> {{ formatMinutes(overtimeTotal) }} hr
        </div>

        <div class="muted" style="margin-top: 10px;">
          Total worked: {{ formatMinutes(stats.total_worked_minutes) }} ·
          Weeks: {{ stats.weeks_count }} · Days: {{ stats.days_count }}
        </div>
      </div>
    </header>

    <section v-if="error || loading || !stats" class="card">
      <LoadingError :error="error" :loading="loading" />
      <div v-if="!loading && !error && !stats" class="muted">No stats available.</div>
    </section>

    <section v-else class="card">
      <CSVExport />
    </section>
  </main>
</template>

<style scoped>
.wrap { padding: 16px; max-width: 720px; margin: 0 auto; padding-top: 5rem; text-align: center; }
.top h1 { margin: 0 0 10px; font-size: 25px; text-align: center; }
.stats { display: grid; gap: 6px; font-size: 20px; margin-bottom: 14px; margin-top: 3rem; }
button { padding: 10px 12px; font-size: 14px; border-radius: 4px; border: none; background: none; color: #efefef; }
.card { padding: 14px; background: none; color: #000b0e; }
.muted { font-size: 13px; opacity: 0.75; }
</style>
