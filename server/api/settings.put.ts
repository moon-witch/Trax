import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const body = await readBody<{ baseline_weekly_minutes?: number }>(event);

    const mins = Number(body?.baseline_weekly_minutes);

    if (!Number.isFinite(mins)) {
        throw createError({ statusCode: 400, statusMessage: "Invalid baseline value" });
    }

    if (mins < 0 || mins > 7 * 24 * 60) {
        throw createError({ statusCode: 400, statusMessage: "Baseline out of range" });
    }

    const r = await pool.query(
        `
    update app_users
    set baseline_weekly_minutes = $2::int
    where id = $1
    returning baseline_weekly_minutes
    `,
        [userId, Math.trunc(mins)]
    );

    return {
        ok: true,
        settings: {
            baseline_weekly_minutes: Number(r.rows[0].baseline_weekly_minutes),
        },
    };
});
