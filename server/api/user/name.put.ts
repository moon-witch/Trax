import { defineEventHandler, readBody, createError } from "h3";
import { pool } from "../../utils/db";
import { requireUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const body = await readBody<{ name?: unknown }>(event);

    const raw = typeof body?.name === "string" ? body.name : "";
    const name = raw.trim();

    if (!name) throw createError({ statusCode: 400, statusMessage: "Name is required" });
    if (name.length > 60) throw createError({ statusCode: 400, statusMessage: "Name is too long (max 60)" });

    const r = await pool.query(
        `update app_users
     set name = $1
     where id = $2
     returning name`,
        [name, userId]
    );

    if (!r.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    return { ok: true, name: (r.rows[0].name as string) ?? name };
});
