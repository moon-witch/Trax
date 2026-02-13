import { ref } from "vue";

type SettingsDTO = {
    baselineWeeklyMinutes: number;
    baselineDailyMinutes: number;
    workdaysPerWeek: number;
};

export function useSettings() {
    const baselineWeeklyMinutes = ref<number>(2400);
    const baselineDailyMinutes = ref<number>(480);
    const workdaysPerWeek = ref<number>(5);

    const loading = ref(false);
    const error = ref<string | null>(null);

    async function refreshSettings() {
        loading.value = true;
        error.value = null;

        try {
            const r = await $fetch<{ ok: boolean; settings: SettingsDTO }>("/api/settings", {
                method: "GET",
                credentials: "include",
            });

            baselineWeeklyMinutes.value = Number(r.settings.baselineWeeklyMinutes ?? 2400);
            baselineDailyMinutes.value = Number(r.settings.baselineDailyMinutes ?? 480);
            workdaysPerWeek.value = Number(r.settings.workdaysPerWeek ?? 5);
        } catch (e: any) {
            error.value = e?.data?.statusMessage || e?.message || "Failed to load settings";
            throw e;
        } finally {
            loading.value = false;
        }
    }

    async function saveSettings(payload: SettingsDTO) {
        loading.value = true;
        error.value = null;

        try {
            const r = await $fetch<{ ok: boolean; settings: SettingsDTO }>("/api/settings", {
                method: "PUT",
                credentials: "include",
                body: payload,
            });

            baselineWeeklyMinutes.value = Number(r.settings.baselineWeeklyMinutes);
            baselineDailyMinutes.value = Number(r.settings.baselineDailyMinutes);
            workdaysPerWeek.value = Number(r.settings.workdaysPerWeek);
        } catch (e: any) {
            error.value = e?.data?.statusMessage || e?.message || "Failed to save settings";
            throw e;
        } finally {
            loading.value = false;
        }
    }

    return {
        baselineWeeklyMinutes,
        baselineDailyMinutes,
        workdaysPerWeek,
        loading,
        error,
        refreshSettings,
        saveSettings,
    };
}
