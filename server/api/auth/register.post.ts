import argon2 from "argon2";
import { pool } from "../../utils/db";
import { createSession, setSessionCookie, purgeExpiredSessions } from "../../utils/auth";
import { rateLimit } from "../../utils/rateLimit";

export default defineEventHandler(async (event) => {
    // Separate bucket from login
    await rateLimit(event, "auth:register", 5, 60);

    const body = await readBody<{
        email?: string;
        password?: string;
        secret?: string;
        name?: string;
    }>(event);

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const providedSecret = String(body.secret || "");
    const name = String(body.name || email.split("@")[0] || "").trim();

    // Validate registration secret
    const config = useRuntimeConfig();
    const expectedSecret = String(config.secretPW || "");

    if (!expectedSecret) {
        // Misconfiguration: do not allow open registration if secret is missing
        throw createError({ statusCode: 500, statusMessage: "Registration is disabled" });
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
        throw createError({ statusCode: 403, statusMessage: "Invalid registration secret" });
    }

    // Validate email/password
    if (!email || !password || password.length < 10) {
        throw createError({ statusCode: 400, statusMessage: "Invalid email or password" });
    }

    // Validate name
    if (!name || name.length > 60) {
        throw createError({ statusCode: 400, statusMessage: "Invalid name" });
    }

    const passwordHash = await argon2.hash(password);

    let userId: string;
    try {
        const r = await pool.query(
            `insert into app_users (email, password_hash, name)
       values ($1, $2, $3)
       returning id`,
            [email, passwordHash, name]
        );
        userId = r.rows[0].id;
    } catch (e: any) {
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
