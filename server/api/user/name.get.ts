import { defineEventHandler } from "h3";
import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const r = await pool.query(
        `select name
     from app_users
     where id = $1
     limit 1`,
        [userId]
    );

    return { ok: true, name: (r.rowCount ? (r.rows[0].name as string | null) : null) ?? "" };
});
