export default defineNuxtRouteMiddleware(async (to) => {
    const isLogin = to.path === "/login";

    try {
        const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

        const r = await $fetch<{ authenticated: boolean }>("/api/auth/status", {
            credentials: "include",
            headers,
        });

        if (!r.authenticated && !isLogin) {
            return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`);
        }

        if (r.authenticated && isLogin) {
            return navigateTo("/");
        }

        return;
    } catch {
        // If status check fails, only redirect if not already on /login
        if (!isLogin) {
            return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`);
        }
        return;
    }
});
