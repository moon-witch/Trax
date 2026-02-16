import { requireUserId } from "../utils/auth";
import { hamburgPublicHolidaysInRange } from "../utils/holidays";

export default defineEventHandler(async (event) => {
    await requireUserId(event); // keep it authenticated (consistent with other endpoints)

    const q = getQuery(event);
    const from = String(q.from || "");
    const to = String(q.to || "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw createError({ statusCode: 400, statusMessage: "from/to must be YYYY-MM-DD" });
    }

    const set = hamburgPublicHolidaysInRange(from, to);
    return { ok: true, holidays: Array.from(set).sort() };
});
