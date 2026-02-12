// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@vite-pwa/nuxt', '@vueuse/nuxt'],
    runtimeConfig: {
        // Private keys are only available on the server
        dbURL: process.env.DATABASE_URL,
        cookieName: process.env.AUTH_COOKIE_NAME,
        authSessionDays: process.env.AUTH_SESSION_DAYS,
        secretPW: process.env.SECRET_PASSWORD,

        // Public keys that are exposed to the client
        public: {
            env: process.env.ENV,
            publicName: process.env.NUXT_PUBLIC_APP_NAME
        },
    },
    app: {
        head: {
            title: "Trax",
            meta: [
                { name: "application-name", content: "Trax" },
                { name: "apple-mobile-web-app-title", content: "Trax" },
            ],
            link: [
                { rel: "icon", type: "image/png", href: "/icon.svg" },
            ],
        },
    },
    css: [
        "@/assets/css/transitions.css"
    ]
})