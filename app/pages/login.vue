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

/** Forgot password dialog state */
const askForgot = ref(false);
const forgotEmail = ref("");
const forgotSecret = ref("");
const forgotNewPassword = ref("");
const forgotLoading = ref(false);
const forgotError = ref<string | null>(null);
const forgotSuccess = ref(false);

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

function openForgot() {
  forgotEmail.value = email.value;
  forgotSecret.value = "";
  forgotNewPassword.value = "";
  forgotError.value = null;
  forgotSuccess.value = false;
  askForgot.value = true;
}

async function confirmForgot() {
  forgotError.value = null;
  forgotLoading.value = true;
  try {
    await $fetch("/api/auth/forgot-password", {
      method: "POST",
      body: {
        email: forgotEmail.value,
        secret: forgotSecret.value,
        newPassword: forgotNewPassword.value,
      },
    });
    forgotSuccess.value = true;
  } catch (e: any) {
    forgotError.value = formatError(e);
  } finally {
    forgotLoading.value = false;
  }
}
</script>

<template>
  <main class="wrap" @keyup.enter="login">
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

      <button class="forgot-link" @click="openForgot">Forgot password?</button>

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

    <!-- Forgot Password Dialog -->
    <div v-if="askForgot" class="overlay">
      <div class="dialog">
        <h2>Reset Password</h2>

        <template v-if="!forgotSuccess">
          <input
              v-model.trim="forgotEmail"
              type="email"
              placeholder="Email"
              autocomplete="email"
          />

          <input
              v-model="forgotSecret"
              type="password"
              placeholder="Registration secret"
              autocomplete="off"
          />

          <input
              v-model="forgotNewPassword"
              type="password"
              placeholder="New password (min 10 chars)"
              autocomplete="new-password"
          />

          <p v-if="forgotError" class="error-inline">{{ forgotError }}</p>

          <div class="row">
            <button class="primary" :disabled="forgotLoading" @click="confirmForgot">
              {{ forgotLoading ? "Please wait…" : "Reset" }}
            </button>
            <button @click="askForgot = false">Cancel</button>
          </div>
        </template>

        <template v-else>
          <p class="success">Password updated successfully.</p>
          <button class="primary" @click="askForgot = false">Close</button>
        </template>
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
  padding-bottom: 20rem;
  position: relative;

  @media (min-width: 768px) {
    padding-bottom: 10rem;
  }
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
  background: #efefef;
}

.primary {
  flex: 1;
  font-weight: 600;
}

.forgot-link {
  margin-top: 10px;
  background: none;
  border: none;
  color: #555;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
}

.error {
  color: #b00020;
  font-size: 13px;
  position: absolute;
  bottom: 7rem;
  left: 50%;
  transform: translateX(-50%);
}

.error-inline {
  color: #b00020;
  font-size: 13px;
  margin: 4px 0 0;
}

.success {
  color: #1a7a3a;
  font-size: 13px;
  margin: 0 0 12px;
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
  background: #efefef;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #d7d7d7;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dialog h2 {
  margin: 0;
  font-size: 15px;
  color: #000b0e;
}
</style>