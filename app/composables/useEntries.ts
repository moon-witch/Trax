import { ref } from "vue";
import type { EntryForm } from "@/types/entry";

export function useEntries() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function createEntry(entry: EntryForm) {
    error.value = null;
    loading.value = true;
    try {
      await $fetch("/api/entries", {
        method: "POST",
        credentials: "include",
        body: entry,
      });
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || "Failed to create entry";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateEntry(entry: EntryForm) {
    if (!entry.id) throw new Error("Missing entry id");
    error.value = null;
    loading.value = true;
    try {
      await $fetch(`/api/entries/${entry.id}`, {
        method: "PUT",
        credentials: "include",
        body: {
          work_date: entry.work_date,
          start_time: entry.start_time,
          end_time: entry.end_time,
          break_minutes: entry.break_minutes,
          note: entry.note,
        },
      });
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || "Failed to update entry";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteEntry(id: string) {
    error.value = null;
    loading.value = true;
    try {
      await $fetch(`/api/entries/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || "Failed to delete entry";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}