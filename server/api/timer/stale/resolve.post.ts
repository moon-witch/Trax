import { pool } from "../../../utils/db";
import { requireUserId } from "../../../utils/auth";
import { localYYYYMMDD } from "~/utils/date";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const body = await readBody(event);
    const action = body?.action as "stop_eod" | "discard";

    if (!["stop_eod", "discard"].includes(action)) {
        throw createError({ statusCode: 400, statusMessage: "Invalid action" });
    }

    const today = localYYYYMMDD();

    // Find the stale running entry from a previous day
    const cur = await pool.query(
        `
    select id, start_time::text as start_time, break_seconds, is_on_break, break_started_at::text as break_started_at
    from work_entries
    where user_id = $1
      and work_date < $2::date
      and (end_time is null or is_running = true)
    order by work_date desc, start_time desc
    limit 1
    `,
        [userId, today]
    );

    if (!cur.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "No stale timer found" });
    }

    const entryId = cur.rows[0].id;

    if (action === "discard") {
        await pool.query(`DELETE FROM work_entries WHERE id = $1 AND user_id = $2`, [entryId, userId]);
        return { ok: true };
    }

    // stop_eod: set end_time to 23:59:00 and finalize any open break
    const endTime = "23:59:00";

    try {
        await pool.query(
            `
      update work_entries set
        end_time = $1::time,
        is_running = false,
        is_on_break = false,
        break_started_at = null,
        break_seconds = case
          when is_on_break = true and break_started_at is not null
            then break_seconds + greatest(0, extract(epoch from ($1::time - break_started_at))::int)
          else break_seconds
        end,
        break_minutes = floor((case
          when is_on_break = true and break_started_at is not null
            then break_seconds + greatest(0, extract(epoch from ($1::time - break_started_at))::int)
          else break_seconds
        end) / 60)::int
      where id = $2 and user_id = $3
      `,
            [endTime, entryId, userId]
        );
        return { ok: true };
    } catch (e: any) {
        if (e?.code === "23P01") {
            throw createError({ statusCode: 409, statusMessage: "Stop time overlaps with another entry" });
        }
        if (e?.code === "23514") {
            throw createError({ statusCode: 409, statusMessage: "Invalid stop time" });
        }
        throw createError({ statusCode: 500, statusMessage: "Database error" });
    }
});
