<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import { useSettings } from "@/composables/useSettings";
import {useAuth} from "~/composables/useAuth";

const open = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

const { baselineWeeklyMinutes, refreshSettings, saveSettings } = useSettings();

const weeklyHours = ref(40);

watch(open, async (v) => {
  if (!v) return;

  loading.value = true;
  error.value = null;

  try {
    await refreshSettings();
    weeklyHours.value = Math.round(baselineWeeklyMinutes.value / 60);
  } catch (e: any) {
    error.value = e?.message || "Failed to load settings";
  } finally {
    loading.value = false;
  }
});

async function save() {
  loading.value = true;
  error.value = null;

  try {
    const mins = Number(weeklyHours.value) * 60;

    if (!Number.isFinite(mins) || mins < 0) {
      throw new Error("Invalid weekly hours");
    }

    await saveSettings(mins);
    open.value = false;
  } catch (e: any) {
    error.value = e?.message || "Failed to save settings";
  } finally {
    loading.value = false;
  }
}

const { authenticated, refreshAuth } = useAuth();

onMounted(() => {
  if (authenticated.value === null) {
    refreshAuth();
  }
});

async function doLogout() {
  await $fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  authenticated.value = false;
  await navigateTo("/login");
}
</script>

<template>
  <div>
    <button @click="open = true" class="settings-button">
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><defs></defs><circle class="a" cx="24" cy="24" r="21.5"></circle><circle class="a" cx="24" cy="24" r="6"></circle><path class="a" d="M29.9994,24.0869H45.5"></path><path class="a" d="M30.1372,11.4169a14,14,0,0,1,4.4607,3.4352"></path><path class="a" d="M34.7246,32.999a14.0006,14.0006,0,0,1-4.5874,3.5841"></path><path class="a" d="M16.3751,12.2586A14,14,0,0,1,25.22,10.0533"></path><path class="a" d="M10.0069,24.44A14,14,0,0,1,12.49,16.03"></path><path class="a" d="M17.6441,36.4741a14,14,0,0,1-6.4338-6.78"></path><path class="a" d="M23.7769,35.6972v9.8016"></path><path class="a" d="M34.7246,32.999l6.5479,3.8037"></path><path class="a" d="M11.21,29.6943,4.94,33.9482"></path><path class="a" d="M12.49,16.03,6.0956,12.097"></path><path class="a" d="M25.22,10.0533l.08-7.5139"></path><path class="a" d="M34.5979,14.8521l6.4589-3.9408"></path></g></svg>
    </button>

    <div class="overlay" v-if="open" ></div>

    <div v-if="open" class="panel">
      <h2>Settings</h2>
      <div v-if="loading">Loading…</div>

      <div v-else class="card">
        <label>
          Weekly hours
          <input type="number" min="0" v-model.number="weeklyHours" />
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="buttons">
          <button @click="save">Save</button>
          <button @click="open = false">Cancel</button>
        </div>

        <button v-if="authenticated === true" @click="doLogout" class="logout">
          Logout
        </button>
      </div>
    </div>
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
svg {
  width: 2em;
  height: 2em;
}

.a{fill:none;stroke:white;stroke-linecap:round;stroke-linejoin:round;}

.overlay {
  z-index: 1;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.panel {
  position: absolute;
  top: 50%;
  right: 50%;
  transform: translate(50%, -50%);
  background: white;
  padding: 1rem;
  border: 1px solid #ccc;
  z-index: 2;
  border-radius: 4px;
  color: black;
  text-align: center;
}

.card {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  color: black;
}

label {
  display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;
}

label input {
  width: 1.5rem;
  text-align: center;
}

.logout {
  margin-top: 1rem;
  background: transparent;
  border: none;
}

.buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
}

.buttons button {
  border-radius: 4px;
  border: 1px solid #ccc;
  background: none;
  padding: .25rem .5rem;
}
</style>
