type Settings = {
    baseline_weekly_minutes: number;
};

const DEFAULT = 2400;

let pending: Promise<void> | null = null;

export function useSettings() {
    const settings = useState<Settings | null>("settings", () => null);

    const baselineWeeklyMinutes = computed({
        get: () => settings.value?.baseline_weekly_minutes ?? DEFAULT,
        set: (v: number) => {
            settings.value = { baseline_weekly_minutes: v };
        },
    });

    async function refreshSettings() {
        if (pending) return pending;

        pending = (async () => {
            const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

            const r = await $fetch<{ settings: Settings }>("/api/settings", {
                credentials: "include",
                headers,
            });

            settings.value = r.settings;
        })().finally(() => (pending = null));

        return pending;
    }

    async function saveSettings(minutes: number) {
        const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

        const r = await $fetch<{ settings: Settings }>("/api/settings", {
            method: "PUT",
            credentials: "include",
            headers,
            body: { baseline_weekly_minutes: minutes },
        });

        settings.value = r.settings;
    }

    return {
        settings,
        baselineWeeklyMinutes,
        refreshSettings,
        saveSettings,
    };
}
