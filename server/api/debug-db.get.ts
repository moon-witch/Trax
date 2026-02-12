const config = useRuntimeConfig();

export default defineEventHandler(() => {
    const url = config.dbURL;
    // Do not log credentials; only return a sanitized indicator.
    const sanitized = url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
    return { hasDbUrl: !!url, databaseUrl: sanitized };
});