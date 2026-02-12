import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";
import { computeWorkedMinutes } from "../../utils/time";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const id = getRouterParam(event, "id") || "";

    if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

    const body = await readBody<{
        work_date?: string;
        start_time?: string;
        end_time?: string;
        break_minutes?: number;
        note?: string | null;
    }>(event);

    const work_date = body.work_date !== undefined ? String(body.work_date) : undefined;
    const start_time = body.start_time !== undefined ? String(body.start_time) : undefined;
    const end_time = body.end_time !== undefined ? String(body.end_time) : undefined;
    const break_minutes = body.break_minutes !== undefined ? Number(body.break_minutes) : undefined;
    const note = body.note !== undefined ? body.note : undefined;

    const cur = await pool.query(
        `
    select
      to_char(work_date, 'YYYY-MM-DD') as work_date,
      start_time::text as start_time,
      end_time::text as end_time,
      break_minutes
    from work_entries
    where id = $1 and user_id = $2
    `,
        [id, userId]
    );

    if (!cur.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "Entry not found" });
    }

    const curRow = cur.rows[0];

    const merged = {
        work_date: work_date ?? curRow.work_date,
        start_time: start_time ?? String(curRow.start_time).slice(0, 5),
        end_time: end_time ?? (curRow.end_time ? String(curRow.end_time).slice(0, 5) : undefined),
        break_minutes: break_minutes ?? curRow.break_minutes ?? 0,
    };

    if (work_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(work_date)) {
        throw createError({ statusCode: 400, statusMessage: "work_date must be YYYY-MM-DD" });
    }
    if (start_time !== undefined && !/^\d{2}:\d{2}$/.test(start_time)) {
        throw createError({ statusCode: 400, statusMessage: "start_time must be HH:MM" });
    }
    if (end_time !== undefined && !/^\d{2}:\d{2}$/.test(end_time)) {
        throw createError({ statusCode: 400, statusMessage: "end_time must be HH:MM" });
    }

    // If end_time is being set (or already exists), validate duration/breaks
    if (merged.end_time) {
        computeWorkedMinutes(merged.start_time, merged.end_time, merged.break_minutes);
    }

    try {
        const r = await pool.query(
            `
      update work_entries
      set work_date = coalesce($3::date, work_date),
          start_time = coalesce($4::time, start_time),
          end_time = coalesce($5::time, end_time),
          break_minutes = coalesce($6::int, break_minutes),
          note = case when $7::text is null then note else $7::text end
      where id = $1 and user_id = $2
      returning
        id,
        to_char(work_date, 'YYYY-MM-DD') as work_date,
        start_time::text as start_time,
        end_time::text as end_time,
        break_minutes,
        note
      `,
            [id, userId, work_date ?? null, start_time ?? null, end_time ?? null, break_minutes ?? null, note ?? null]
        );

        return { ok: true, entry: r.rows[0] };
    } catch (e: any) {
        if (e?.code === "23P01") {
            throw createError({ statusCode: 409, statusMessage: "Time overlaps with another entry" });
        }
        if (e?.code === "23514") {
            throw createError({ statusCode: 409, statusMessage: "Invalid time range" });
        }
        throw createError({ statusCode: 500, statusMessage: "Database error" });
    }
});
