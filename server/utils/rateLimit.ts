import type { H3Event } from "h3";
import { pool } from "./db";

export async function rateLimit(
    event: H3Event,
    action: string,
    limit: number,
    windowSeconds: number
) {
    const ip =
        getRequestHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
        getRequestHeader(event, "x-real-ip") ||
        "unknown";

    const key = `${action}:${ip}`;
    const r = await pool.query(
        `
    insert into rate_limits (key, window_start, count)
    values ($1, (now() at time zone 'Europe/Berlin')::date, 1)
    on conflict (key)
    do update set
      count = case
        when rate_limits.window_start < (now() at time zone 'Europe/Berlin')::date - ($2::int * interval '1 second')
          then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < (now() at time zone 'Europe/Berlin')::date - ($2::int * interval '1 second')
          then (now() at time zone 'Europe/Berlin')::date
        else rate_limits.window_start
      end
    returning window_start, count
    `,
        [key, windowSeconds]
    );

    const { count } = r.rows[0];

    if (count > limit) {
        throw createError({ statusCode: 429, statusMessage: "Too many requests" });
    }
}
