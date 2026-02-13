<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useSettings } from "@/composables/useSettings";
import { useAuth } from "~/composables/useAuth";

const open = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

const {
  baselineWeeklyMinutes,
  baselineDailyMinutes,
  workdaysPerWeek,
  refreshSettings,
  saveSettings,
} = useSettings();

const weeklyHours = ref(40);
const dailyHours = ref(8);
const workdays = ref(5);

/** NEW: username */
const userName = ref("");
const initialUserName = ref("");

/** For smooth size changes + content fade-in after load */
const panelRef = ref<HTMLElement | null>(null);
const panelMinHeight = ref<number | null>(null);
const contentReady = ref(false);

watch(open, async (v) => {
  if (!v) {
    contentReady.value = false;
    panelMinHeight.value = null;
    return;
  }

  loading.value = true;
  error.value = null;
  contentReady.value = false;

  // lock the panel height while switching to "Loading…" to avoid jump
  await Promise.resolve();
  const initialH = panelRef.value?.getBoundingClientRect().height ?? null;
  if (initialH) panelMinHeight.value = Math.ceil(initialH);

  try {
    // NEW: load settings + name in parallel
    const [_, nameResp] = await Promise.all([
      refreshSettings(),
      $fetch<{ ok: boolean; name: string }>("/api/user/name", { credentials: "include" }),
    ]);

    weeklyHours.value = Math.round((baselineWeeklyMinutes.value || 0) / 60);
    dailyHours.value = Math.round((baselineDailyMinutes.value || 0) / 60);
    workdays.value = Number(workdaysPerWeek.value || 5);

    userName.value = String(nameResp?.name ?? "");
    initialUserName.value = userName.value;
  } catch (e: any) {
    error.value = e?.message || "Failed to load settings";
  } finally {
    loading.value = false;

    // next frame: let the "loaded" DOM render so height can transition smoothly
    await Promise.resolve();
    requestAnimationFrame(() => {
      contentReady.value = true;
      panelMinHeight.value = null; // release -> transitions to natural height
    });
  }
});

async function save() {
  loading.value = true;
  error.value = null;

  try {
    const weeklyMins = Number(weeklyHours.value) * 60;
    const dailyMins = Number(dailyHours.value) * 60;
    const wd = Number(workdays.value);

    if (!Number.isFinite(weeklyMins) || weeklyMins < 0) throw new Error("Invalid weekly hours");
    if (!Number.isFinite(dailyMins) || dailyMins < 0) throw new Error("Invalid daily hours");
    if (!Number.isInteger(wd) || wd < 1 || wd > 7) throw new Error("Invalid workdays per week");

    // NEW: validate name (same rules as API)
    const nameTrimmed = String(userName.value ?? "").trim();
    if (!nameTrimmed) throw new Error("Name is required");
    if (nameTrimmed.length > 60) throw new Error("Name is too long (max 60)");

    // Save settings
    await saveSettings({
      baselineWeeklyMinutes: weeklyMins,
      baselineDailyMinutes: dailyMins,
      workdaysPerWeek: wd,
    });

    // NEW: update name only if changed
    if (nameTrimmed !== initialUserName.value) {
      const r = await $fetch<{ ok: boolean; name: string }>("/api/user/name", {
        method: "PUT",
        credentials: "include",
        body: { name: nameTrimmed },
      });
      userName.value = String(r?.name ?? nameTrimmed);
      initialUserName.value = userName.value;
    }

    open.value = false;
  } catch (e: any) {
    error.value = e?.message || "Failed to save settings";
  } finally {
    loading.value = false;
  }
}

const { authenticated, refreshAuth } = useAuth();

onMounted(() => {
  if (authenticated.value === null) refreshAuth();
});

async function doLogout() {
  await $fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  authenticated.value = false;
  await navigateTo("/login");
}
</script>

