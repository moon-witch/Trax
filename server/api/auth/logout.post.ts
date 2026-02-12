import { pool } from "../../utils/db";
import { clearSessionCookie } from "../../utils/auth";

const config = useRuntimeConfig();

export default defineEventHandler(async (event) => {
    const sid = getCookie(event, config.cookieName);
    if (sid) {
        await pool.query(`delete from app_sessions where id = $1`, [sid]);
    }
    clearSessionCookie(event);
    return { ok: true };
});
