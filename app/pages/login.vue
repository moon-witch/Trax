<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "@/composables/useAuth";

const { refresh } = useAuth();

const route = useRoute();

const email = ref("");
const password = ref("");

const loading = ref(false);
const error = ref<string | null>(null);

function nextPath() {
  const n = route.query.next;
  return typeof n === "string" && n.startsWith("/") ? n : "/";
}

function formatError(e: any) {
  return e?.data?.statusMessage || e?.data?.message || e?.message || "Request failed";
}

async function submit(kind: "login" | "register") {
  error.value = null;
  loading.value = true;

  try {
    await $fetch(`/api/auth/${kind}`, {
      method: "POST",
      credentials: "include",
      body: {
        email: email.value,
        password: password.value,
      },
    });

    // Confirm session is active (optional but helps catch cookie issues)
    const s = await $fetch<{ authenticated: boolean }>("/api/auth/status", {
      credentials: "include",
    });

    if (!s.authenticated) {
      throw new Error("Session not established (cookie not set)");
    }

    await refresh();
    await navigateTo(nextPath());
  } catch (e: any) {
    error.value = formatError(e);
  } finally {
    loading.value = false;
  }
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
        <button class="primary" :disabled="loading" @click="submit('login')">
          {{ loading ? "Please wait…" : "Login" }}
        </button>
        <button :disabled="loading" @click="submit('register')">
          Register
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <p class="hint">
        After login you will be redirected to:
        <code>{{ nextPath() }}</code>
      </p>
    </section>
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
  border: 1px solid #d7d7d7;
  border-radius: 14px;
  padding: 16px;
}

h1 {
  margin: 0 0 14px;
  font-size: 18px;
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
}

.error {
  margin-top: 12px;
  color: #b00020;
  font-size: 13px;
}

.hint {
  margin-top: 12px;
  font-size: 12px;
  opacity: 0.85;
}

code {
  font-size: 12px;
}
</style>
