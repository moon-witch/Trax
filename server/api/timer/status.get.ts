import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";
import { localYYYYMMDD } from "~/utils/date";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const today = localYYYYMMDD();

    // Return the currently running entry (if any). Multiple entries/day supported.
    const r = await pool.query(
        `
    select
      id,
      to_char(work_date, 'YYYY-MM-DD') as work_date,
      start_time::text as start_time,
      end_time::text as end_time,
      break_minutes,
      break_seconds,
      is_on_break,
      break_started_at::text as break_started_at,
      note,
      is_running
    from work_entries
    where user_id = $1
      and work_date = $2::date
      and (end_time is null or is_running = true)
    order by start_time desc
    limit 1
    `,
        [userId, today]
    );

    // Check for a stale running entry from a previous day
    const staleR = await pool.query(
        `
    select
      id,
      to_char(work_date, 'YYYY-MM-DD') as work_date,
      start_time::text as start_time,
      note
    from work_entries
    where user_id = $1
      and work_date < $2::date
      and (end_time is null or is_running = true)
    order by work_date desc, start_time desc
    limit 1
    `,
        [userId, today]
    );

    const staleEntry = staleR.rowCount
        ? {
              id: staleR.rows[0].id,
              work_date: staleR.rows[0].work_date,
              start_time: staleR.rows[0].start_time.slice(0, 5),
              note: staleR.rows[0].note ?? null,
          }
        : null;

    if (!r.rowCount) return { ok: true, running: false, entry: null, staleEntry };

    const e = r.rows[0];
    const running = e.is_running === true || e.end_time === null;

    return {
        ok: true,
        running,
        staleEntry,
        entry: {
            id: e.id,
            work_date: e.work_date,
            start_time: e.start_time ? e.start_time.slice(0, 5) : null,
            end_time: e.end_time ? e.end_time.slice(0, 5) : null,
            break_minutes: e.break_minutes ?? 0,
            break_seconds: e.break_seconds ?? 0,
            is_on_break: e.is_on_break ?? false,
            break_started_at: e.break_started_at ? e.break_started_at.slice(0, 8) : null,
            note: e.note ?? null,
        },
    };
});
