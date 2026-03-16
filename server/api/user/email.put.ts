import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const body = await readBody<{ email?: string }>(event);
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
        throw createError({ statusCode: 400, statusMessage: "Valid email is required" });
    }

    try {
        const result = await pool.query(
            `UPDATE app_users SET email = $1 WHERE id = $2 RETURNING email`,
            [email, userId]
        );
        return { ok: true, email: result.rows[0].email as string };
    } catch (e: any) {
        if (e?.code === "23505") {
            throw createError({ statusCode: 409, statusMessage: "Email already in use" });
        }
        throw createError({ statusCode: 500, statusMessage: "Database error" });
    }
});