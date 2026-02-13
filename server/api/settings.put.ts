import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";

function asInt(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (!Number.isInteger(n)) return null;
    return n;
}

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const body = await readBody<{
        baselineWeeklyMinutes?: number;
        baselineDailyMinutes?: number;
        workdaysPerWeek?: number;
    }>(event);

    const baselineWeeklyMinutes = asInt(body.baselineWeeklyMinutes);
    const baselineDailyMinutes = asInt(body.baselineDailyMinutes);
    const workdaysPerWeek = asInt(body.workdaysPerWeek);

    if (baselineWeeklyMinutes === null || baselineDailyMinutes === null || workdaysPerWeek === null) {
        throw createError({
            statusCode: 400,
            statusMessage: "baselineWeeklyMinutes, baselineDailyMinutes, workdaysPerWeek must be integers",
        });
    }

    if (baselineWeeklyMinutes < 0 || baselineWeeklyMinutes > 10080) {
        throw createError({ statusCode: 400, statusMessage: "baselineWeeklyMinutes out of range" });
    }
    if (baselineDailyMinutes < 0 || baselineDailyMinutes > 1440) {
        throw createError({ statusCode: 400, statusMessage: "baselineDailyMinutes out of range" });
    }
    if (workdaysPerWeek < 1 || workdaysPerWeek > 7) {
        throw createError({ statusCode: 400, statusMessage: "workdaysPerWeek out of range" });
    }

    const r = await pool.query(
        `
    update app_users
    set
      baseline_weekly_minutes = $2::int,
      baseline_daily_minutes = $3::int,
      workdays_per_week = $4::int
    where id = $1
    returning
      baseline_weekly_minutes,
      baseline_daily_minutes,
      workdays_per_week
    `,
        [userId, baselineWeeklyMinutes, baselineDailyMinutes, workdaysPerWeek]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    const row = r.rows[0];

    return {
        ok: true,
        settings: {
            baselineWeeklyMinutes: Number(row.baseline_weekly_minutes),
            baselineDailyMinutes: Number(row.baseline_daily_minutes),
            workdaysPerWeek: Number(row.workdays_per_week),
        },
    };
});
