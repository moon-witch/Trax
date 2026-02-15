
import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";
import { localYYYYMMDD, nowHHMMSS } from "~/utils/date";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const today = localYYYYMMDD();
    const start = nowHHMMSS();

    // Prevent starting a second timer if one is already running
    const running = await pool.query(
        `SELECT id FROM work_entries
         WHERE user_id = $1 AND end_time IS NULL
         LIMIT 1`,
        [userId]
    );

    if (running.rowCount) {
        throw createError({ statusCode: 409, statusMessage: "A timer is already running" });
    }

    // Load user's current baselines to snapshot into the new entry
    const u = await pool.query(
        `SELECT baseline_daily_minutes, baseline_weekly_minutes, workdays_per_week
         FROM app_users
         WHERE id = $1`,
        [userId]
    );

    if (!u.rowCount) {
        throw createError({ statusCode: 500, statusMessage: "User settings not found" });
    }

    const baselineDaily = Number(u.rows[0].baseline_daily_minutes);
    const baselineWeekly = Number(u.rows[0].baseline_weekly_minutes);
    const workdaysPerWeek = Number(u.rows[0].workdays_per_week);

    try {
        const r = await pool.query(
            `INSERT INTO work_entries (
                user_id, work_date, start_time, end_time,
                break_minutes, note, is_running,
                baseline_daily_minutes_at_time,
                baseline_weekly_minutes_at_time,
                workdays_per_week_at_time
            )
            VALUES ($1, $2::date, $3::time, null, 0, null, true, $4, $5, $6)
            RETURNING id, start_time::text AS start_time, end_time::text AS end_time, is_running`,
            [userId, today, start, baselineDaily, baselineWeekly, workdaysPerWeek]
        );

        const row = r.rows[0];

        return {
            ok: true,
            running: true,
            start_time: row.start_time.slice(0, 5),
            entry_id: row.id,
        };
    } catch (e: any) {
        // Exclusion constraint violation = overlapping time range
        if (e?.code === "23P01") {
            throw createError({
                statusCode: 409,
                statusMessage: "This entry overlaps with an existing one",
            });
        }
        throw e;
    }
});