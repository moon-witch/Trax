<script setup lang="ts">
import type { Entry } from "@/types/entry";
import { hhmm, workedMinutes, formatMinutes } from "@/utils/time";
import EntryActions from "@/components/EntryActions.vue";

defineProps<{
  entry: Entry
  loading?: boolean
}>()

defineEmits<{
  edit: [entry: Entry]
  delete: [entry: Entry]
}>()
</script>

<template>
  <li class="item" :class="{ running: !entry.end_time }">
    <div class="meta">
      <div class="mins">
        <strong>
          {{ hhmm(entry.start_time) }} – {{ hhmm(entry.end_time) || "..." }}
        </strong>

        <span v-if="entry.end_time" class="muted">
          · {{ formatMinutes(workedMinutes(entry)) }} hr
        </span>

        <span v-else class="muted"> · running</span>
      </div>

      <div class="sub muted" v-if="entry.break_minutes || entry.note">
        <span v-if="entry.break_minutes">Break {{ entry.break_minutes }}m</span>
        <span v-if="entry.break_minutes && entry.note"> · </span>
        <span v-if="entry.note">{{ entry.note }}</span>
      </div>
    </div>

    <EntryActions
      v-if="entry.end_time"
      :disabled="loading"
      :can-edit="!!entry.end_time"
      @edit="$emit('edit', entry)"
      @delete="$emit('delete', entry)"
    />
  </li>
</template>

<style scoped>
.item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.running {
  border: 1px solid #1FA1D0;
  animation: 1s pulse infinite alternate;
}

.meta {
  display: flex;
  flex-wrap: wrap;
}

.mins {
  font-size: 13px;
}

.sub {
  font-size: 13px;
}

.muted {
  font-size: 13px;
  opacity: 0.75;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0.97);
  }
}
</style>