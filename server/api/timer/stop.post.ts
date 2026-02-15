import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";
import { localYYYYMMDD, nowHHMMSS } from "~/utils/date";

function addOneSecond(hhmmss: string) {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(hhmmss);
    if (!m) return hhmmss;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3]);

    const d = new Date();
    d.setHours(hh, mm, ss + 1, 0);

    const h2 = String(d.getHours()).padStart(2, "0");
    const m2 = String(d.getMinutes()).padStart(2, "0");
    const s2 = String(d.getSeconds()).padStart(2, "0");
    return `${h2}:${m2}:${s2}`;
}

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const today = localYYYYMMDD();

    // Load running entry
    const cur = await pool.query(
        `
    select
      id,
      start_time::text as start_time,
      break_seconds,
      is_on_break,
      break_started_at::text as break_started_at
    from work_entries
    where user_id = $1
      and work_date = $2::date
      and (end_time is null or is_running = true)
    order by start_time desc
    limit 1
    `,
        [userId, today]
    );

    if (!cur.rowCount) {
        throw createError({ statusCode: 409, statusMessage: "No running timer for today" });
    }

    const row0 = cur.rows[0];
    const entryId: string = row0.id;
    const startTime: string = row0.start_time; // HH:MM:SS

    let end = nowHHMMSS();
    if (end <= startTime) end = addOneSecond(startTime);

    // If on break, finalize break time up to now
    // break_seconds += max(0, end - break_started_at)
    // then set is_on_break=false, break_started_at=null
    const finalizeBreakSql = `
    break_seconds = case
      when is_on_break = true and break_started_at is not null
        then break_seconds + greatest(0, extract(epoch from ($1::time - break_started_at))::int)
      else break_seconds
    end,
    is_on_break = false,
    break_started_at = null
  `;

    try {
        const r = await pool.query(
            `
      update work_entries
      set
        ${finalizeBreakSql},
        end_time = $2::time,
        is_running = false,
        break_minutes = floor( (case
          when is_on_break = true and break_started_at is not null
            then break_seconds + greatest(0, extract(epoch from ($1::time - break_started_at))::int)
          else break_seconds
        end) / 60 )::int
      where id = $3 and user_id = $4
      returning
        id,
        start_time::text as start_time,
        end_time::text as end_time,
        break_minutes,
        break_seconds
      `,
            [end, end, entryId, userId]
        );

        const row = r.rows[0];
        return {
            ok: true,
            running: false,
            entry_id: row.id,
            start_time: row.start_time.slice(0, 5),
            end_time: row.end_time.slice(0, 5),
            break_minutes: row.break_minutes ?? 0,
            break_seconds: row.break_seconds ?? 0,
        };
    } catch (e: any) {
        // Overlap exclusion violation
        if (e?.code === "23P01") {
            throw createError({ statusCode: 409, statusMessage: "Stop time overlaps with another entry" });
        }
        // Check constraint (end <= start etc.)
        if (e?.code === "23514") {
            throw createError({ statusCode: 409, statusMessage: "Invalid stop time" });
        }
        throw createError({ statusCode: 500, statusMessage: "Database error" });
    }
});
