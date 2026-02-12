import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const id = getRouterParam(event, "id") || "";

    const r = await pool.query(
        `delete from work_entries where id = $1 and user_id = $2 returning id`,
        [id, userId]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "Entry not found" });
    }

    return { ok: true };
});
