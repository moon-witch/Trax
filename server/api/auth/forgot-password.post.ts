import argon2 from "argon2";
import { pool } from "../../utils/db";
import { rateLimit } from "../../utils/rateLimit";

export default defineEventHandler(async (event) => {
    await rateLimit(event, "auth:forgot-password", 5, 60);

    const body = await readBody<{
        email?: string;
        secret?: string;
        newPassword?: string;
    }>(event);

    const email = (body.email || "").trim().toLowerCase();
    const providedSecret = String(body.secret || "");
    const newPassword = body.newPassword || "";

    const config = useRuntimeConfig();
    const expectedSecret = String(config.secretPW || "");

    if (!expectedSecret) {
        throw createError({ statusCode: 500, statusMessage: "Feature disabled" });
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
        throw createError({ statusCode: 403, statusMessage: "Invalid secret" });
    }

    if (!email) {
        throw createError({ statusCode: 400, statusMessage: "Email is required" });
    }

    if (!newPassword || newPassword.length < 10) {
        throw createError({ statusCode: 400, statusMessage: "Password must be at least 10 characters" });
    }

    const passwordHash = await argon2.hash(newPassword);

    const result = await pool.query(
        `UPDATE app_users SET password_hash = $1 WHERE email = $2 RETURNING id`,
        [passwordHash, email]
    );

    if (result.rowCount === 0) {
        throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    return { ok: true };
});