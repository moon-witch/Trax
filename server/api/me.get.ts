import { requireUserId } from "../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    return { ok: true, userId };
});
