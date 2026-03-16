import { defineEventHandler } from "h3";
import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    const r = await pool.query(
        `select name, email
     from app_users
     where id = $1
     limit 1`,
        [userId]
    );

    const row = r.rowCount ? r.rows[0] : null;
    return {
        ok: true,
        name: (row?.name as string | null) ?? "",
        email: (row?.email as string | null) ?? "",
    };
});
