import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";
import { localYYYYMMDD } from "~/utils/date";

function nowHHMMSS() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const today = localYYYYMMDD();
    const start = nowHHMMSS();

    // Load user's current baselines to snapshot into the new entry
    const u = await pool.query(
        `select baseline_daily_minutes, baseline_weekly_minutes, workdays_per_week
     from app_users
     where id = $1`,
        [userId]
    );

    if (!u.rowCount) {
        throw createError({ statusCode: 500, statusMessage: "User settings not found" });
    }

    const baselineDaily = Number(u.rows[0].baseline_daily_minutes);
    const baselineWeekly = Number(u.rows[0].baseline_weekly_minutes);
    const workdaysPerWeek = Number(u.rows[0].workdays_per_week);

    // This start route assumes only one running timer per day in your current model.
    // It uses your existing ON CONFLICT (user_id, work_date) logic.
    const r = await pool.query(
        `
    insert into work_entries (
      user_id, work_date, start_time, end_time,
      break_minutes, note, is_running,
      baseline_daily_minutes_at_time,
      baseline_weekly_minutes_at_time,
      workdays_per_week_at_time
    )
    values ($1, $2::date, $3::time, null, 0, null, true, $4, $5, $6)
    on conflict (user_id, work_date)
    do update set
      start_time = case
        when work_entries.end_time is null or work_entries.is_running = true then work_entries.start_time
        else work_entries.start_time
      end,
      is_running = case
        when work_entries.end_time is null or work_entries.is_running = true then true
        else work_entries.is_running
      end
    returning id, start_time::text as start_time, end_time::text as end_time, is_running;
    `,
        [userId, today, start, baselineDaily, baselineWeekly, workdaysPerWeek]
    );

    const row = r.rows[0];
    const running = row.is_running === true || row.end_time === null;

    if (!running) {
        throw createError({ statusCode: 409, statusMessage: "An entry for today already exists and is closed" });
    }

    return { ok: true, running: true, start_time: row.start_time.slice(0, 5), entry_id: row.id };
});
