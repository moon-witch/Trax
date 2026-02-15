
import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";
import { computeWorkedMinutes } from "../utils/time";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const body = await readBody<{
        work_date?: string;
        start_time?: string;
        end_time?: string;
        break_minutes?: number;
        note?: string | null;
    }>(event);

    const work_date = String(body.work_date || "");
    const start_time = String(body.start_time || "");
    const end_time = String(body.end_time || "");
    const break_minutes = Number(body.break_minutes ?? 0);
    const note = body.note ?? null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(work_date)) {
        throw createError({ statusCode: 400, statusMessage: "work_date must be YYYY-MM-DD" });
    }
    if (!/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
        throw createError({ statusCode: 400, statusMessage: "start_time/end_time must be HH:MM" });
    }

    computeWorkedMinutes(start_time, end_time, break_minutes);

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
                user_id, work_date, start_time, end_time, break_minutes, note,
                baseline_daily_minutes_at_time,
                baseline_weekly_minutes_at_time,
                workdays_per_week_at_time
            )
            VALUES ($1, $2::date, $3::time, $4::time, $5, $6, $7, $8, $9)
            RETURNING
                id,
                to_char(work_date, 'YYYY-MM-DD') AS work_date,
                start_time::text AS start_time,
                end_time::text AS end_time,
                break_minutes,
                note`,
            [userId, work_date, start_time, end_time, break_minutes, note,
                baselineDaily, baselineWeekly, workdaysPerWeek]
        );

        return { ok: true, entry: r.rows[0] };
    } catch (e: any) {
        if (e?.code === "23505") {
            throw createError({ statusCode: 409, statusMessage: "Entry for this day already exists" });
        }
        if (e?.code === "23P01") {
            throw createError({
                statusCode: 409,
                statusMessage: "This entry overlaps with an existing one",
            });
        }

        throw createError({ statusCode: 500, statusMessage: e.message });
    }
});