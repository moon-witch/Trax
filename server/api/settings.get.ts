import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const r = await pool.query(
        `select baseline_weekly_minutes from app_users where id = $1`,
        [userId]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    return {
        ok: true,
        settings: {
            baseline_weekly_minutes: Number(r.rows[0].baseline_weekly_minutes),
        },
    };
});
