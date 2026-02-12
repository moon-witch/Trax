import argon2 from "argon2";
import { pool } from "../../utils/db";
import { createSession, setSessionCookie } from "../../utils/auth";
import { rateLimit } from "../../utils/rateLimit";

export default defineEventHandler(async (event) => {
    await rateLimit(event, "auth:login", 5, 60);
    const body = await readBody<{ email?: string; password?: string }>(event);

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password || password.length < 10) {
        throw createError({ statusCode: 400, statusMessage: "Invalid email or password" });
    }

    const passwordHash = await argon2.hash(password);

    let userId: string;
    try {
        const r = await pool.query(
            `insert into app_users (email, password_hash)
             values ($1, $2)
                 returning id`,
            [email, passwordHash]
        );
        userId = r.rows[0].id;
    } catch (e: any) {
        // Log the real error on the server (terminal) so you can see it immediately
        console.error("REGISTER INSERT FAILED:", {
            code: e?.code,
            message: e?.message,
            detail: e?.detail,
            schema: e?.schema,
            table: e?.table,
            constraint: e?.constraint,
        });

        if (e?.code === "23505") {
            throw createError({ statusCode: 409, statusMessage: "User already exists" });
        }

        throw createError({ statusCode: 500, statusMessage: "Database error" });
    }

    await purgeExpiredSessions();
    const { sessionId, expires } = await createSession(userId);
    setSessionCookie(event, sessionId, expires);

    return { ok: true };
});
