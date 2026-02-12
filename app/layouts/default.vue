<script setup lang="ts">
import { onMounted } from "vue";
import { useAuth } from "@/composables/useAuth";
import SettingsButton from "~/components/SettingsButton.vue";

const { authenticated, refreshAuth } = useAuth();

onMounted(() => {
  if (authenticated.value === null) {
    refreshAuth();
  }
});
</script>

<template>
  <div class="layout-container">
    <div class="logo">
      <img src="/icon.svg" alt="Logo" />
    </div>
    <SettingsButton v-if="authenticated === true" />
    <slot />
    <nav v-if="authenticated === true" class="bottom-nav">
      <NuxtLink class="nav-item" to="/">Day</NuxtLink>
      <NuxtLink class="nav-item" to="/week">Week</NuxtLink>
      <NuxtLink class="nav-item" to="/stats">Stats</NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.logo {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 3rem;
  justify-content: center;
  background: black;
  padding-top: 1rem;
  border-top-left-radius: 40px;
  border-top-right-radius: 40px;
  box-shadow: 0 -5px 30px 0 black;
}

.nav-item {
  padding: .5rem;
  font-size: 1.25rem;
  font-weight: bold;
  color: black;
  background: white;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  text-decoration: none;
  transform: translateY(0);
  transition: transform 150ms ease-in-out;
}

.nav-item:active {
  transform: translateY(4px);
}
</style>
