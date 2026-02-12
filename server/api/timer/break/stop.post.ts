import { pool } from "../../../utils/db";
import { requireUserId } from "../../../utils/auth";
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
    const t = nowHHMMSS();

    const r = await pool.query(
        `
    update work_entries
    set
      break_seconds = break_seconds + greatest(0, extract(epoch from ($3::time - break_started_at))::int),
      is_on_break = false,
      break_started_at = null,
      break_minutes = floor(
        (break_seconds + greatest(0, extract(epoch from ($3::time - break_started_at))::int)) / 60
      )::int
    where user_id = $1
      and work_date = $2::date
      and (end_time is null or is_running = true)
      and is_on_break = true
      and break_started_at is not null
    returning id, break_seconds, break_minutes
    `,
        [userId, today, t]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 409, statusMessage: "Not currently on break" });
    }

    return { ok: true, break_seconds: r.rows[0].break_seconds, break_minutes: r.rows[0].break_minutes };
});
