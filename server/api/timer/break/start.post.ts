import { pool } from "../../../utils/db";
import { requireUserId } from "../../../utils/auth";
import { localYYYYMMDD, nowHHMMSS } from "~/utils/date";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const today = localYYYYMMDD();
    const t = nowHHMMSS();

    const r = await pool.query(
        `
    update work_entries
    set is_on_break = true,
        break_started_at = $3::time
    where user_id = $1
      and work_date = $2::date
      and (end_time is null or is_running = true)
      and is_on_break = false
    returning id
    `,
        [userId, today, t]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 409, statusMessage: "No running timer to start break (or already on break)" });
    }

    return { ok: true };
});
