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

    // Only one running entry at a time
    const running = await pool.query(
        `
    select id
    from work_entries
    where user_id = $1
      and work_date = $2::date
      and (end_time is null or is_running = true)
    limit 1
    `,
        [userId, today]
    );

    if (running.rowCount) {
        throw createError({ statusCode: 409, statusMessage: "A timer is already running" });
    }

    // Prevent starting inside an existing closed entry interval
    const overlapAtStart = await pool.query(
        `
    select 1
    from work_entries
    where user_id = $1
      and work_date = $2::date
      and end_time is not null
      and ($3::time >= start_time and $3::time < end_time)
    limit 1
    `,
        [userId, today, start]
    );

    if (overlapAtStart.rowCount) {
        throw createError({ statusCode: 409, statusMessage: "Start time overlaps with an existing entry" });
    }

    const r = await pool.query(
        `
    insert into work_entries (
      user_id, work_date, start_time, end_time,
      break_minutes, break_seconds, is_on_break, break_started_at,
      note, is_running
    )
    values ($1, $2::date, $3::time, null, 0, 0, false, null, null, true)
    returning id, start_time::text as start_time
    `,
        [userId, today, start]
    );

    const row = r.rows[0];
    return { ok: true, running: true, start_time: row.start_time.slice(0, 5), entry_id: row.id };
});
