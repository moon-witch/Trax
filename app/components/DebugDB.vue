<script setup lang="ts">
import { ref, computed } from "vue";

type Json = Record<string, any>;

const email = ref("");
const password = ref("");

const loading = ref(false);
const output = ref<Json | null>(null);
const error = ref<string | null>(null);

const isDev = computed(() => import.meta.dev);

function resetMessages() {
  output.value = null;
  error.value = null;
}

function formatError(e: any) {
  return e?.data?.statusMessage || e?.data?.message || e?.message || "Request failed";
}

async function callApi<T = any>(url: string, opts: any = {}) {
  resetMessages();
  loading.value = true;
  try {
    // Ensure cookies are included (important for session auth)
    const res = await $fetch<T>(url, { credentials: "include", ...opts });
    output.value = { url, ok: true, res } as any;
  } catch (e: any) {
    error.value = formatError(e);
    output.value = {
      url,
      ok: false,
      statusCode: e?.status || e?.data?.statusCode,
      statusMessage: e?.data?.statusMessage,
      message: e?.data?.message,
    };
  } finally {
    loading.value = false;
  }
}

async function register() {
  await callApi("/api/auth/register", {
    method: "POST",
    body: { email: email.value, password: password.value },
  });
}

async function login() {
  await callApi("/api/auth/login", {
    method: "POST",
    body: { email: email.value, password: password.value },
  });
}

async function logout() {
  await callApi("/api/auth/logout", { method: "POST" });
}

async function me() {
  await callApi("/api/me");
}

async function debugDb() {
  await callApi("/api/debug-db");
}

async function debugDbUsers() {
  await callApi("/api/debug-db-users");
}
</script>

<template>
  <section class="box">
    <h2>Auth & Debug</h2>

    <div class="form">
      <label>
        Email
        <input v-model.trim="email" type="email" autocomplete="email" placeholder="you@example.com" />
      </label>

      <label>
        Password
        <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Password"
        />
      </label>
    </div>

    <div class="row">
      <button :disabled="loading" @click="register">Register</button>
      <button :disabled="loading" @click="login">Login</button>
      <button :disabled="loading" @click="logout">Logout</button>
    </div>

    <div class="row">
      <button :disabled="loading" @click="me">GET /api/me</button>
      <button :disabled="loading" @click="debugDb">GET /api/debug-db</button>
      <button :disabled="loading" @click="debugDbUsers">GET /api/debug-db-users</button>
    </div>

    <p v-if="isDev" class="hint">
      Note (dev): if cookies do not persist on HTTP, set cookie <code>secure: false</code> locally.
    </p>

    <div v-if="error" class="error">{{ error }}</div>

    <pre v-if="output" class="out">{{ output }}</pre>
  </section>
</template>

<style scoped>
.box {
  padding: 16px;
  max-width: 520px;
}

h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.form {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

input {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 8px;
  border: 1px solid #cfcfcf;
}

.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

button {
  padding: 10px 12px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid #cfcfcf;
  background: #efefef;
}

button:disabled {
  opacity: 0.6;
}

.hint {
  margin-top: 12px;
  font-size: 12px;
  opacity: 0.85;
}

.error {
  margin-top: 12px;
  color: #b00020;
  font-size: 13px;
}

.out {
  margin-top: 12px;
  padding: 12px;
  background: #f6f6f6;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.4;
}
</style>