<template>
  <div>
    <button @click="open = true" class="settings-button" aria-label="Settings">
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <circle class="a" cx="24" cy="24" r="21.5"></circle>
        <circle class="a" cx="24" cy="24" r="6"></circle>
        <path class="a" d="M29.9994,24.0869H45.5"></path>
        <path class="a" d="M30.1372,11.4169a14,14,0,0,1,4.4607,3.4352"></path>
        <path class="a" d="M34.7246,32.999a14.0006,14.0006,0,0,1-4.5874,3.5841"></path>
        <path class="a" d="M16.3751,12.2586A14,14,0,0,1,25.22,10.0533"></path>
        <path class="a" d="M10.0069,24.44A14,14,0,0,1,12.49,16.03"></path>
        <path class="a" d="M17.6441,36.4741a14,14,0,0,1-6.4338-6.78"></path>
        <path class="a" d="M23.7769,35.6972v9.8016"></path>
        <path class="a" d="M34.7246,32.999l6.5479,3.8037"></path>
        <path class="a" d="M11.21,29.6943,4.94,33.9482"></path>
        <path class="a" d="M12.49,16.03,6.0956,12.097"></path>
        <path class="a" d="M25.22,10.0533l.08-7.5139"></path>
        <path class="a" d="M34.5979,14.8521l6.4589-3.9408"></path>
      </svg>
    </button>

    <Transition name="fade">
      <div class="overlay" v-if="open" @click="open = false"></div>
    </Transition>

    <Transition name="fade">
      <div
          v-if="open"
          ref="panelRef"
          class="panel"
          role="dialog"
          aria-modal="true"
          :style="panelMinHeight != null ? { minHeight: panelMinHeight + 'px' } : undefined"
      >
        <h2>Settings</h2>

        <Transition name="fade" mode="out-in">
          <div v-if="loading" key="loading" class="loading-wrap">
            Loading…
          </div>

          <div v-else key="content">
            <TransitionGroup name="fade" tag="div" class="card">
              <!-- NEW: user name -->
              <label v-if="contentReady" key="name">
                Name
                <input
                    class="name-input"
                    type="text"
                    v-model="userName"
                    maxlength="60"
                    autocomplete="name"
                />
              </label>

              <label v-if="contentReady" key="weekly">
                Weekly hours
                <input type="number" min="0" v-model.number="weeklyHours" />
              </label>

              <label v-if="contentReady" key="daily">
                Daily hours
                <input type="number" min="0" v-model.number="dailyHours" />
              </label>

              <label v-if="contentReady" key="workdays">
                Workdays / week
                <input type="number" min="1" max="7" step="1" v-model.number="workdays" />
              </label>

              <p v-if="contentReady && error" key="error" class="error">{{ error }}</p>

              <div v-if="contentReady" key="buttons" class="buttons">
                <button :disabled="loading" @click="save">Save</button>
                <button :disabled="loading" @click="open = false">Cancel</button>
              </div>

              <button
                  v-if="contentReady && authenticated === true"
                  key="logout"
                  @click="doLogout"
                  class="logout"
              >
                Logout
              </button>
            </TransitionGroup>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.settings-button {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: .5rem;
  background: none;
  border: none;
  cursor: pointer;
  position: absolute;
  top: 0;
  right: 0;
}
svg { width: 2em; height: 2em; }
.a { fill: none; stroke: white; stroke-linecap: round; stroke-linejoin: round; }

.overlay {
  z-index: 1;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 1rem;
  border: 1px solid #ccc;
  z-index: 2;
  border-radius: 6px;
  color: black;
  text-align: center;
  min-width: 300px;
  transition: min-height 220ms ease, padding 220ms ease;
}

.loading-wrap { padding: .75rem 0; }

.card { display: flex; flex-direction: column; gap: .75rem; }
label { display: flex; gap: 1rem; align-items: center; justify-content: space-between; }
label input { width: 5rem; text-align: center; }

.name-input {
  width: 12rem;
  text-align: left;
}

.buttons { display: flex; gap: 1rem; justify-content: center; }
.buttons button { border-radius: 4px; border: 1px solid #ccc; background: none; padding: .25rem .5rem; }

.logout { margin-top: 1rem; background: transparent; border: none; cursor: pointer; }

.error { color: #b00020; font-size: 13px; margin: 0; }
</style>
