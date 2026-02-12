import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { pool } from "./db";

const config = useRuntimeConfig();

const COOKIE_NAME = config.cookieName;
const SESSION_DAYS = Number(config.authSessionDays);
const isProd = config.env === "prod";

function sessionExpiry() {
    const d = new Date();
    d.setDate(d.getDate() + SESSION_DAYS);
    return d;
}

export function setSessionCookie(event: H3Event, sessionId: string, expires: Date) {
    setCookie(event, COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        expires,
    });
}

export function clearSessionCookie(event: H3Event) {
    setCookie(event, COOKIE_NAME, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
    });
}

export async function createSession(userId: string) {
    const expires = sessionExpiry();
    const sessionId = randomUUID();

    await pool.query(
        `insert into app_sessions (id, user_id, expires_at)
     values ($1, $2, $3)`,
        [sessionId, userId, expires]
    );

    return { sessionId, expires };
}

export async function getUserIdFromSession(event: H3Event): Promise<string | null> {
    const sid = getCookie(event, COOKIE_NAME);
    if (!sid) return null;

    const r = await pool.query(
        `select user_id
     from app_sessions
     where id = $1 and expires_at > (now() at time zone 'Europe/Berlin')::date`,
        [sid]
    );

    return r.rowCount ? (r.rows[0].user_id as string) : null;
}

export async function requireUserId(event: H3Event): Promise<string> {
    const userId = await getUserIdFromSession(event);
    if (!userId) {
        throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    return userId;
}

export async function purgeExpiredSessions() {
    await pool.query(`delete from app_sessions where expires_at <= (now() at time zone 'Europe/Berlin')::date`);
}
