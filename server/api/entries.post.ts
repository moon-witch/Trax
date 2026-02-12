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

    try {
        const r = await pool.query(
            `insert into work_entries (user_id, work_date, start_time, end_time, break_minutes, note)
       values ($1, $2::date, $3::time, $4::time, $5, $6)
           returning
              id,
              to_char(work_date, 'YYYY-MM-DD') as work_date,
              start_time::text as start_time,
              end_time::text as end_time,
              break_minutes,
              note;`,
            [userId, work_date, start_time, end_time, break_minutes, note]
        );

        return { ok: true, entry: r.rows[0] };
    } catch (e: any) {
        if (e?.code === "23505") {
            // unique violation for (user_id, work_date)
            throw createError({ statusCode: 409, statusMessage: "Entry for this day already exists" });
        }
        throw createError({ statusCode: 500, statusMessage: "Database error" });
    }
});
