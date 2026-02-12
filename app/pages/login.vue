<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "@/composables/useAuth";

const { refreshAuth } = useAuth();
const route = useRoute();

const email = ref("");
const password = ref("");

const loading = ref(false);
const error = ref<string | null>(null);

/** Registration secret dialog state */
const askSecret = ref(false);
const secret = ref("");

function nextPath() {
  const n = route.query.next;
  return typeof n === "string" && n.startsWith("/") ? n : "/";
}

function formatError(e: any) {
  return e?.data?.statusMessage || e?.data?.message || e?.message || "Request failed";
}

async function doAuth(kind: "login" | "register", providedSecret?: string) {
  error.value = null;
  loading.value = true;

  try {
    const body: any = {
      email: email.value,
      password: password.value,
    };

    if (kind === "register") {
      body.secret = providedSecret || "";
    }

    await $fetch(`/api/auth/${kind}`, {
      method: "POST",
      credentials: "include",
      body,
    });

    const s = await $fetch<{ authenticated: boolean }>("/api/auth/status", {
      credentials: "include",
    });

    if (!s.authenticated) {
      throw new Error("Session not established");
    }

    await refreshAuth();
    await navigateTo(nextPath());
  } catch (e: any) {
    error.value = formatError(e);
  } finally {
    loading.value = false;
  }
}

function login() {
  doAuth("login");
}

/** Step 1: open secret dialog */
function register() {
  secret.value = "";
  askSecret.value = true;
}

/** Step 2: confirm secret */
function confirmRegister() {
  askSecret.value = false;
  doAuth("register", secret.value);
}
</script>

<template>
  <main class="wrap">
    <section class="card">
      <h1>Sign in</h1>

      <label>
        Email
        <input v-model.trim="email" type="email" autocomplete="email" />
      </label>

      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>

      <div class="row">
        <button class="primary" :disabled="loading" @click="login">
          {{ loading ? "Please wait…" : "Login" }}
        </button>

        <button :disabled="loading" @click="register">
          Register
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <!-- Secret Dialog -->
    <div v-if="askSecret" class="overlay">
      <div class="dialog">
        <h2>Registration Secret</h2>

        <input
            v-model="secret"
            type="password"
            placeholder="Enter registration key"
            autocomplete="off"
        />

        <div class="row">
          <button class="primary" @click="confirmRegister">
            Continue
          </button>
          <button @click="askSecret = false">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.wrap {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 16px;
}

.card {
  width: 100%;
  max-width: 420px;
  padding: 16px;
  text-align: center;
}

label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  margin-bottom: 12px;
}

input {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 10px;
  border: 1px solid #cfcfcf;
}

.row {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

button {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 10px;
  border: 1px solid #cfcfcf;
  background: white;
}

.primary {
  flex: 1;
  font-weight: 600;
}

.error {
  margin-top: 12px;
  color: #b00020;
  font-size: 13px;
}

/* Dialog */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: grid;
  place-items: center;
}

.dialog {
  width: 100%;
  max-width: 300px;
  background: white;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #d7d7d7;
  text-align: center;
}

.dialog h2 {
  margin: 0 0 12px;
  font-size: 15px;
  color: black;
}
</style>
