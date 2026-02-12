import { getUserIdFromSession } from "../../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await getUserIdFromSession(event);
    return { ok: true, authenticated: !!userId };
});
