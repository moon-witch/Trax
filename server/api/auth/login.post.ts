import argon2 from "argon2";
import { pool } from "../../utils/db";
import { createSession, setSessionCookie } from "../../utils/auth";
import { rateLimit } from "../../utils/rateLimit";

export default defineEventHandler(async (event) => {
    await rateLimit(event, "auth:login", 10, 60);
    const body = await readBody<{ email?: string; password?: string }>(event);

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
        throw createError({ statusCode: 400, statusMessage: "Invalid credentials" });
    }

    const r = await pool.query(
        `select id, password_hash
     from app_users
     where email = $1`,
        [email]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 401, statusMessage: "Invalid credentials" });
    }

    const { id: userId, password_hash } = r.rows[0];
    const ok = await argon2.verify(password_hash, password);
    if (!ok) {
        throw createError({ statusCode: 401, statusMessage: "Invalid credentials" });
    }

    await purgeExpiredSessions();
    const { sessionId, expires } = await createSession(userId);
    setSessionCookie(event, sessionId, expires);

    return { ok: true };
});
