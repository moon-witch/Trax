import { ref } from "vue";

const timerStatus = ref<any>(null);
let pending: Promise<void> | null = null;

export function useTimer() {
    async function refreshTimer() {
        if (pending) return pending;

        pending = (async () => {
            try {
                const r = await $fetch<{ timerStatus: any }>("/api/timer/status", {
                    credentials: "include",
                });
                timerStatus.value = r;
            } catch {
                timerStatus.value = null;
            } finally {
                pending = null;
            }
        })();

        return pending;
    }

    async function startTimer() {
        await $fetch("/api/timer/start", {
            method: "POST",
            credentials: "include",
        })
    }

    async function stopTimer() {
        await $fetch("/api/timer/stop", {
            method: "POST",
            credentials: "include",
        })
    }

    async function startBreak() {
        await $fetch("/api/timer/break/start", { method: "POST", credentials: "include" });
    }

    async function stopBreak() {
        await $fetch("/api/timer/break/stop", { method: "POST", credentials: "include" });
    }


    return {
        timerStatus,
        refreshTimer,
        startTimer,
        stopTimer,
        startBreak,
        stopBreak
    };
}
