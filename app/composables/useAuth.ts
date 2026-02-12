import { ref } from "vue";

const authenticated = ref<boolean | null>(null);
let pending: Promise<void> | null = null;

export function useAuth() {
    async function refreshAuth() {
        if (pending) return pending;

        pending = (async () => {
            try {
                const r = await $fetch<{ authenticated: boolean }>("/api/auth/status", {
                    credentials: "include",
                });
                authenticated.value = r.authenticated;
            } catch {
                authenticated.value = false;
            } finally {
                pending = null;
            }
        })();

        return pending;
    }

    return {
        authenticated,
        refreshAuth,
    };
}
