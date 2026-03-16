import argon2 from "argon2";
import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const body = await readBody<{ newPassword?: string }>(event);
    const newPassword = body.newPassword || "";

    if (!newPassword || newPassword.length < 10) {
        throw createError({ statusCode: 400, statusMessage: "Password must be at least 10 characters" });
    }

    const passwordHash = await argon2.hash(newPassword);

    await pool.query(
        `UPDATE app_users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, userId]
    );

    return { ok: true };
});