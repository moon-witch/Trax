import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    // Pull baseline (weekly) for this user
    const u = await pool.query(
        `select baseline_weekly_minutes from app_users where id = $1`,
        [userId]
    );

    if (!u.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    const baselineWeeklyMinutes = Number(u.rows[0].baseline_weekly_minutes) || 0;

    // Daily baseline derived from weekly baseline (Mon–Fri)
    // If you later add "workdays per week", change this.
    const baselineDailyMinutes = Math.round(baselineWeeklyMinutes / 5);

    /**
     * worked minutes per entry:
     * extract(epoch from (end_time - start_time))/60 - break_minutes
     *
     * Notes:
     * - excludes running entries (end_time is null)
     * - clamps negative values to 0
     */
    const r = await pool.query(
        `
    with entry_minutes as (
      select
        work_date,
        date_trunc('week', work_date::timestamp)::date as week_start,
        greatest(
          0,
          (extract(epoch from (end_time - start_time)) / 60)::int - coalesce(break_minutes, 0)
        ) as minutes
      from work_entries
      where user_id = $1
        and end_time is not null
    ),
    per_day as (
      select work_date, sum(minutes)::int as day_minutes
      from entry_minutes
      group by work_date
    ),
    per_week as (
      select week_start, sum(minutes)::int as week_minutes
      from entry_minutes
      group by week_start
    )
    select
      -- weekly overtime sum
      coalesce((
        select sum(greatest(0, week_minutes - $2::int))::int
        from per_week
      ), 0) as overtime_weekly_minutes,

      -- daily overtime sum (using baselineWeekly/5)
      coalesce((
        select sum(greatest(0, day_minutes - $3::int))::int
        from per_day
      ), 0) as overtime_daily_minutes,

      -- optional context
      coalesce((select sum(minutes)::int from entry_minutes), 0) as total_worked_minutes,
      coalesce((select count(*)::int from per_week), 0) as weeks_count,
      coalesce((select count(*)::int from per_day), 0) as days_count
    `,
        [userId, baselineWeeklyMinutes, baselineDailyMinutes]
    );

    const row = r.rows[0];

    return {
        ok: true,
        stats: {
            baseline_weekly_minutes: baselineWeeklyMinutes,
            baseline_daily_minutes: baselineDailyMinutes,

            overtime_weekly_minutes: Number(row.overtime_weekly_minutes),
            overtime_daily_minutes: Number(row.overtime_daily_minutes),

            total_worked_minutes: Number(row.total_worked_minutes),
            weeks_count: Number(row.weeks_count),
            days_count: Number(row.days_count),
        },
    };
});
