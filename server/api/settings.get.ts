import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const r = await pool.query(
        `
    select
      baseline_weekly_minutes,
      baseline_daily_minutes,
      workdays_per_week
    from app_users
    where id = $1
    `,
        [userId]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    const row = r.rows[0];

    return {
        ok: true,
        settings: {
            baselineWeeklyMinutes: Number(row.baseline_weekly_minutes ?? 2400),
            baselineDailyMinutes: Number(row.baseline_daily_minutes ?? 480),
            workdaysPerWeek: Number(row.workdays_per_week ?? 5),
        },
    };
});
