import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const q = getQuery(event);
    const from = String(q.from || "");
    const to = String(q.to || "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw createError({ statusCode: 400, statusMessage: "from/to must be YYYY-MM-DD" });
    }

    const r = await pool.query(
        `select
        id,
        to_char(work_date, 'YYYY-MM-DD') as work_date,
        start_time::text as start_time,
        end_time::text as end_time,
        break_minutes,
        note,
        baseline_daily_minutes_at_time,
        baseline_weekly_minutes_at_time,
        workdays_per_week_at_time
     from work_entries
     where user_id = $1
       and work_date between $2::date and $3::date
     order by work_date asc, start_time asc;`,
        [userId, from, to]
    );

    return { ok: true, entries: r.rows };
});
